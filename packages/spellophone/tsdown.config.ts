import { readFileSync } from "node:fs";
import type { UserConfig } from "tsdown";
import { defineConfig } from "tsdown";
import { swcEs5 } from "./scripts/swc-es5.ts";

const pkg: { version: string } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

const define = {
  __SPELLOPHONE_VERSION__: JSON.stringify(pkg.version),
};

const config: UserConfig[] = defineConfig([
  {
    entry: {
      core: "src/core.ts",
      node: "src/node.ts",
      browser: "src/browser.ts",
      wasm2js: "src/wasm2js.ts",
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
        // bundlers in consuming apps (Vite and friends) pick that up as an
        // asset reference. dist/*.js import it as ../wasm/espeak-ng.js, which
        // is also where it lives in the published package. The wasm2js files
        // stay there too rather than being copied into dist.
        /\/wasm\/espeak-ng(\.legacy(\.wasm)?)?\.js$/,
        // Only src/node.ts imports these; the platform is neutral so the browser
        // entry does not get Node shims.
        /^node:/,
      ],
    },
    define,
    publint: true,
  },
  {
    // The legacy build: one self-contained ES5 file per format, with the
    // wasm2js module, fflate and the core-js polyfills it needs bundled in.
    name: "legacy",
    entry: { spellophone: "src/legacy.ts" },
    outDir: "dist/legacy",
    format: ["esm", "iife"],
    globalName: "Spellophone",
    platform: "browser",
    // swc lowers and minifies (see scripts/swc-es5.ts). Rolldown's default
    // minify would reprint swc's output, so it is off.
    target: false,
    minify: false,
    dts: false,
    // No source maps: they would be over 5 MB each, mostly the wasm2js
    // module repeated, in every install of the package.
    sourcemap: false,
    clean: true,
    define,
    plugins: [swcEs5()],
    outputOptions: {
      // One file per format, with nothing split out.
      codeSplitting: false,
      // Rolldown's own wrappers in ES5, and no Symbol.toStringTag on the
      // exports object: that runs before the Symbol polyfill does.
      generatedCode: { preset: "es5", symbols: false },
    },
    deps: { onlyBundle: ["core-js", "fflate"] },
  },
  {
    // The legacy build's declarations, on their own: built in the same bundle
    // as the code, they would make rolldown split it into several chunks.
    name: "legacy",
    entry: { spellophone: "src/legacy.ts" },
    outDir: "dist/legacy",
    format: "esm",
    platform: "browser",
    dts: { emitDtsOnly: true },
    clean: true,
    define,
  },
]);

export default config;
