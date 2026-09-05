export {};

class MaximaProcessor extends AudioWorkletProcessor {
  private readonly maximizer = createMaximizer(
    Math.round((maxLookaheadMs / 1000) * sampleRate),
  );

  static get parameterDescriptors() {
    return parameterDescriptors;
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ) {
    return this.maximizer.process(inputs, outputs, parameters);
  }
}

const maxLookaheadMs = 50;

const parameterDescriptors = [
  {
    name: "drive",
    defaultValue: 0,
    minValue: 0,
    maxValue: 24,
    automationRate: "k-rate" as const,
  },
  {
    name: "curve",
    defaultValue: 0,
    minValue: 0,
    maxValue: 1,
    automationRate: "k-rate" as const,
  },
  {
    name: "ceiling",
    defaultValue: -1,
    minValue: -18,
    maxValue: 0,
    automationRate: "k-rate" as const,
  },
  {
    name: "lookahead",
    defaultValue: 5,
    minValue: 1,
    maxValue: maxLookaheadMs,
    automationRate: "k-rate" as const,
  },
];

function createMaximizer(maxBufferSamples: number) {
  let channels: ReturnType<typeof createChannelMaximizer>[] = [];

  return { process };

  function process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output) return true;

    const drive = clamp(parameters.drive[0] ?? 0, 0, 24);
    const curve = clamp(parameters.curve[0] ?? 0, 0, 1);
    const ceiling = dbToGain(clamp(parameters.ceiling[0] ?? -1, -18, 0));
    const maxSpanSamples = Math.max(
      1,
      Math.round(
        (clamp(parameters.lookahead[0] ?? 5, 1, maxLookaheadMs) / 1000) *
          sampleRate,
      ),
    );

    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];
      if (!outputChannel) continue;

      const inputChannel = input?.[channel] ?? input?.[0];
      const maximizer = (channels[channel] ??=
        createChannelMaximizer(maxBufferSamples));

      for (let i = 0; i < outputChannel.length; i++) {
        outputChannel[i] = maximizer.takeOutput();
        maximizer.pushInput(
          inputChannel?.[i] ?? 0,
          drive,
          curve,
          ceiling,
          maxSpanSamples,
        );
      }
    }

    return true;
  }
}

function createChannelMaximizer(maxBufferSamples: number) {
  const span = new Float32Array(maxBufferSamples);
  const delayedOutput = new Float32Array(maxBufferSamples * 2 + 128);
  let spanLength = 0;
  let spanPeak = 0;
  let lastPolarity = 0;
  let outputIndex = 0;
  let envelopePeak = 0;

  return { takeOutput, pushInput };

  function takeOutput() {
    const value = delayedOutput[outputIndex] ?? 0;
    delayedOutput[outputIndex] = 0;
    outputIndex = (outputIndex + 1) % delayedOutput.length;
    return value;
  }

  function pushInput(
    value: number,
    drive: number,
    curve: number,
    ceiling: number,
    maxSpanSamples: number,
  ) {
    const polarity = getPolarity(value);
    if (
      polarity !== 0 &&
      lastPolarity !== 0 &&
      polarity !== lastPolarity &&
      spanLength > 0
    ) {
      flush(drive, curve, ceiling, maxSpanSamples);
    }

    span[spanLength] = value;
    spanLength++;
    spanPeak = Math.max(spanPeak, Math.abs(value));
    if (polarity !== 0) lastPolarity = polarity;

    if (spanLength >= maxSpanSamples) {
      flush(drive, curve, ceiling, maxSpanSamples);
    }
  }

  function flush(
    drive: number,
    curve: number,
    ceiling: number,
    maxSpanSamples: number,
  ) {
    if (spanLength === 0) return;

    const release = Math.exp(-spanLength / (sampleRate * 0.12));
    envelopePeak = Math.max(spanPeak, envelopePeak * release);

    const maxBoost = dbToGain(drive);
    const spanGain = Math.min(maxBoost, ceiling / Math.max(spanPeak, 1e-9));
    const envelopeGain = Math.min(
      maxBoost,
      ceiling / Math.max(envelopePeak, 1e-9),
    );
    const gain = curveGain(
      Math.min(spanGain, Math.sqrt(spanGain * envelopeGain)),
      maxBoost,
      curve,
      ceiling / Math.max(spanPeak, 1e-9),
    );
    const delay = Math.max(0, maxSpanSamples - spanLength);
    let writeIndex = (outputIndex + delay) % delayedOutput.length;

    for (let i = 0; i < spanLength; i++) {
      delayedOutput[writeIndex] = span[i] * gain;
      writeIndex = (writeIndex + 1) % delayedOutput.length;
    }

    spanLength = 0;
    spanPeak = 0;
  }
}

function getPolarity(value: number) {
  const threshold = 1e-5;
  if (value > threshold) return 1;
  if (value < -threshold) return -1;
  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function dbToGain(decibels: number) {
  return 10 ** (decibels / 20);
}

function curveGain(
  gain: number,
  maxBoost: number,
  curve: number,
  peakLimit: number,
) {
  if (curve === 0 || gain <= 1 || maxBoost <= 1) return gain;
  // if (curve === 0) return gain;

  const normalizedGain = clamp(Math.log(gain) / Math.log(maxBoost), 0, 1);
  const curvedGain = tunableSigmoid(normalizedGain, curve * -0.9);
  return Math.min(maxBoost ** curvedGain, peakLimit);
}

function tunableSigmoid(value: number, curve: number) {
  return (value - curve * value) / (curve - 2 * curve * Math.abs(value) + 1);
}

registerProcessor("maxima-processor", MaximaProcessor);
