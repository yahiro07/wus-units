import { useEffect, useLayoutEffect } from "preact/hooks";
import { store } from "@/root/store";
import { engine, unitInterface } from "@/root/engine";

function setupUnit() {
  engine.setup();
  unitInterface?.completeSetup({
    unitAspects: {
      unitType: "effect",
      viewSize: [940, 520],
    },
    hostCallbacks: {
      setBpm(bpm: number) {
        store.setHostBpm(bpm);
        engine.setBpm(bpm);
      },
    },
    clockHandlers: {
      start: engine.hostStarted,
    },
    cleanup: engine.cleanup,
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
      engine.setBarLength(barLength);
    }
    if (wavePlotterCanvasCh1 !== undefined) {
      engine.setWaveCanvas("ch1", wavePlotterCanvasCh1);
    }
    if (wavePlotterCanvasCh2 !== undefined) {
      engine.setWaveCanvas("ch2", wavePlotterCanvasCh2);
    }
    if (activeChannelId !== undefined) {
      engine.setActiveChannel(activeChannelId);
    }
  });
}

export function useSetupDrivers() {
  useLayoutEffect(setupSynchronization, []);
  useEffect(setupUnit, []);
}
