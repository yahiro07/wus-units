export {};

const configs = {
  maxLookaheadMs: 50,
};

const helpers = {
  calcSamplesLength(seconds: number, sampleRate: number) {
    return Math.round(seconds * sampleRate);
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
  maxBufferLength: number, //maxWorkLength + chunkSize
): MaximizerChannelLane {
  const bufferLine = new Float32Array(maxBufferLength);

  type Span = {
    si0: number;
    si1: number;
    peakLevel: number; //positive
  };

  let lastPeakLevel = 0;
  let prevInputSample = 0;

  const internal = {
    processInternal(chunkSize: number, workLength: number) {
      let spans: Span[] = [];
      let si0 = 0;

      //input looking phase, split samples into spans by zero crossings
      for (let i = 0; i < workLength; i++) {
        const sample = bufferLine[i];
        if (sample * prevInputSample < 0) {
          let peakLevel = helpers.findPeakLevel(bufferLine, si0, i);
          if (spans.length === 0 && lastPeakLevel > peakLevel) {
            peakLevel = lastPeakLevel;
          }
          spans.push({ si0, si1: i, peakLevel });
          si0 = i;
          if (i >= chunkSize) break;
        }
        prevInputSample = sample;
      }
      if (spans.length === 0) {
        spans.push({ si0, si1: workLength, peakLevel: lastPeakLevel });
      }
      lastPeakLevel = spans.at(-1)?.peakLevel ?? 0;

      //output phase, normalize spans
      for (const span of spans) {
        const { si0, si1, peakLevel } = span;
        for (let i = si0; i < si1; i++) {
          if (i >= chunkSize) break;
          bufferLine[i] = bufferLine[i] / peakLevel;
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
        const maxBufferLength =
          helpers.calcSamplesLength(configs.maxLookaheadMs, sampleRate) +
          chunkLength;
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
      const [inputL, inputR] = inputs[0];
      const [outputL, outputR] = outputs[0];
      if (!outputL) return true;

      const chunkLength = inputL.length;
      internal.ensureResources(sampleRate, chunkLength);

      const lookaheadSec = parameters.lookahead[0] ?? 5;
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
