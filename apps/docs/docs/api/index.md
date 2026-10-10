# API reference

Everything below is exported from `@spelling-creator/spellophone`, `@spelling-creator/spellophone/node` and
`@spelling-creator/spellophone/browser`. The two entry points differ only in their
`createEspeak` options; the rest is shared.

## `createEspeak(options?)`

Loads the wasm module and the data and returns a ready `Espeak`.

**Node.js** (`@spelling-creator/spellophone/node`):

```ts
function createEspeak(options?: {
  data?: string; // data directory, default: the package's
  wasm?: string; // wasm file, default: the package's
  languages?: string[] | "all"; // preload these dictionaries
  phonemeEvents?: boolean | "ipa";
}): Promise<Espeak>;
```

**Browsers** (`@spelling-creator/spellophone/browser`):

```ts
function createEspeak(options?: {
  dataUrl?: string | URL; // directory holding manifest.json
  cdn?: "jsdelivr"; // or fetch the data from jsDelivr
  wasmUrl?: string | URL;
  fallback?: () => Promise<Wasm2jsFallback>; // used where WebAssembly is blocked
  languages?: string[] | "all"; // dictionaries to fetch, default ["en"]
  phonemeEvents?: boolean | "ipa";
  fetch?: typeof fetch;
}): Promise<Espeak>;
```

One of `dataUrl` or `cdn` is required in browsers. `fallback` is normally
`() => import("@spelling-creator/spellophone/wasm2js")`; see
[Without WebAssembly](../guide/without-wasm.md).

**Legacy build** (`@spelling-creator/spellophone/legacy`, or the
`Spellophone` global of `dist/legacy/spellophone.iife.js`): the browser options
without `wasmUrl` and `fallback`. It runs without WebAssembly and in ES5
engines.

## `Espeak`

A synchronous espeak-ng instance. Not thread-safe; one per worker.

### Properties

| Property     | Type                          | Description                                  |
| ------------ | ----------------------------- | -------------------------------------------- |
| `version`    | `string`                      | espeak-ng's version, such as `1.52.0`        |
| `sampleRate` | `number`                      | Samples per second of synthesized audio      |
| `voice`      | `{ name, languages } \| null` | The selected voice                           |
| `module`     | `EspeakModule`                | The underlying Emscripten module             |
| `dataPath`   | `string`                      | Where the data is in the virtual file system |

### `listVoices(): Voice[]`

Every voice in the data, loaded or not.

```ts
interface Voice {
  name: string; // "English (America)"
  identifier: string; // "gmw/en-US"
  languages: { priority: number; name: string }[]; // [{ 2, "en-us" }, ...]
  gender?: "male" | "female";
  age?: number;
}
```

### `setVoice(selector): void`

Selects a voice by name or language tag (`"en-us"`, `"de"`, `"en-us+f3"`) or by
properties:

```ts
interface VoiceSelector {
  name?: string;
  language?: string;
  gender?: "male" | "female";
  age?: number;
  variant?: number;
}
```

Throws `EspeakError` if nothing matches, and `DictionaryNotLoadedError` if the
voice needs a dictionary that is not loaded and cannot be read synchronously
(browsers). In Node.js the dictionary is read from disk on the spot.

### `loadVoice(selector): Promise<void>`

Like `setVoice`, but fetches a missing dictionary first.

### `synthesize(text, options?): SynthesisResult`

```ts
interface SynthesizeOptions {
  voice?: string | VoiceSelector; // switch voice first (stays selected)
  rate?: number; // 80 to 450 wpm, this call only
  pitch?: number; // 0 to 99, this call only
  range?: number; // 0 to 99, this call only
  volume?: number; // 0 to 200, this call only
  wordGap?: number; // 10 ms units, this call only
  ssml?: boolean; // parse the text as SSML
  phonemes?: boolean; // allow [[ ]] phoneme input
  endPause?: boolean; // add a trailing sentence pause
}

interface SynthesisResult {
  samples: Int16Array; // 16-bit mono PCM
  sampleRate: number;
  duration: number; // seconds
  events: SpeechEvent[];
}
```

See [Events, SSML and phonemes](../guide/speech.md) for `SpeechEvent`.

### `phonemes(text, options?): string`

Transcribes text. Clauses are separated by `\n`.

```ts
interface PhonemesOptions {
  voice?: string | VoiceSelector;
  ipa?: boolean; // default true; false gives espeak-ng's ASCII names
  separator?: string; // character to put between phonemes
  tie?: boolean; // use separator as a tie inside multi-letter phonemes
}
```

### `getParameter(name, current?)` and `setParameter(name, value, relative?)`

Read or set a parameter for all later calls. `current: false` returns the
default instead of the current value. `relative: true` adds `value` to the
current one.

```ts
type Parameter =
  | "rate" // 80 to 450 wpm, default 175
  | "volume" // 0 to 200, default 100
  | "pitch" // 0 to 99, default 50
  | "range" // 0 to 99, default 50
  | "punctuation" // 0 none, 1 all, 2 some
  | "capitals" // 0 none, 1 sound icon, 2 spelling, 3+ raise pitch
  | "wordGap"; // 10 ms units
```

### `loadLanguages(languages): Promise<void>`

Fetches the dictionaries for these languages.

### `loadedLanguages(): string[]` and `availableLanguages(): string[]`

Which dictionaries are ready, and which the data source can provide.

### `dispose(): void`

Shuts espeak-ng down and frees its buffers. The instance is unusable afterwards.

## Helpers

### `encodeWav(samples, sampleRate): Uint8Array`

A WAV file (RIFF, 16-bit PCM, mono) for the samples.

### `toFloat32(samples): Float32Array`

The samples scaled to the -1 to 1 range the Web Audio API uses.

### `canCompileWasm(): boolean`

Whether this engine can compile WebAssembly. False where there is no
`WebAssembly` object or a Content-Security-Policy forbids compiling. Exported
from the browser entry point; `createEspeak` uses it to decide on the
`fallback`.

### `jsdelivrDataUrl(version): string`

The jsDelivr URL of the data directory for a package version.

### `VERSION`

This package's version.

## Errors

### `EspeakError`

Thrown when espeak-ng reports a failure. `code` is the underlying
`espeak_ERROR` or `espeak_ng_STATUS` value.

### `DictionaryNotLoadedError`

Extends `EspeakError`. `language` names the dictionary to load; call
`loadLanguages([error.language])` and retry, or use `loadVoice`.
