import { ChannelId } from "@/root/definitions";
import { createAudioAnalysisEngine, createDummyEngine } from "@/root/engine";
import { useEffect } from "preact/hooks";
import { createStore } from "snap-store/preact";
import { queryUnitInterface } from "wafer-host/unit-types";

const unitInterface = queryUnitInterface("wafer-v01");

export const engine = unitInterface
  ? createAudioAnalysisEngine(unitInterface)
  : createDummyEngine();

const store = createStore<{
  barLength: number;
  hostBpm: number;
  activeChannelId: ChannelId;
  altMetersLayout: boolean;
}>({
  barLength: 1,
  hostBpm: 0,
  activeChannelId: "ch1",
  altMetersLayout: false,
});

export const useStoreSnapshot = store.useSnapshot;

function setupUnit() {
  engine.setup();
  engine.setBarLength(store.state.barLength);
  engine.setActiveChannel(store.state.activeChannelId);
  unitInterface?.completeSetup({
    unitAspects: {
      unitType: "effect",
      viewSize: [1024, 492],
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
export function useSetupDrivers() {
  useEffect(setupUnit, []);
}

export const actions = {
  setActiveChannelId(channelId: ChannelId) {
    store.setActiveChannelId(channelId);
    engine.setActiveChannel(channelId);
  },
  toggleMetersLayout() {
    store.toggleAltMetersLayout();
  },
  setBarLength(barLength: number) {
    store.setBarLength(barLength);
    engine.setBarLength(barLength);
  },
};
