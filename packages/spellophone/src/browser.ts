import createEspeakModule from "../wasm/espeak-ng.js";
import type { EspeakOptions } from "./core.ts";
import {
  DataLoader,
  DEFAULT_LANGUAGE,
  Espeak,
  httpDataSource,
  jsdelivrDataUrl,
  moduleFactoryOptions,
  VERSION,
} from "./core.ts";

export * from "./core.ts";

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
   * repository's committed data at this version's release tag, from
   * https://cdn.jsdelivr.net/gh/Spelling-Creator/spellophone@v<version>/...
   */
  cdn?: "jsdelivr";
  /**
   * URL of `espeak-ng.wasm`. By default the glue module resolves it next to
   * itself with `import.meta.url`, which bundlers such as Vite turn into an
   * emitted asset, so this is only needed for unusual setups.
   */
  wasmUrl?: string | URL;
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

  const [module, source] = await Promise.all([
    createEspeakModule(moduleFactoryOptions(options.wasmUrl)),
    httpDataSource(dataUrl, options.fetch),
  ]);

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
