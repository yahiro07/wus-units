import { ChannelId } from "@/root/definitions";
import { createStore } from "snap-store/preact";

export const store = createStore<{
  barLength: number;
  hostBpm: number;
  wavePlotterCanvasCh1: HTMLCanvasElement | null;
  wavePlotterCanvasCh2: HTMLCanvasElement | null;
  activeChannelId: ChannelId | null;
}>({
  barLength: 1,
  hostBpm: 0,
  wavePlotterCanvasCh1: null,
  wavePlotterCanvasCh2: null,
  activeChannelId: null,
});

export const actions = {
  setActiveChannelId(channelId: ChannelId) {
    store.setActiveChannelId(channelId);
  },
};
