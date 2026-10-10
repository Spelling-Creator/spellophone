import createEspeakModule from "../wasm/espeak-ng.js";
import type { Espeak, EspeakModule } from "./core.ts";
import { httpDataSource, moduleFactoryOptions } from "./core.ts";
import type { BrowserEspeakOptions } from "./web.ts";
import { canCompileWasm, createWebEspeak, resolveDataUrl } from "./web.ts";

export * from "./core.ts";
export type { BrowserEspeakOptions, Wasm2jsFallback } from "./web.ts";
export { canCompileWasm, resolveDataUrl } from "./web.ts";

async function createModule(
  options: BrowserEspeakOptions,
): Promise<EspeakModule> {
  const factoryOptions = moduleFactoryOptions(options.wasmUrl);
  if (!options.fallback || canCompileWasm()) {
    return createEspeakModule(factoryOptions);
  }
  console.warn(
    "spellophone: WebAssembly is unavailable here, using the slower wasm2js fallback.",
  );
  const { createWasm2jsModule } = await options.fallback();
  return createWasm2jsModule(factoryOptions);
}

/**
 * Creates a ready-to-use espeak-ng instance in a browser or worker.
 *
 * Fetches the core data and the requested dictionaries over HTTP. Other
 * languages can be fetched later with `Espeak.loadLanguages` or
 * `Espeak.loadVoice`.
 */
export async function createEspeak(
  options: BrowserEspeakOptions = {},
): Promise<Espeak> {
  const dataUrl = resolveDataUrl(options);
  return createWebEspeak(
    createModule(options),
    httpDataSource(dataUrl, options.fetch),
    options,
  );
}
