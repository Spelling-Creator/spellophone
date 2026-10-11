# Low-level API

`createEspeak` covers the usual cases. The pieces it is built from are
exported too, for setups where the module or the data come from somewhere
else: a custom cache, data bundled into an app, a module instantiated by your
own loader, or tests.

```ts
import {
  Espeak,
  DataLoader,
  DATA_PATH,
} from "@spelling-creator/spellophone/core";
import createEspeakModule from "@spelling-creator/spellophone/wasm/espeak-ng.js";
```

`@spelling-creator/spellophone/core` is the runtime-neutral part: no Node.js imports, no
`fetch`. It is what `@spelling-creator/spellophone/node` and `@spelling-creator/spellophone/browser` re-export.

## Putting it together

```ts
import createEspeakModule from "@spelling-creator/spellophone/wasm/espeak-ng.js";
import {
  DataLoader,
  Espeak,
  httpDataSource,
  moduleFactoryOptions,
} from "@spelling-creator/spellophone/core";

// 1. Instantiate the wasm module.
const module = await createEspeakModule(moduleFactoryOptions());

// 2. Get a data source and copy the data into the module's file system.
const source = await httpDataSource("/espeak-ng-data/");
const loader = new DataLoader(module, source);
await loader.loadCore();
await loader.loadDictionary("en"); // espeak-ng needs English to initialize

// 3. Initialize espeak-ng.
const espeak = Espeak.create(module, { loader });
```

## `DataSource`

Where the data files come from:

```ts
interface DataSource {
  manifest: DataManifest; // the parsed manifest.json
  read(file: string): Promise<Uint8Array>; // decoded bytes of a file named in it
  readSync?(file: string): Uint8Array; // optional; enables loading on demand
}
```

`read` returns decoded (decompressed) bytes. When `readSync` is present,
`Espeak.setVoice` loads a missing dictionary on the spot; without it, callers
use `loadVoice` or `loadLanguages` first.

Two implementations ship with the package:

- `httpDataSource(baseUrl, fetch?, decode?)` fetches from a URL (browsers).
  `decode` replaces the decompression step, for engines without
  `DecompressionStream`. A `.gz` file that arrives without the gzip magic
  bytes, because the server sent it with `Content-Encoding: gzip` and the
  browser already unzipped it, skips that step.
- `fileDataSource(dir?)` reads from a directory (`@spelling-creator/spellophone/node` only).

`decode(bytes, encoding)` is the decompression helper `httpDataSource` uses by
default.

## `DataLoader`

Copies files from a `DataSource` into the module's virtual file system at
`dataPath` (default `/espeak-ng-data`):

| Method                         | Description                                   |
| ------------------------------ | --------------------------------------------- |
| `loadCore()`                   | Writes everything except the dictionaries     |
| `loadDictionary(language)`     | Fetches and writes one dictionary             |
| `loadDictionarySync(language)` | Same, via `readSync`; returns false if absent |
| `hasDictionary(language)`      | Whether a dictionary is in the file system    |
| `availableLanguages()`         | Languages in the manifest                     |
| `loadedLanguages()`            | Languages whose dictionary is loaded          |

## `Espeak.create(module, options?)`

Initializes espeak-ng on an instantiated module whose file system already
holds the core data and the English dictionary.

```ts
interface EspeakOptions {
  dataPath?: string; // default "/espeak-ng-data"
  phonemeEvents?: boolean | "ipa";
  loader?: DataLoader; // enables loadVoice and loadLanguages
}
```

## `moduleFactoryOptions(wasmUrl?)`

The options the entry points pass to the module factory: an optional
`locateFile` for the wasm, and a `printErr` that drops espeak-ng's "Can't read
dictionary file" message (an expected event, since it is what triggers loading
the dictionary) while letting everything else through to `console.error`.

## The wasm2js module

`@spelling-creator/spellophone/wasm2js` exports `createWasm2jsModule(options?)`,
which returns the same module without WebAssembly: espeak-ng compiled to
JavaScript by Binaryen's `wasm2js`. It takes the same options as the wasm
factory (only `printErr` matters) and works with `DataLoader` and
`Espeak.create` the same way:

```ts
import { createWasm2jsModule } from "@spelling-creator/spellophone/wasm2js";

const module = await createWasm2jsModule(moduleFactoryOptions());
```

It is what the browser entry point's `fallback` loads, and what the legacy
build is built on. Behind it are two generated files in the package's `wasm/`
directory: `espeak-ng.legacy.js`, the Emscripten glue, and
`espeak-ng.legacy.wasm.js`, the module itself.

## The wasm module

`@spelling-creator/spellophone/wasm/espeak-ng.js` is the Emscripten-generated ES module. Its
default export is the module factory; the `MainModule` type lists the `_sp_*`
functions the C glue exports. They take and return integers and C strings and
are documented in `packages/spellophone/native/glue.c`. `Espeak.module` gives
access to them on a running instance, should you need something the wrapper
does not expose.

`EspeakModule`, the type the rest of the API takes, is `MainModule` minus
`NODEFS`, so the wasm2js module fits it too.
