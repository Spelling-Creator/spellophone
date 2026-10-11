# Browsers and workers

```ts
import { createEspeak } from "@spelling-creator/spellophone";
// or, explicitly:
import { createEspeak } from "@spelling-creator/spellophone/browser";
```

The browser build is the same API as Node.js. The difference is where the
data comes from: it has to be fetched over HTTP, and you choose from where.

## Where the data comes from

espeak-ng needs about 725 KB of core data (voices, phoneme tables) plus one
dictionary per language, from a few KB up to 4.8 MB for Russian. Everything is
gzipped and decompressed in the browser with `DecompressionStream`, so it does
not matter whether your server compresses transfers. A server that sends the
`.gz` files with `Content-Encoding: gzip` (Vite's dev server does, for
example) works too: the browser unzips them on the way in, and the library
notices and skips its own decompression.

### Self-host it

Copy the package's `espeak-ng-data` directory to your static assets and pass
its URL:

```ts
const espeak = await createEspeak({ dataUrl: "/espeak-ng-data/" });
```

The directory is plain files, so any static host works. With Vite, a small
plugin can serve it in development and copy it into the build; the
`examples/browser` app in the repository does exactly that.

### Fetch it from jsDelivr

If you would rather not host the data, the CDN option fetches it from
[jsDelivr](https://www.jsdelivr.com/), pinned to the package version you
installed:

```ts
const espeak = await createEspeak({ cdn: "jsdelivr" });
// fetches https://cdn.jsdelivr.net/npm/@spelling-creator/spellophone@<version>/espeak-ng-data/...
```

This uses jsDelivr's npm endpoint, which serves the `espeak-ng-data`
directory of the package as published to npmjs.com. It works for published
versions, not for a local build. `jsdelivrDataUrl(version)` returns the URL if
you want to construct it yourself, and `dataUrl` accepts any other host.

## Pick the languages

Only English is fetched by default. Ask for more up front, or load them later:

```ts
const espeak = await createEspeak({
  dataUrl: "/espeak-ng-data/",
  languages: ["en", "fr", "de"],
});

// later
await espeak.loadLanguages(["es"]);
espeak.setVoice("es");

// or let loadVoice fetch whatever the voice needs
await espeak.loadVoice("pt-br");
```

`setVoice` is synchronous and throws `DictionaryNotLoadedError` if the voice
needs a dictionary that has not been fetched. `loadVoice` is the asynchronous
version that fetches it first. `languages: "all"` fetches every language, about
9 MB compressed.

## The wasm file

The Emscripten glue locates `espeak-ng.wasm` relative to itself with
`import.meta.url`. Bundlers such as Vite, Rollup and webpack 5 recognize that
pattern and emit the wasm as an asset, so there is nothing to configure. If
your setup needs the file somewhere else, pass `wasmUrl`.

## When WebAssembly is blocked

Safari in Lockdown Mode and pages with a strict Content-Security-Policy
cannot run WebAssembly. Pass a `fallback` and espeak-ng runs there as plain
JavaScript instead, about seven times slower:

```ts
const espeak = await createEspeak({
  cdn: "jsdelivr",
  fallback: () => import("@spelling-creator/spellophone/wasm2js"),
});
```

The module is only fetched where it is needed. For browsers too old for this
build altogether, there is an ES5 legacy build. Both are covered in
[Without WebAssembly](./without-wasm.md).

## Workers

Synthesis is synchronous and takes a few milliseconds per sentence. For long
texts, or to keep the main thread free while dictionaries decompress, run it in
a Web Worker. The API is the same there; the module does not touch the DOM.

```ts
// worker.ts
import { createEspeak } from "@spelling-creator/spellophone/browser";

const ready = createEspeak({ cdn: "jsdelivr" });

self.onmessage = async (event: MessageEvent<string>) => {
  const espeak = await ready;
  const { samples, sampleRate, events } = espeak.synthesize(event.data);
  self.postMessage({ samples, sampleRate, events }, [samples.buffer]);
};
```

## Playing the audio

The samples are 16-bit PCM. `toFloat32` scales them to the -1 to 1 range the
Web Audio API expects:

```ts
import { toFloat32 } from "@spelling-creator/spellophone";

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

For an `<audio>` element or a download, `encodeWav` produces a WAV file to wrap
in a `Blob`:

```ts
const wav = encodeWav(result.samples, result.sampleRate);
audioElement.src = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
```

## Options

```ts
interface BrowserEspeakOptions {
  dataUrl?: string | URL; // directory holding manifest.json
  cdn?: "jsdelivr"; // or fetch the data from jsDelivr
  wasmUrl?: string | URL; // override where espeak-ng.wasm is
  fallback?: () => Promise<Wasm2jsFallback>; // where WebAssembly is blocked
  languages?: string[] | "all"; // dictionaries to fetch up front, default ["en"]
  phonemeEvents?: boolean | "ipa";
  fetch?: typeof fetch; // custom fetch, for credentials or caching
}
```

One of `dataUrl` or `cdn` is required.
