import { readFile, readFileSync } from "node:fs";
import { promisify } from "node:util";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzip, gunzipSync } from "node:zlib";
import createEspeakModule from "../wasm/espeak-ng.js";
import type { DataSource, EspeakOptions } from "./core.ts";
import {
  DataLoader,
  DEFAULT_LANGUAGE,
  Espeak,
  moduleFactoryOptions,
} from "./core.ts";
import type { DataManifest } from "./manifest.ts";

export * from "./core.ts";

const readFileAsync = promisify(readFile);
const gunzipAsync = promisify(gunzip);

export interface NodeEspeakOptions extends Omit<
  EspeakOptions,
  "loader" | "dataPath"
> {
  /**
   * Directory holding `manifest.json` and the packed data files. Defaults to
   * the `espeak-ng-data` directory shipped in this package.
   */
  data?: string;
  /** Path of `espeak-ng.wasm`. Defaults to the one shipped in this package. */
  wasm?: string;
  /**
   * Dictionaries to load up front. Any other language is still loaded the
   * first time a voice needs it, synchronously from disk, so this is only
   * a way to move that cost to startup.
   */
  languages?: string[] | "all";
}

/** The data directory this package ships. */
export const DATA_DIR: string = fileURLToPath(
  new URL("../espeak-ng-data/", import.meta.url),
);

/**
 * A `DataSource` reading the packed data files from a directory on disk.
 */
export function fileDataSource(dir: string = DATA_DIR): DataSource {
  const manifest = JSON.parse(
    readFileSync(join(dir, "manifest.json"), "utf8"),
  ) as DataManifest;
  const gzip = manifest.encoding === "gzip";
  return {
    manifest,
    read: async (file) => {
      const bytes = await readFileAsync(join(dir, file));
      return gzip
        ? new Uint8Array(await gunzipAsync(bytes))
        : new Uint8Array(bytes);
    },
    readSync: (file) => {
      const bytes = readFileSync(join(dir, file));
      return gzip ? new Uint8Array(gunzipSync(bytes)) : new Uint8Array(bytes);
    },
  };
}

/**
 * Creates a ready-to-use espeak-ng instance for Node.js.
 *
 * Dictionaries are read from disk the first time a voice needs them, so every
 * language in espeak-ng-data works without configuration.
 */
export async function createEspeak(
  options: NodeEspeakOptions = {},
): Promise<Espeak> {
  const source = fileDataSource(options.data ?? DATA_DIR);
  const module = await createEspeakModule(moduleFactoryOptions(options.wasm));

  const loader = new DataLoader(module, source);
  await loader.loadCore();
  const languages =
    options.languages === "all"
      ? loader.availableLanguages()
      : [DEFAULT_LANGUAGE, ...(options.languages ?? [])];
  await Promise.all(languages.map((lang) => loader.loadDictionary(lang)));

  const espeakOptions: EspeakOptions = { loader };
  if (options.phonemeEvents !== undefined)
    espeakOptions.phonemeEvents = options.phonemeEvents;
  return Espeak.create(module, espeakOptions);
}
