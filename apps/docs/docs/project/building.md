# Building from source

The repository is a pnpm workspace:

| Path                   | What                                                     |
| ---------------------- | -------------------------------------------------------- |
| `packages/spellophone` | The library: C glue, wasm build, TypeScript, data packer |
| `apps/docs`            | This documentation site (VitePress)                      |
| `examples/node`        | Node.js example                                          |
| `examples/browser`     | Vite browser example                                     |
| `vendor/`              | The pinned espeak-ng version (fetched, not committed)    |

## Working on the TypeScript

The compiled wasm and data are committed, so this needs only Node.js 24+ and
pnpm:

```bash
pnpm install
pnpm --filter @spelling-creator/spellophone build:ts   # tsdown
pnpm test
pnpm typecheck
pnpm fmt && pnpm lint                                  # oxfmt and oxlint
```

## Rebuilding the wasm and data

Needed when bumping espeak-ng or changing `native/glue.c`. Prerequisites:

- [Emscripten](https://emscripten.org/) (`emcc`, `emcmake`)
- CMake and a host C/C++ compiler (clang or gcc), for the native espeak-ng
  build that compiles the dictionaries
- git

`mise.toml` pins everything, so with [mise](https://mise.jdx.dev/) it is one
command:

```bash
mise install
```

Then:

```bash
pnpm fetch:espeak      # clones espeak-ng at the tag in vendor/espeak-ng.json
pnpm build             # build:data, build:wasm, build:ts
```

The three steps, and what they produce:

1. **`build:data`** configures espeak-ng's own CMake project natively in
   `build/native`, builds its `data` target (which runs the espeak-ng CLI to
   compile `dictsource/` and `phsource/`), then packs the result into
   `packages/spellophone/espeak-ng-data/` as gzipped files plus
   `manifest.json`. See `scripts/build-data.ts` and `scripts/pack-data.ts`.
2. **`build:wasm`** configures `packages/spellophone/native/CMakeLists.txt`
   with `emcmake` in `build/wasm` and builds `wasm/espeak-ng.js`,
   `wasm/espeak-ng.wasm` and `wasm/espeak-ng.d.ts`, plus the wasm2js module
   (`wasm/espeak-ng.legacy.js` and `wasm/espeak-ng.legacy.wasm.js`, see
   below). See `scripts/build-wasm.ts`.
3. **`build:ts`** bundles `src/` into `dist/` with tsdown, with declarations,
   and builds the ES5 legacy build into `dist/legacy/`.

Commit the updated `wasm/` and `espeak-ng-data/` with the change that caused
them. CI rebuilds both and fails if they differ from what is committed, so a
stale artifact cannot slip into a release.

## How the wasm build works

`native/CMakeLists.txt` compiles the espeak-ng library sources (plus its
bundled `ucd-tools` and `speechPlayer`) directly, rather than through
espeak-ng's own CMake project, which also wants to build the CLI, fetch libsonic
from GitHub and run the data compiler. Features that cannot work in wasm are
off: async mode (threads), MBROLA (spawns a process), libpcaudio (sound
device) and libsonic (not needed at normal rates).

`native/glue.c` is the only C written for this project. It exports a flat set
of `sp_*` functions: initialize, synthesize into growable buffers, read the
buffers back, list and select voices, set parameters, text to phonemes. Audio
and events are collected in C during the synchronous `espeak_Synth` call and
copied out afterwards, so the JavaScript side needs no callbacks.

`native/include/wchar.h` is a shim around espeak-ng's compat header for musl,
Emscripten's libc. espeak-ng redefines `iswalpha()` and friends as macros for
its own Unicode-aware versions, and musl's `<wchar.h>` then redeclares the
same names, which the macros rewrite into conflicting prototypes. The shim
lifts the macros while the system headers are read and restores them after.

Emscripten options that matter (all in the CMake file):

- `MODULARIZE` and `EXPORT_ES6`: the glue is an ES module exporting a factory.
- `ENVIRONMENT=web,worker,node`: one glue file for every runtime.
- `FORCE_FILESYSTEM`: espeak-ng reads its data with `fopen`, from MEMFS.
- `ALLOW_MEMORY_GROWTH` and a 1 MB stack: espeak-ng keeps large buffers on
  the stack.
- `--emit-tsd`: generates the module's TypeScript declarations.

## The wasm2js module and the legacy build

The same program is linked a second time, as the `spellophone-legacy` target,
for engines without WebAssembly (see
[Without WebAssembly](../guide/without-wasm.md)). That link still produces a
`.wasm` file. `scripts/build-wasm.ts` then runs Binaryen's standalone
`wasm2js`, which ships with the emsdk, to turn it into JavaScript, and
`src/wasm2js.ts` hands the result to the Emscripten glue through its
`instantiateWasm` hook, so the glue never touches `WebAssembly`.

Emscripten can do this itself with `-sWASM=0`, but that setting is deprecated
and may be removed, while the standalone `wasm2js` tool is staying. The
legacy link differs from the main one in these options:

- No `EXPORT_ES6`: that glue would locate the `.wasm` with
  `import.meta.url`, which bundlers then try to emit as an asset and which ES5
  cannot express. `native/legacy-prefix.js` and `native/legacy-export.js`
  (passed with `--extern-pre-js` and `--extern-post-js`) make it an ES module
  anyway, keep Emscripten's CommonJS/AMD export block from running, and give
  `abort()` the `WebAssembly.RuntimeError` it throws, which is plain `Error`
  as in Emscripten's own wasm2js mode.
- `ENVIRONMENT=web,worker`: no `node:` imports.
- `WASM_BIGINT=0`: 64-bit values cross between JavaScript and wasm as pairs
  of numbers. ES5 has no BigInt and `wasm2js` cannot produce it. Emscripten
  marks this deprecated too, because only `-sWASM=0` is meant to need it, so
  the legacy link prints a warning about it. That warning is expected. It is
  not silenced, since `-Wno-deprecated` would hide every other deprecated
  setting as well.
- `TEXTDECODER=1`: falls back to plain JavaScript where `TextDecoder` is
  missing.
- `DYNAMIC_EXECUTION=0`: no `eval`, so a strict Content-Security-Policy is
  fine.

`wasm2js` is given the features the module was compiled with (bulk memory,
saturating float-to-int conversions, sign extension), since the optimized
binary no longer records them, and lowers them to plain JavaScript.

`dist/wasm2js.js` (the `./wasm2js` export) imports those two files as they
are. The legacy build bundles them instead: `tsdown.config.ts` builds
`src/legacy.ts` as one ES module and one IIFE, and `scripts/swc-es5.ts`
lowers it with [swc](https://swc.rs), because Oxc, which tsdown uses
otherwise, does not go below ES2015. That plugin runs twice:

1. On each module of our own, swc lowers the syntax and adds imports of the
   [core-js](https://github.com/zloirock/core-js) polyfills for the
   built-ins it uses that IE 11 lacks, which the bundler then pulls in.
2. On the finished chunk, swc lowers what the bundler added itself and
   minifies. Rolldown's own minifier is off, since it would reprint the
   result.

The legacy build has no source maps: they would be over 5 MB each, mostly
the wasm2js module repeated.

`src/legacy.test.ts` rebuilds `dist/legacy` (the tsdown configs named
`legacy`) and checks the result: both files must parse as ES5, and the IIFE
must work in a `node:vm` context with `WebAssembly`, `fetch`, `Promise`,
`Map`, `Symbol` and the other ES2015 and later built-ins IE 11 lacks
deleted.

## Patches to espeak-ng

`vendor/patches/*.patch` are applied to the checkout by `pnpm fetch:espeak`
(idempotently, so running it again is safe). Keep them few and small; each
one is a candidate to send upstream.

- `0001-deterministic-dictionary-compile.patch`: the dictionary compiler
  sorts rules with `qsort`, whose order for tied entries depends on the C
  library, so the same sources compiled to different bytes on macOS and
  Linux. The patch makes both sorts stable. Without it the reproducibility
  check in CI cannot pass for a build made on a Mac.

To change a patch, edit the files in `vendor/espeak-ng`, then regenerate it
with `git -C vendor/espeak-ng diff > vendor/patches/<name>.patch`.

## Bumping espeak-ng

1. Change `tag` in `vendor/espeak-ng.json`.
2. `pnpm fetch:espeak && pnpm build`.
3. Run the tests. Phoneme output for a word can change between espeak-ng
   releases, so a failing assertion may just need updating.
4. Commit, including `wasm/` and `espeak-ng-data/`, and note the espeak-ng
   version in the changelog.

## Checking the browser example

```bash
pnpm example:browser
```

opens a Vite dev server. Append `?cdn` to the URL to fetch the data from
jsDelivr instead of the local copy (only works for released versions).
