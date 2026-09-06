import { ChannelId } from "@/root/definitions";
import { createWavePlotter } from "@/root/wave-plotter";
import { UnitInterface } from "wafer-host/unit-types";

export const meterDbFloor = -48;

export type MeterState = {
  rmsDb: number;
  peakDb: number;
  holdDb: number;
};

const silentMeterState: MeterState = {
  rmsDb: meterDbFloor,
  peakDb: meterDbFloor,
  holdDb: meterDbFloor,
};

type MeterListener = (state: MeterState) => void;

type AudioAnalysisEngine = {
  setup(): void;
  cleanup(): void;
  setBpm(bpm: number): void;
  setBarLength(bars: number): void;
  setActiveChannel(id: ChannelId | null): void;
  setWaveCanvas(id: ChannelId, canvas: HTMLCanvasElement | null): void;
  subscribeUi(fn: (patch: { hostBpm?: number }) => void): () => void;
  hostStarted(): void;
  subscribeMeter(id: ChannelId, fn: MeterListener): () => void;
};

function createChannelAnalyser(input: AudioNode) {
  const ac = input.context;
  const analyser = ac.createAnalyser();
  analyser.fftSize = 1024;
  input.connect(analyser);
  return {
    analyser,
    timeDomainData: new Float32Array(1024),
  };
}

function linearToDb(value: number) {
  if (value <= 0) return meterDbFloor;
  return Math.max(meterDbFloor, 20 * Math.log10(value));
}

function bufferLevels(buf: Float32Array) {
  let peak = 0;
  let sumSq = 0;
  for (const x of buf) {
    const a = Math.abs(x);
    if (a > peak) peak = a;
    sumSq += x * x;
  }
  return { peak, rms: Math.sqrt(sumSq / buf.length) };
}

function createMeterTracker() {
  let rmsLin = 0;
  let holdDb = meterDbFloor;
  let holdUntil = 0;
  let lastTime = 0;

  return {
    update(peakLin: number, rmsLinInstant: number, now: number): MeterState {
      const dt = lastTime === 0 ? 0.016 : Math.min(0.08, now - lastTime);
      lastTime = now;
      const rmsCoeff = 1 - Math.exp(-dt / 0.3);
      rmsLin += (rmsLinInstant - rmsLin) * rmsCoeff;
      const peakDb = linearToDb(peakLin);
      const rmsDb = linearToDb(rmsLin);
      if (peakDb >= holdDb) {
        holdDb = peakDb;
        holdUntil = now + 1.5;
      } else if (now > holdUntil) {
        holdDb = Math.max(peakDb, holdDb - 20 * dt);
      }
      return { rmsDb, peakDb, holdDb };
    },
  };
}

