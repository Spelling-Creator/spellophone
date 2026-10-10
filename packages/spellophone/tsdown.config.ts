import { readFileSync } from "node:fs";
import type { UserConfig } from "tsdown";
import { defineConfig } from "tsdown";

const pkg: { version: string } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

const config: UserConfig = defineConfig({
  entry: {
    core: "src/core.ts",
    node: "src/node.ts",
    browser: "src/browser.ts",
  },
  format: "esm",
  platform: "neutral",
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  deps: {
    neverBundle: [
      // The Emscripten glue stays a separate file next to the wasm it loads:
      // it locates espeak-ng.wasm relative to its own import.meta.url, and
      // bundlers in consuming apps (Vite and friends) pick that up as an asset
      // reference. dist/*.js import it as ../wasm/espeak-ng.js, which is also
      // where it lives in the published package.
      /\/wasm\/espeak-ng\.js$/,
      // Only src/node.ts imports these; the platform is neutral so the browser
      // entry does not get Node shims.
      /^node:/,
    ],
  },
  define: {
    __SPELLOPHONE_VERSION__: JSON.stringify(pkg.version),
  },
  publint: true,
});

export default config;
