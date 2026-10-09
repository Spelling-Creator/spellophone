// Compiles espeak-ng's dictionaries and phoneme data with a native host build
// of espeak-ng, then copies the result into espeak-ng-data/ and writes the
// manifest the loaders use (see pack-data.ts).
//
// espeak-ng ships its data as source (dictsource/, phsource/) and compiles it
// with its own CLI, so a native build is the only way to produce it. The wasm
// never does: it only reads the compiled files at run time.
//
//   pnpm --filter @spelling-creator/spellophone build:data
//
// Requires cmake and a C/C++ compiler on the host.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { paths, run } from "./paths.ts";
import { packData } from "./pack-data.ts";

if (!existsSync(join(paths.espeakRoot, "CMakeLists.txt"))) {
  console.error("espeak-ng sources not found. Run `pnpm fetch:espeak` first.");
  process.exit(1);
}

const buildDir = join(paths.buildRoot, "native");
mkdirSync(buildDir, { recursive: true });

run("cmake", [
  "-S",
  paths.espeakRoot,
  "-B",
  buildDir,
  "-DCMAKE_BUILD_TYPE=Release",
  "-DBUILD_TESTING=OFF",
  "-DUSE_ASYNC=OFF",
  "-DUSE_MBROLA=OFF",
  "-DUSE_LIBPCAUDIO=OFF",
  "-DUSE_LIBSONIC=OFF",
]);
run("cmake", ["--build", buildDir, "--target", "data", "--parallel"]);

// Keep an uncompressed copy next to the build tree: handy for inspecting the
// data or pointing the native espeak-ng CLI at it (ESPEAK_DATA_PATH).
const rawDir = join(paths.buildRoot, "espeak-ng-data");
rmSync(rawDir, { recursive: true, force: true });
cpSync(join(buildDir, "espeak-ng-data"), rawDir, { recursive: true });

const version = execFileSync(
  "git",
  ["-C", paths.espeakRoot, "describe", "--tags", "--always"],
  { encoding: "utf8" },
).trim();

packData(rawDir, paths.dataDir, version);
console.log(`espeak-ng-data ready in ${paths.dataDir}`);
