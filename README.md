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
- TypeScript, ESM only, no native addon, no server.

**Documentation: https://spellophone.spellingcreator.org/**

## Install

The package is published to GitHub Packages as `@spelling-creator/spellophone`.
Point the scope at GitHub in your `.npmrc` and install with a token that has
`read:packages`:

```ini
@spelling-creator:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

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
pnpm install
pnpm test                 # vitest
pnpm typecheck            # tsc (TypeScript 7)
pnpm fmt && pnpm lint     # oxfmt and oxlint
pnpm example:node
pnpm example:browser
pnpm dev:docs
```

The compiled wasm and data are committed, so the above needs only Node.js 24+
and pnpm. Rebuilding them from espeak-ng's sources needs the Emscripten SDK and
CMake; `mise install` provides both. See
[Building from source](https://spellophone.spellingcreator.org/project/building).

## License

[GPL-3.0-or-later](LICENSE), like espeak-ng.
