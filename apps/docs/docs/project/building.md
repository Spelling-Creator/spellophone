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
   `wasm/espeak-ng.wasm` and `wasm/espeak-ng.d.ts`. See `scripts/build-wasm.ts`.
3. **`build:ts`** bundles `src/` into `dist/` with tsdown, with declarations.

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
