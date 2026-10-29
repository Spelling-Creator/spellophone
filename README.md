# Spellophone

[espeak-ng](https://github.com/espeak-ng/espeak-ng) text-to-speech and phoneme
transcription for Node.js and browsers, compiled to WebAssembly. Made for
[Spelling Creator](https://spellingcreator.org).

```ts
import { createEspeak, encodeWav } from "@spelling-creator/spellophone";

const espeak = await createEspeak();
espeak.setVoice("en-us");

espeak.phonemes("hello world"); // "həlˈoʊ wˈɜːld"

const { samples, sampleRate, events } = espeak.synthesize("Hello world.");
const wav = encodeWav(samples, sampleRate);
```

- Over a hundred languages, loaded on demand (a browser fetches only the
  dictionaries it uses, from your server or from jsDelivr).
- Word, sentence, mark and phoneme events with text and audio positions.
- IPA or espeak-ng phoneme output, SSML input.
- TypeScript and ES modules, no native addon, no server.
- Runs as plain JavaScript where WebAssembly is blocked, and ships an ES5
  build for old browsers, also as a classic script with a global.

**Documentation: https://spellophone.spellingcreator.org/**

## Install

```bash
pnpm add @spelling-creator/spellophone
```

See [Versioning and releases](https://spellophone.spellingcreator.org/project/releasing)
for the details, and [Getting started](https://spellophone.spellingcreator.org/guide/getting-started)
for Node.js and browser usage.

## Repository

| Path                   | Package                         | Description                        |
| ---------------------- | ------------------------------- | ---------------------------------- |
| `packages/spellophone` | `@spelling-creator/spellophone` | The library                        |
| `apps/docs`            | `@spellophone/docs`             | VitePress documentation            |
| `examples/node`        | `@spellophone/example-node`     | Writes a WAV file, prints phonemes |
| `examples/browser`     | `@spellophone/example-browser`  | Vite page with Web Audio playback  |

```bash
mise install              # Node.js, pnpm, the Emscripten SDK and CMake
pnpm install
pnpm build                # compiles the wasm and data from espeak-ng's sources
pnpm test                 # vitest
pnpm typecheck            # tsc (TypeScript 7)
pnpm fmt && pnpm lint     # oxfmt and oxlint
pnpm example:node
pnpm example:browser
pnpm dev:docs
```

The wasm and data are not in git. `pnpm build` compiles them in well under a
minute, and also needs a host C compiler. See
[Building from source](https://spellophone.spellingcreator.org/project/building).

## License

[GPL-3.0-or-later](https://github.com/Spelling-Creator/spellophone/blob/main/LICENSE), like espeak-ng.
