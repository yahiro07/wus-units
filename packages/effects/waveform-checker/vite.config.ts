import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [preact()],
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
