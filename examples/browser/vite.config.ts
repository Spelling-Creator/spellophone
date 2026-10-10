import { createReadStream, existsSync, statSync } from "node:fs";
import { cp } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

// This package's espeak-ng-data directory, resolved through node_modules so
// the example works the same way an installed copy would.
const dataDir = fileURLToPath(
  new URL(
    "./node_modules/@spelling-creator/spellophone/espeak-ng-data/",
    import.meta.url,
  ),
);

/**
 * Serves spellophone's data directory at /espeak-ng-data/ during `vite dev`
 * and copies it into the build output, so the app can self-host the data.
 * Any static file server can do the same: the data is plain files.
 */
function espeakData(): Plugin {
  const prefix = "/espeak-ng-data/";
  return {
    name: "spellophone-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith(prefix)) return next();
        const file = join(dataDir, url.slice(prefix.length));
        if (
          !file.startsWith(dataDir) ||
          !existsSync(file) ||
          statSync(file).isDirectory()
        ) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader(
          "Content-Type",
          file.endsWith(".json")
            ? "application/json"
            : "application/octet-stream",
        );
        createReadStream(file).pipe(res);
      });
    },
    async closeBundle() {
      await cp(dataDir, join("dist", "espeak-ng-data"), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [espeakData()],
  build: {
    target: "es2022",
    // The wasm2js fallback chunk is about 740 kB. It is only fetched where
    // WebAssembly is blocked, so its size does not matter otherwise.
    chunkSizeWarningLimit: 800,
  },
});
