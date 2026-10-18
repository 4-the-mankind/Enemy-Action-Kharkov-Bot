import { defineConfig } from "vite";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mapApi } from "./server/map-api";

const page = (p: string) => path.resolve(import.meta.dirname, p);

/** The app written in save files (task 5.2): package version, git commit, files not yet committed. */
function appVersion() {
  const git = (args: string) => { try { return execSync(`git ${args}`, { cwd: import.meta.dirname, encoding: "utf8" }).trim(); } catch { return null; } };
  const { version } = JSON.parse(readFileSync(page("package.json"), "utf8"));
  const status = git("status --porcelain");
  return { version, commit: git("rev-parse --short HEAD") ?? "unknown", modified: !!status };
}

export default defineConfig({
  plugins: [mapApi()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  // data/ and assets/ are written by the tools: do not reload the page on every save.
  server: { host: true, port: 5173, watch: { ignored: ["**/data/**", "**/assets/**"] } },
  build: {
    // The map calibration and the map painter write data/ through the dev server: not built (Q98 c).
    rollupOptions: {
      input: {
        game: page("index.html"),
        unitsIndex: page("src/tools/units-index/index.html"),
        sovietCards: page("src/tools/soviet-cards/index.html"),
      },
    },
  },
});
