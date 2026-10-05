// Vite plugin: local API used by the tools (dev server only).
import type { Plugin } from "vite";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const GRID_FILE = path.join(root, "data/map-grid.json");
const MAP_DIR = path.join(root, "assets/map");

/** Small local API: read / write data/map-grid.json and the map images. */
export function mapApi(): Plugin {
  return {
    name: "map-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://x");
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        const body = async () => {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          return Buffer.concat(chunks);
        };
        try {
          if (url.pathname === "/api/map-grid") {
            if (req.method === "GET") {
              try { return send(200, JSON.parse(await readFile(GRID_FILE, "utf8"))); }
              catch { return send(404, { error: "data/map-grid.json does not exist yet" }); }
            }
            if (req.method === "PUT") {
              const grid = JSON.parse((await body()).toString("utf8"));
              await mkdir(path.dirname(GRID_FILE), { recursive: true });
              await writeFile(GRID_FILE, JSON.stringify(grid, null, 2) + "\n");
              return send(200, { saved: "data/map-grid.json" });
            }
          }
          if (url.pathname === "/api/map-images") {
            if (req.method === "GET") {
              const files = (await readdir(MAP_DIR).catch(() => [])).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
              return send(200, files.map((f) => `assets/map/${f}`));
            }
            if (req.method === "POST") {
              const name = path.basename(url.searchParams.get("name") ?? "");
              if (!/\.(png|jpe?g|webp)$/i.test(name)) return send(400, { error: "Accepted formats: PNG, JPEG or WebP" });
              await mkdir(MAP_DIR, { recursive: true });
              await writeFile(path.join(MAP_DIR, name), await body());
              return send(200, { saved: `assets/map/${name}` });
            }
          }
        } catch (e) {
          return send(500, { error: String(e) });
        }
        next();
      });
    },
  };
}
