import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";

export default defineConfig({
  base: "./",
  plugins: [preact(), UnoCSS()],
  resolve: { tsconfigPaths: true },
  optimizeDeps: {
    exclude: ["wafer-host", "snap-store"],
  },
  build: {
    outDir: "../../../dist/waveform-checker",
    emptyOutDir: true,
  },
  server: { port: 3000 },
});
