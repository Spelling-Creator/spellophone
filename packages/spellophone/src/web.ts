// What the browser and legacy entry points share: their options, where the
// data comes from, and how an instance is put together once the module and
// the data source are on their way.

import type {
  DataSource,
  EspeakModule,
  EspeakOptions,
  ModuleFactoryOptions,
} from "./core.ts";
import {
  DataLoader,
  DEFAULT_LANGUAGE,
  Espeak,
  jsdelivrDataUrl,
  VERSION,
} from "./core.ts";

/** What `import("@spelling-creator/spellophone/wasm2js")` resolves to. */
export interface Wasm2jsFallback {
  createWasm2jsModule(options?: ModuleFactoryOptions): Promise<EspeakModule>;
}

let wasmCompiles: boolean | undefined;

/**
 * Whether this engine can compile WebAssembly. Compiling the smallest valid
 * module answers that without a network request: it fails when there is no
 * `WebAssembly` object and when a Content-Security-Policy forbids it. A CSP
 * refusal also sends a violation report, so the answer is worked out once
 * and remembered; neither a page's CSP nor Lockdown Mode changes while it is
 * open.
 */
export function canCompileWasm(): boolean {
  if (wasmCompiles === undefined) {
    try {
      const empty = Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0);
      wasmCompiles =
        new WebAssembly.Module(empty) instanceof WebAssembly.Module;
    } catch {
      wasmCompiles = false;
    }
  }
  return wasmCompiles;
}

export interface BrowserEspeakOptions extends Omit<
  EspeakOptions,
  "loader" | "dataPath"
> {
  /**
   * URL of the directory holding `manifest.json` and the packed data files:
   * copy this package's `espeak-ng-data` directory to your static assets and
   * point here. Either this or `cdn` is required.
   */
  dataUrl?: string | URL;
  /**
   * Fetch the data from a CDN instead of hosting it: `"jsdelivr"` serves the
   * data from this version of the npm package, from
   * https://cdn.jsdelivr.net/npm/@spelling-creator/spellophone@<version>/...
   */
  cdn?: "jsdelivr";
  /**
   * URL of `espeak-ng.wasm`. By default the glue module resolves it next to
   * itself with `import.meta.url`, which bundlers such as Vite turn into an
   * emitted asset, so this is only needed for unusual setups.
   */
  wasmUrl?: string | URL;
  /**
   * Loads the wasm2js module when WebAssembly is missing or blocked, as in
   * iOS Lockdown Mode or under a Content-Security-Policy without
   * `wasm-unsafe-eval`. Pass
   * `() => import("@spelling-creator/spellophone/wasm2js")`; the dynamic
   * import keeps the large module out of the way until it is needed.
   */
  fallback?: () => Promise<Wasm2jsFallback>;
  /**
   * Dictionaries to fetch before the instance is returned. English is always
   * included. Default `["en"]`; `"all"` fetches every language (about 7 MB
   * compressed). Others can be added later with `Espeak.loadLanguages`.
   */
  languages?: string[] | "all";
  /** Custom fetch, for credentials, caching or tests. */
  fetch?: typeof fetch;
}

/** Resolves where the data comes from, given the options. */
export function resolveDataUrl(options: BrowserEspeakOptions): string {
  if (options.dataUrl !== undefined) return String(options.dataUrl);
  if (options.cdn === "jsdelivr") return jsdelivrDataUrl(VERSION);
  throw new Error(
    "spellophone needs to know where espeak-ng-data is: pass { dataUrl } pointing at a copy of the package's espeak-ng-data directory, or { cdn: 'jsdelivr' } to fetch it from jsDelivr.",
  );
}

/**
 * Waits for the module and the data source, fetches the core data and the
 * requested dictionaries, and initializes espeak-ng.
 */
export async function createWebEspeak(
  modulePromise: Promise<EspeakModule>,
  sourcePromise: Promise<DataSource>,
  options: BrowserEspeakOptions,
): Promise<Espeak> {
  const [module, source] = await Promise.all([modulePromise, sourcePromise]);

  const loader = new DataLoader(module, source);
  const languages =
    options.languages === "all"
      ? loader.availableLanguages()
      : [...new Set([DEFAULT_LANGUAGE, ...(options.languages ?? [])])];
  await Promise.all([
    loader.loadCore(),
    ...languages.map((lang) => loader.loadDictionary(lang)),
  ]);

  const espeakOptions: EspeakOptions = { loader };
  if (options.phonemeEvents !== undefined)
    espeakOptions.phonemeEvents = options.phonemeEvents;
  return Espeak.create(module, espeakOptions);
}
