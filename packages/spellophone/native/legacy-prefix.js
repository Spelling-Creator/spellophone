// Prepended to the legacy glue with --extern-pre-js (see CMakeLists.txt).

// Without EXPORT_ES6, Emscripten ends the glue with a CommonJS/AMD export
// block. This file is an ES module (legacy-export.js exports from it), so
// that block must do nothing, even where a bundler or test runner provides
// `module` and `exports`. Shadowing them here makes sure it does.
var module = void 0,
  exports = void 0,
  define = void 0;

// The glue only ever gets its exports through the instantiateWasm hook, but
// abort() still throws `new WebAssembly.RuntimeError(...)`, which would fail
// where WebAssembly does not exist and hide the real error. Emscripten's own
// wasm2js mode stands in for it the same way.
var WebAssembly = { RuntimeError: Error };
