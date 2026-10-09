// Builds wasm/espeak-ng.{js,wasm,d.ts} from the vendored espeak-ng sources
// and native/glue.c with Emscripten (see native/CMakeLists.txt).
//
//   pnpm --filter @spelling-creator/spellophone build:wasm
//
// Requires emcmake/emcc (the emsdk) and cmake on the PATH. mise.toml pins the
// emsdk version this was developed against.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { paths, run } from "./paths.ts";

if (!existsSync(join(paths.espeakRoot, "CMakeLists.txt"))) {
  console.error("espeak-ng sources not found. Run `pnpm fetch:espeak` first.");
  process.exit(1);
}

const buildDir = join(paths.buildRoot, "wasm");

run("emcmake", [
  "cmake",
  "-S",
  paths.nativeDir,
  "-B",
  buildDir,
  "-DCMAKE_BUILD_TYPE=Release",
  `-DESPEAK_ROOT=${paths.espeakRoot}`,
  `-DSPELLOPHONE_OUTPUT_DIR=${paths.wasmDir}`,
]);
run("cmake", ["--build", buildDir, "--parallel"]);

console.log(`wasm module ready in ${paths.wasmDir}`);
