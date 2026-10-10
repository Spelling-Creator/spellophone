# Without WebAssembly

espeak-ng normally runs as WebAssembly. For the places where that is not an
option, the package also ships it compiled to plain JavaScript by
[Binaryen](https://github.com/WebAssembly/binaryen)'s `wasm2js`. It has the
same API and gives the same results. Startup takes about as long, and
synthesis is about seven times slower (a sentence takes around 12 ms instead
of 2 ms in V8), which is still fast enough for most uses.

There are two ways to use it:

| You need to support                                                 | Use                                      |
| ------------------------------------------------------------------- | ---------------------------------------- |
| Current browsers where WebAssembly may be blocked                   | The `fallback` option of the browser API |
| Old browsers without WebAssembly or modern JavaScript (ES5 engines) | The legacy build                         |

## Falling back when WebAssembly is blocked

Some current browsers turn WebAssembly off:

- Safari in Lockdown Mode.
- Any page whose Content-Security-Policy has a `script-src` without
  `'wasm-unsafe-eval'` (or `'unsafe-eval'`).
- Some managed or embedded WebViews.

Pass `fallback` to `createEspeak` and the wasm2js module takes over there:

```ts
import { createEspeak } from "@spelling-creator/spellophone/browser";

const espeak = await createEspeak({
  cdn: "jsdelivr",
  fallback: () => import("@spelling-creator/spellophone/wasm2js"),
});
```

The dynamic `import()` matters. Bundlers put the wasm2js module (about 740 kB
minified, 230 kB gzipped) in a chunk of its own, and the browser only fetches
it when it is used. Everywhere else nothing changes: the `.wasm` file loads
as usual and the chunk is never requested.

The fallback is used only when WebAssembly cannot be compiled at all.
`createEspeak` checks that up front by compiling an empty module, and logs a
warning when it falls back. Any other failure, such as a `.wasm` file that
returns 404, still throws, so a broken deployment does not quietly run on the
slower engine. `canCompileWasm()` returns the result of that check if you
want it yourself. The check runs once per page: under a Content-Security-Policy
each refused compile also sends a violation report.

## The legacy build

For browsers that are too old for the regular build, there is a separate
build lowered to ES5. It targets what Internet Explorer 11 supports, the
oldest engine still found in the wild, and is tested by running it in a
JavaScript context with everything IE 11 lacks removed. It contains:

- The wasm2js module in place of WebAssembly.
- Lowered to ES5 syntax by [swc](https://swc.rs).
- The [core-js](https://github.com/zloirock/core-js) polyfills for the
  built-ins it uses (`Promise`, `Map`, typed array methods, `Math.imul` and
  so on), included only where IE 11 lacks them.
- [fflate](https://github.com/101arrowz/fflate) to decompress the data where
  `DecompressionStream` is missing, and `XMLHttpRequest` where `fetch` is.

All of that is in one self-contained file, about 860 kB minified and 280 kB
gzipped. It has the browser API, minus `wasmUrl` and `fallback`.

The polyfills install themselves globally, as polyfills do. Only load the
legacy build where you need it.

### With a script tag

`dist/legacy/spellophone.iife.js` is a classic script that defines a
`Spellophone` global. Copy it from the package to your static files:

```html
<script src="/js/spellophone.iife.js"></script>
<script>
  Spellophone.createEspeak({ dataUrl: "/espeak-ng-data/" }).then(
    function (espeak) {
      espeak.setVoice("en-us");
      console.log(espeak.phonemes("hello world"));
    },
  );
</script>
```

The data is fetched the same way as in the regular browser build: host a copy
of the package's `espeak-ng-data` directory and pass `dataUrl`, or pass
`cdn: "jsdelivr"`.

### With a bundler

`@spelling-creator/spellophone/legacy` is the same build as an ES module, for
apps that bundle for old browsers. Bundlers usually do not transpile
`node_modules`, which is why it is already ES5 apart from its `export`
statement.

```ts
import { createEspeak } from "@spelling-creator/spellophone/legacy";

const espeak = await createEspeak({ dataUrl: "/espeak-ng-data/" });
```
