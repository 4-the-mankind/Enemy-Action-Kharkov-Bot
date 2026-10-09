import { defineConfig } from "vite";
import path from "node:path";
import { mapApi } from "./server/map-api";

const page = (p: string) => path.resolve(import.meta.dirname, p);

export default defineConfig({
  plugins: [mapApi()],
  // data/ and assets/ are written by the tools: do not reload the page on every save.
  server: { host: true, port: 5173, watch: { ignored: ["**/data/**", "**/assets/**"] } },
  build: {
    rollupOptions: {
      input: {
        home: page("index.html"),
        game: page("src/game/index.html"),
        mapCalibration: page("src/tools/map-calibration/index.html"),
        mapPainter: page("src/tools/map-painter/index.html"),
        unitsIndex: page("src/tools/units-index/index.html"),
      },
    },
  },
});
