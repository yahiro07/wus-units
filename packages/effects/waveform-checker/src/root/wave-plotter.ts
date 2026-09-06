import { linearInterpolate } from "@/utils/helpers";

type WavePlotter = {
  setCanvas(canvas: HTMLCanvasElement | null): void;
  setBarLength(length: number): void;
  putWaveValue(barPosition: number, value: number): void;
};

export function createWavePlotter(): WavePlotter {
  let canvas: HTMLCanvasElement | null = null;
  let barLength = 1;

  function mapBarPositionToPlotX(barPosition: number) {
    if (!canvas) return 0;
    return ((barPosition % barLength) / barLength) * canvas.width;
  }

  const getCanvasContext = () => canvas?.getContext("2d");

  let prevX = 0;
  let prevY = 0;

  return {
    setCanvas(_canvas) {
      canvas = _canvas;
    },
    setBarLength(length) {
      barLength = length;
    },
    putWaveValue(barPosition, value) {
      const ctx = getCanvasContext();
      if (!ctx) return;
      const x = mapBarPositionToPlotX(barPosition);
      const y = linearInterpolate(value, -1, 1, ctx.canvas.height, 0, true);
      if (x >= prevX) {
        ctx.clearRect(prevX, 0, x - prevX, ctx.canvas.height);
        ctx.strokeStyle = "#0cf";
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      prevX = x;
      prevY = y;
    },
  };
}
