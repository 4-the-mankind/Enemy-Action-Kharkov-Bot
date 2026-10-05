import { defineConfig } from "vite";
import path from "node:path";
import { mapApi } from "./server/map-api";

const page = (p: string) => path.resolve(import.meta.dirname, p);

export default defineConfig({
  plugins: [mapApi()],
  // data/ et assets/ sont écrits par les outils : ne pas recharger la page à chaque enregistrement.
  server: { host: true, port: 5173, watch: { ignored: ["**/data/**", "**/assets/**"] } },
  build: {
    rollupOptions: {
      input: {
        home: page("index.html"),
        mapCalibration: page("src/tools/map-calibration/index.html"),
      },
    },
  },
});