export function createAudioAnalysisEngine(
  unitInterface: UnitInterface,
): AudioAnalysisEngine {
  const { audioContext } = unitInterface;

  const destinationNode = unitInterface.audioOutputNode;
  const ch1Input = unitInterface.createAdditionalAudioInputNode("1");
  const ch2Input = unitInterface.createAdditionalAudioInputNode("2");

  const ch1Analyser = createChannelAnalyser(ch1Input);
  const ch2Analyser = createChannelAnalyser(ch2Input);

  const wavePlotterCh1 = createWavePlotter();
  const wavePlotterCh2 = createWavePlotter();
  const meterTrackerCh1 = createMeterTracker();
  const meterTrackerCh2 = createMeterTracker();

  let hostBpm = 120;
  let startTime = 0;
  let routedChannelId: ChannelId | null = null;
  let rafId: number | undefined;
  const uiListeners = new Set<(patch: { hostBpm?: number }) => void>();
  const meterListeners: Record<ChannelId, Set<MeterListener>> = {
    ch1: new Set(),
    ch2: new Set(),
  };
  const meterState: Record<ChannelId, MeterState> = {
    ch1: silentMeterState,
    ch2: silentMeterState,
  };

  const internal = {
    mapTimeToBarPosition(time: number) {
      const barSeconds = 240 / hostBpm;
      return time / barSeconds;
    },
    applyOutputRoute(channelId: ChannelId | null) {
      if (channelId === routedChannelId) return;
      if (routedChannelId === "ch1") {
        ch1Input.disconnect(destinationNode);
      } else if (routedChannelId === "ch2") {
        ch2Input.disconnect(destinationNode);
      }
      routedChannelId = null;
      if (channelId === "ch1") {
        ch1Input.connect(destinationNode);
        routedChannelId = "ch1";
      } else if (channelId === "ch2") {
        ch2Input.connect(destinationNode);
        routedChannelId = "ch2";
      }
    },
    feedWavePlotter(
      { analyser, timeDomainData }: typeof ch1Analyser,
      plotter: typeof wavePlotterCh1,
    ) {
      analyser.getFloatTimeDomainData(timeDomainData);
      const { currentTime, sampleRate } = audioContext;
      const dt = 1 / sampleRate;
      const spanDuration = timeDomainData.length * dt;
      let time = currentTime - startTime - spanDuration;
      for (let i = 0; i < timeDomainData.length; i++) {
        time += dt;
        if (time < 0) continue;
        const barPosition = internal.mapTimeToBarPosition(time);
        plotter.putWaveValue(barPosition, timeDomainData[i]);
      }
    },
    updateChannelMeter(
      channelId: ChannelId,
      timeDomainData: Float32Array,
      tracker: ReturnType<typeof createMeterTracker>,
    ) {
      const { peak, rms } = bufferLevels(timeDomainData);
      const state = tracker.update(peak, rms, audioContext.currentTime);
      meterState[channelId] = state;
      for (const fn of meterListeners[channelId]) {
        fn(state);
      }
    },
    updateAnalysers() {
      internal.feedWavePlotter(ch1Analyser, wavePlotterCh1);
      internal.feedWavePlotter(ch2Analyser, wavePlotterCh2);
      internal.updateChannelMeter("ch1", ch1Analyser.timeDomainData, meterTrackerCh1);
      internal.updateChannelMeter("ch2", ch2Analyser.timeDomainData, meterTrackerCh2);
    },
    tick() {
      internal.updateAnalysers();
      rafId = requestAnimationFrame(internal.tick);
    },
  };

  return {
    setup() {
      if (rafId !== undefined) return;
      rafId = requestAnimationFrame(internal.tick);
    },
    cleanup() {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      }
      internal.applyOutputRoute(null);
      ch1Input.disconnect();
      ch2Input.disconnect();
    },
    setBpm(bpm) {
      hostBpm = bpm;
      for (const fn of uiListeners) {
        fn({ hostBpm: bpm });
      }
    },
    setBarLength(bars) {
      wavePlotterCh1.setBarLength(bars);
      wavePlotterCh2.setBarLength(bars);
    },
    setActiveChannel(id) {
      internal.applyOutputRoute(id);
    },
    setWaveCanvas(id, canvas) {
      if (id === "ch1") {
        wavePlotterCh1.setCanvas(canvas);
      } else {
        wavePlotterCh2.setCanvas(canvas);
      }
    },
    subscribeUi(fn) {
      uiListeners.add(fn);
      return () => {
        uiListeners.delete(fn);
      };
    },
    hostStarted() {
      startTime = audioContext.currentTime;
    },
    subscribeMeter(id, fn) {
      meterListeners[id].add(fn);
      fn(meterState[id]);
      return () => {
        meterListeners[id].delete(fn);
      };
    },
  };
}

export function createDummyEngine(): AudioAnalysisEngine {
  return {
    setup() {},
    cleanup() {},
    setBpm() {},
    setBarLength() {},
    setActiveChannel() {},
    setWaveCanvas() {},
    subscribeUi() {
      return () => {};
    },
    hostStarted() {},
    subscribeMeter(_id, fn) {
      fn(silentMeterState);
      return () => {};
    },
  };
}
