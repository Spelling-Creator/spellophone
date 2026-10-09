# Node.js

```ts
import { createEspeak } from "@spelling-creator/spellophone";
// or, explicitly:
import { createEspeak } from "@spelling-creator/spellophone/node";
```

`createEspeak` loads the wasm module and the core data, then returns an
[`Espeak`](../api/index.md#espeak) instance. Everything on the instance is
synchronous after that.

## Options

```ts
const espeak = await createEspeak({
  // Preload these dictionaries. Everything else still loads on demand.
  languages: ["en", "de"],
  // Emit a phoneme event per phoneme during synthesis: true or "ipa".
  phonemeEvents: "ipa",
  // Use a data directory other than the one in the package.
  data: "/srv/espeak-ng-data",
  // Use a wasm file other than the one in the package.
  wasm: "/srv/espeak-ng.wasm",
});
```

## Dictionaries load on demand

espeak-ng needs a per-language dictionary before it can speak or transcribe a
language. In Node.js these are read from disk, synchronously, the first time a
voice asks for one, so `setVoice("de")` just works. `languages` lets you pay
that cost at startup instead, and `"all"` preloads every language (about 19 MB
of memory).

## Writing audio files

`encodeWav` turns the samples into a WAV file, the same output `espeak-ng -w`
produces:

```ts
import { writeFile } from "node:fs/promises";
import { createEspeak, encodeWav } from "@spelling-creator/spellophone";

const espeak = await createEspeak();
const { samples, sampleRate } = espeak.synthesize("Good morning.", {
  voice: "en-gb",
});
await writeFile("morning.wav", encodeWav(samples, sampleRate));
```

For other formats, hand the raw PCM to an encoder. The samples are signed
16-bit, mono, little-endian in memory, at `espeak.sampleRate` Hz.

## Threads

An `Espeak` instance is synchronous and single-threaded, which is how espeak-ng
itself works. Synthesis of a sentence takes a few milliseconds, so this is
rarely a problem. If it is, create one instance per worker thread with
`node:worker_threads`; instances do not share state.

## Where the files live

The package ships three things the Node build reads at run time:

| Path                  | Contents                                         |
| --------------------- | ------------------------------------------------ |
| `wasm/espeak-ng.wasm` | espeak-ng compiled to WebAssembly                |
| `wasm/espeak-ng.js`   | The Emscripten glue that loads it                |
| `espeak-ng-data/`     | The compiled data, gzipped, plus `manifest.json` |

If you bundle a Node application, keep those files next to the bundle or point
`createEspeak` at them with the `data` and `wasm` options.
