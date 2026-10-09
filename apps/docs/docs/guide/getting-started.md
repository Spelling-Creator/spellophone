# Getting started

Spellophone is [espeak-ng](https://github.com/espeak-ng/espeak-ng) compiled to
WebAssembly, with a small TypeScript API on top. It synthesizes speech and
transcribes text to phonemes, entirely on the device running it.

## Install

```bash
pnpm add @spelling-creator/spellophone
```

The package is ESM only and needs Node.js 24 or later, or any browser that
supports WebAssembly and `DecompressionStream` (every current one).

## Node.js

```ts
import { writeFile } from "node:fs/promises";
import { createEspeak, encodeWav } from "@spelling-creator/spellophone";

const espeak = await createEspeak();

espeak.setVoice("en-us");
console.log(espeak.phonemes("hello world")); // həlˈoʊ wˈɜːld

const result = espeak.synthesize("Hello world.");
await writeFile("hello.wav", encodeWav(result.samples, result.sampleRate));
```

Every language in espeak-ng works out of the box. Dictionaries are read from
the package's data directory the first time a voice needs them.

[More about Node.js](./node.md)

## Browsers

The browser build fetches its data over HTTP. Tell it where the data is: either
a copy of the package's `espeak-ng-data` directory that you host, or the
jsDelivr CDN.

```ts
import { createEspeak, toFloat32 } from "@spelling-creator/spellophone";

const espeak = await createEspeak({ cdn: "jsdelivr" });

espeak.setVoice("en-us");
const result = espeak.synthesize("Hello from the browser.");

const context = new AudioContext();
const buffer = context.createBuffer(
  1,
  result.samples.length,
  result.sampleRate,
);
buffer.copyToChannel(toFloat32(result.samples), 0);
const source = context.createBufferSource();
source.buffer = buffer;
source.connect(context.destination);
source.start();
```

The `@spelling-creator/spellophone` import resolves to the Node build under Node.js and to the
browser build everywhere else. You can also import `@spelling-creator/spellophone/node` or
`@spelling-creator/spellophone/browser` explicitly.

[More about browsers, bundlers and workers](./browser.md)

## What you get back

`synthesize` returns 16-bit mono PCM samples, the sample rate (22050 Hz) and the
events espeak-ng raised while speaking: where each word starts, in the text and
in the audio, SSML marks, sentence ends and optionally every phoneme.

`phonemes` returns a string: IPA by default, or espeak-ng's own ASCII phoneme
names with `{ ipa: false }`.

[Events, SSML and phonemes](./speech.md)

## Examples

The repository has two runnable examples:

- `examples/node`: writes a WAV file and prints phonemes and word timings.
- `examples/browser`: a Vite page with voice selection, playback through the
  Web Audio API and a WAV download. It self-hosts the data in development and
  switches to jsDelivr with `?cdn` in the URL.

```bash
pnpm example:node
pnpm example:browser
```
