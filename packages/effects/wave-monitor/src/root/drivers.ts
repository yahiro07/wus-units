import { useEffect, useLayoutEffect } from "preact/hooks";
import { queryUnitInterface } from "wafer-host/unit-types";
import { ChannelId } from "@/root/definitions";
import { actions, store } from "@/root/store";
import { createWavePlotter } from "@/root/wave-plotter";

const unitInterface = queryUnitInterface("wafer-v01");
const audioContext = unitInterface?.audioContext ?? new AudioContext();

function mapTimeToBarPosition(time: number) {
  const barSeconds = 240 / store.state.hostBpm;
  return time / barSeconds;
}

const wavePlotterCh1 = createWavePlotter();
const wavePlotterCh2 = createWavePlotter();

let applyOutputRoute: (channelId: ChannelId | null) => void = () => {};

function setupUnit() {
  let startTime = 0;

  if (!unitInterface) {
    store.setHostBpm(120);
    return;
  }

  const destinationNode = unitInterface.audioOutputNode;
  const ch1Input = unitInterface.createAdditionalAudioInputNode("1");
  const ch2Input = unitInterface.createAdditionalAudioInputNode("2");

  function createChannelAnalyser(input: AudioNode) {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    input.connect(analyser);
    return {
      analyser,
      timeDomainData: new Float32Array(1024),
    };
  }

  const ch1Analyser = createChannelAnalyser(ch1Input);
  const ch2Analyser = createChannelAnalyser(ch2Input);

  let routedChannelId: ChannelId | null = null;

  applyOutputRoute = (channelId) => {
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
  };

  applyOutputRoute(store.state.activeChannelId);

  function feedWavePlotter(
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
      const barPosition = mapTimeToBarPosition(time);
      plotter.putWaveValue(barPosition, timeDomainData[i]);
    }
  }

  function updateAnalysers() {
    feedWavePlotter(ch1Analyser, wavePlotterCh1);
    feedWavePlotter(ch2Analyser, wavePlotterCh2);
  }

  const timerId = setInterval(updateAnalysers, 20);

  const cleanup = () => {
    applyOutputRoute = () => {};
    ch1Input.disconnect();
    ch2Input.disconnect();
    clearInterval(timerId);
  };

  unitInterface.completeSetup({
    unitAspects: {
      unitType: "effect",
      viewSize: [940, 520],
    },
    hostCallbacks: {
      setBpm(bpm: number) {
        store.setHostBpm(bpm);
      },
    },
    unitCallbacks: {
      onConnectedTo(_, linkedPortSubtypes) {
        if (linkedPortSubtypes.includes("audio")) {
          if (!store.state.activeChannelId) {
            actions.setActiveChannelId("ch1");
          }
        }
      },
    },
    clockHandlers: {
      start() {
        startTime = audioContext.currentTime;
      },
      processScheduling(_timeFrom, _barFrom, _barTo, bpm) {
        if (bpm !== store.state.hostBpm) {
          store.setHostBpm(bpm);
        }
      },
    },
    cleanup,
  });
}

function setupSynchronization() {
  return store.subscribe((attrs) => {
    const {
      barLength,
      wavePlotterCanvasCh1,
      wavePlotterCanvasCh2,
      activeChannelId,
    } = attrs;
    if (barLength !== undefined) {
      wavePlotterCh1.setBarLength(barLength);
      wavePlotterCh2.setBarLength(barLength);
    }
    if (wavePlotterCanvasCh1 !== undefined) {
      wavePlotterCh1.setCanvas(wavePlotterCanvasCh1);
    }
    if (wavePlotterCanvasCh2 !== undefined) {
      wavePlotterCh2.setCanvas(wavePlotterCanvasCh2);
    }
    if (activeChannelId !== undefined) {
      applyOutputRoute(activeChannelId);
    }
  });
}

export function useSetupDrivers() {
  useLayoutEffect(setupSynchronization, []);
  useEffect(setupUnit, []);
}
