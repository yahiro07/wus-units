import { ChannelId } from "@/root/definitions";
import { createWavePlotter } from "@/root/wave-plotter";
import { queryUnitInterface, UnitInterface } from "wafer-host/unit-types";

type AudioAnalysisEngine = {
  setup(): void;
  cleanup(): void;
  setBpm(bpm: number): void;
  setBarLength(bars: number): void;
  setActiveChannel(id: ChannelId | null): void;
  setWaveCanvas(id: ChannelId, canvas: HTMLCanvasElement | null): void;
  setLevelCanvas(id: ChannelId, canvas: HTMLCanvasElement | null): void;
  subscribeUi(fn: (patch: { hostBpm?: number }) => void): () => void;
  hostStarted(): void;
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

function createAudioAnalysisEngine(
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

  let hostBpm = 120;
  let startTime = 0;
  let routedChannelId: ChannelId | null = null;
  let timerId: ReturnType<typeof setInterval> | undefined;
  const uiListeners = new Set<(patch: { hostBpm?: number }) => void>();

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
    updateAnalysers() {
      internal.feedWavePlotter(ch1Analyser, wavePlotterCh1);
      internal.feedWavePlotter(ch2Analyser, wavePlotterCh2);
    },
  };

  return {
    setup() {
      if (timerId !== undefined) return;
      timerId = setInterval(internal.updateAnalysers, 20);
    },
    cleanup() {
      if (timerId !== undefined) {
        clearInterval(timerId);
        timerId = undefined;
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
    setLevelCanvas(_id, _canvas) {},
    subscribeUi(fn) {
      uiListeners.add(fn);
      return () => {
        uiListeners.delete(fn);
      };
    },
    hostStarted() {
      startTime = audioContext.currentTime;
    },
  };
}

function createDummyEngine(): AudioAnalysisEngine {
  return {
    setup() {},
    cleanup() {},
    setBpm() {},
    setBarLength() {},
    setActiveChannel() {},
    setWaveCanvas() {},
    setLevelCanvas() {},
    subscribeUi() {
      return () => {};
    },
    hostStarted() {},
  };
}

export const unitInterface = queryUnitInterface("wafer-v01");

export const engine = unitInterface
  ? createAudioAnalysisEngine(unitInterface)
  : createDummyEngine();
