import { createStore } from "snap-store/preact";

export const store = createStore<{
  barLength: number;
  hostBpm: number;
  wavePlotterCanvasCh1: HTMLCanvasElement | null;
  wavePlotterCanvasCh2: HTMLCanvasElement | null;
}>({
  barLength: 1,
  hostBpm: 0,
  wavePlotterCanvasCh1: null,
  wavePlotterCanvasCh2: null,
});
