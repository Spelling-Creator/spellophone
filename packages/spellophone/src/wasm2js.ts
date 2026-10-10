// espeak-ng compiled to plain JavaScript by Binaryen's wasm2js, for engines
// where WebAssembly is missing or blocked. The browser entry point loads this
// through its `fallback` option, and the legacy build is built on it.

import type { InstantiateWasm } from "../wasm/espeak-ng.legacy.js";
import createEspeakModule from "../wasm/espeak-ng.legacy.js";
import instantiate from "../wasm/espeak-ng.legacy.wasm.js";
import type { EspeakModule, ModuleFactoryOptions } from "./core.ts";
import { moduleFactoryOptions } from "./core.ts";

/** Hands the glue the wasm2js exports where it expects a wasm instance. */
const instantiateWasm: InstantiateWasm = (imports, receiveInstance) => {
  receiveInstance({ exports: instantiate(imports) });
  return {};
};

/**
 * Instantiates the module without WebAssembly. It has the same functions as
 * the wasm module and works with `DataLoader` and `Espeak.create` the same
 * way, with synthesis about seven times slower. `locateFile` is ignored:
 * there is no file to locate.
 */
export function createWasm2jsModule(
  options: ModuleFactoryOptions = moduleFactoryOptions(),
): Promise<EspeakModule> {
  const { printErr } = options;
  return createEspeakModule(
    printErr ? { instantiateWasm, printErr } : { instantiateWasm },
  );
}
