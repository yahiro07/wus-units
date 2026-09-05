import { clampValue } from "@/utils/helpers";

export {};

const configs = {
  maxLookaheadMs: 50,
};

const helpers = {
  calcSamplesLength(ms: number, sampleRate: number) {
    return Math.round((ms / 1000) * sampleRate);
  },
  writeBuffer(
    dest: Float32Array,
    destOffset: number,
    source: Float32Array,
    len: number,
  ) {
    for (let i = 0; i < len; i++) {
      dest[destOffset + i] = source[i];
    }
  },
  shiftBufferContent(buffer: Float32Array, amount: number) {
    for (let i = 0; i < buffer.length - amount; i++) {
      buffer[i] = buffer[i + amount];
    }
  },
  findPeakLevel(buffer: Float32Array, si0: number, si1: number) {
    let peakLevel = 0;
    for (let i = si0; i < si1; i++) {
      const level = Math.abs(buffer[i]);
      if (level > peakLevel) {
        peakLevel = level;
      }
    }
    return peakLevel;
  },
};

type MaximizerChannelLane = {
  process: (chunkBuffer: Float32Array, workLength: number) => void;
};

function createMaximizerChannelLane(
  maxBufferLength: number, //maxWorkLength + chunkSize * 2
): MaximizerChannelLane {
  const bufferLine = new Float32Array(maxBufferLength);

  type Span = {
    si0: number;
    si1: number;
    sustaining: boolean;
    peakLevel?: number; //positive
  };

  let runningPeak: number | null = null;

  const internal = {
    processInternal(chunkSize: number, workLength: number) {
      let spans: Span[] = []; //todo: make object pool
      let si0 = 0;

      //input looking phase, split samples into spans by zero crossings
      for (let i = 1; i < workLength; i++) {
        const prevSample = bufferLine[i - 1];
        const sample = bufferLine[i];
        if (sample * prevSample < 0 || (prevSample !== 0 && sample === 0)) {
          const si1 = i;
          spans.push({ si0, si1, sustaining: false });
          si0 = i;
          if (si1 >= chunkSize) break;
        }
      }
      let lastSpan = spans.at(-1);
      if (!(lastSpan && lastSpan.si1 >= chunkSize)) {
        spans.push({ si0, si1: workLength, sustaining: true });
      }

      //find peak for spans
      for (const span of spans) {
        const { si0, si1 } = span;
        let peakLevel = helpers.findPeakLevel(bufferLine, si0, si1);
        if (si0 === 0 && runningPeak) {
          if (span.sustaining) {
            //treatment for multiple continuous non zero-crossing frames
            if (0) {
              //keep previous peak
              //this causes clipping if higher peaks found in the new frame
              peakLevel = runningPeak;
            } else {
              //take max
              //this causes a step between chunks
              peakLevel = Math.max(runningPeak, peakLevel);
            }
            //some interpolation could be used to improve these but
            //we don't adopt it here since the logic gets more complex
          } else {
            //this is no problem since the new span is closed
            peakLevel = Math.max(runningPeak, peakLevel);
          }
        }
        span.peakLevel = peakLevel;
      }

      lastSpan = spans.at(-1);
      if (lastSpan?.sustaining) {
        runningPeak = lastSpan.peakLevel!;
      } else {
        runningPeak = null;
      }

      //output phase, normalize spans
      for (const span of spans) {
        const { si0, si1, peakLevel } = span;
        const gain = peakLevel ? 1 / peakLevel : 1;
        for (let i = si0; i < si1; i++) {
          if (i >= chunkSize) break;
          bufferLine[i] = bufferLine[i] * gain;
        }
      }
    },
  };

  return {
    process(chunkBuffer: Float32Array, workLength: number) {
      const chunkSize = chunkBuffer.length;
      helpers.writeBuffer(bufferLine, workLength, chunkBuffer, chunkSize); //tail block <-- input samples
      helpers.shiftBufferContent(bufferLine, chunkSize); //shift block
      internal.processInternal(chunkSize, workLength);
      helpers.writeBuffer(chunkBuffer, 0, bufferLine, chunkSize); //output samples <-- head block
    },
  };
}

function createProcessorImpl() {
  let laneLeft: MaximizerChannelLane | undefined;
  let laneRight: MaximizerChannelLane | undefined;
  let lastSampleRate = 0;
  let lastChunkLength = 0;
  let chunkBuffer: Float32Array;

  const internal = {
    ensureResources(sampleRate: number, chunkLength: number) {
      if (sampleRate !== lastSampleRate || chunkLength !== lastChunkLength) {
        const maxWorkLength = helpers.calcSamplesLength(
          configs.maxLookaheadMs,
          sampleRate,
        );
        const maxBufferLength = maxWorkLength + chunkLength * 2;
        laneLeft = createMaximizerChannelLane(maxBufferLength);
        laneRight = createMaximizerChannelLane(maxBufferLength);
        lastSampleRate = sampleRate;
        lastChunkLength = chunkLength;
      }
      if (!chunkBuffer || chunkBuffer.length !== chunkLength) {
        chunkBuffer = new Float32Array(chunkLength);
      }
    },
  };

  return {
    process(
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>,
      sampleRate: number,
    ) {
      const input = inputs[0];
      const output = outputs[0];
      if (!(input && output)) return true;
      const [inputL, inputR] = input;
      const [outputL, outputR] = output;

      const chunkLength = inputL.length;
      internal.ensureResources(sampleRate, chunkLength);

      const lookaheadSec = clampValue(parameters.lookahead[0] ?? 5, 1, 50);
      const workLength =
        helpers.calcSamplesLength(lookaheadSec, sampleRate) + chunkLength;

      chunkBuffer.set(inputL);
      laneLeft?.process(chunkBuffer, workLength);
      outputL.set(chunkBuffer);
      if (inputR && outputR) {
        chunkBuffer.set(inputR);
        laneRight?.process(chunkBuffer, workLength);
        outputR.set(chunkBuffer);
      }
    },
  };
}

function paramDesc(
  name: string,
  defaultValue: number,
  minValue: number,
  maxValue: number,
) {
  const automationRate = "k-rate" as const;
  return { name, defaultValue, minValue, maxValue, automationRate };
}

const parameterDescriptors = [
  paramDesc("drive", 0, 0, 24),
  paramDesc("curve", 0, 0, 1),
  paramDesc("ceiling", -1, -18, 0),
  paramDesc("lookahead", 5, 1, configs.maxLookaheadMs),
];

class MaximaProcessor2 extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return parameterDescriptors;
  }

  private processorImpl = createProcessorImpl();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    this.processorImpl.process(
      inputs,
      outputs,
      parameters,
      globalThis.sampleRate,
    );
    return true;
  }
}

registerProcessor("maxima-processor-2", MaximaProcessor2);
