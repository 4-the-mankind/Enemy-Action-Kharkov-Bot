import { defineConfig, type Plugin } from "vite";
import { execSync } from "node:child_process";
import { cpSync, readFileSync } from "node:fs";
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

/** GitHub Pages serves the site under the repository name (task 5.7). */
const PAGES_BASE = "/Enemy-Action-Kharkov-Bot/";

/**
 * The pages read data/ and assets/ at run time (fetch, image URLs): copied beside the build,
 * without the dev-only booklet positions (data/saves/) nor the scans.
 */
function copyStaticFiles(): Plugin {
  const skip = [page("data/saves"), page("assets/scans")];
  return {
    name: "copy-static-files",
    apply: "build",
    closeBundle() {
      for (const dir of ["data", "assets"])
        cpSync(page(dir), page(`dist/${dir}`), { recursive: true, filter: (src) => !skip.some((s) => src === s || src.startsWith(s + path.sep)) });
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  // The dev server stays at the root; the build and its preview (`vite preview`) use the Pages path.
  base: command === "build" || isPreview ? PAGES_BASE : "/",
  plugins: [mapApi(), copyStaticFiles()],
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
}));
