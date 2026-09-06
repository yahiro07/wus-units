import { ChannelId } from "@/root/definitions";
import { createStore } from "snap-store/preact";

export const store = createStore<{
  barLength: number;
  hostBpm: number;
  wavePlotterCanvasCh1: HTMLCanvasElement | null;
  wavePlotterCanvasCh2: HTMLCanvasElement | null;
  activeChannelId: ChannelId;
  altMetersLayout: boolean;
}>({
  barLength: 1,
  hostBpm: 0,
  wavePlotterCanvasCh1: null,
  wavePlotterCanvasCh2: null,
  activeChannelId: "ch1",
  altMetersLayout: false,
});

export const actions = {
  setActiveChannelId(channelId: ChannelId) {
    store.setActiveChannelId(channelId);
  },
  toggleMetersLayout() {
    store.toggleAltMetersLayout();
  },
};
