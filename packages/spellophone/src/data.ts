import type { MainModule } from "../wasm/espeak-ng.js";
import type { DataEncoding, DataManifest } from "./manifest.ts";

/**
 * The Emscripten module this package works with: what `wasm/espeak-ng.js`
 * produces, or the wasm2js module. Only the former has NODEFS, so it is left
 * out; `MainModule` from `wasm/espeak-ng.js` is the full type.
 */
export type EspeakModule = Omit<MainModule, "NODEFS">;

/** Where the loaders put espeak-ng-data inside the module's virtual file system. */
export const DATA_PATH = "/espeak-ng-data";

/**
 * The language espeak-ng loads while initializing. Its dictionary has to be
 * present before `sp_initialize` runs, so every loader fetches it first.
 */
export const DEFAULT_LANGUAGE = "en";

/**
 * Where the data files come from. The Node and browser entry points each
 * provide one; `Espeak.create` accepts any object with this shape, so the data
 * can also come from an in-memory cache, IndexedDB or anywhere else.
 */
export interface DataSource {
  manifest: DataManifest;
  /** Reads a file named in the manifest and returns its decoded bytes. */
  read(file: string): Promise<Uint8Array>;
  /**
   * Same as `read`, synchronously. When present, dictionaries are loaded on
   * demand the moment a voice needs one. Without it, call
   * `Espeak.loadLanguages` ahead of time.
   */
  readSync?(file: string): Uint8Array;
}

/**
 * Copies files from a `DataSource` into the module's virtual file system.
 */
export class DataLoader {
  readonly module: EspeakModule;
  readonly source: DataSource;
  readonly dataPath: string;
  readonly #pending = new Map<string, Promise<void>>();

  constructor(
    module: EspeakModule,
    source: DataSource,
    dataPath: string = DATA_PATH,
  ) {
    this.module = module;
    this.source = source;
    this.dataPath = dataPath;
  }

  /** Languages the data source has a dictionary for. */
  availableLanguages(): string[] {
    return Object.keys(this.source.manifest.dictionaries);
  }

  /** Languages whose dictionary is in the virtual file system already. */
  loadedLanguages(): string[] {
    return this.availableLanguages().filter((lang) => this.hasDictionary(lang));
  }

  hasDictionary(language: string): boolean {
    return this.module.FS.analyzePath(this.#dictionaryPath(language)).exists;
  }

  /** Writes everything except the dictionaries. Call this once, before init. */
  async loadCore(): Promise<void> {
    const { core } = this.source.manifest;
    this.#writeCore(await this.source.read(core.file));
  }

  loadCoreSync(): void {
    if (!this.source.readSync) {
      throw new Error("This data source cannot read synchronously.");
    }
    const { core } = this.source.manifest;
    this.#writeCore(this.source.readSync(core.file));
  }

  /** Fetches and writes one language's dictionary. Resolves at once if present. */
  loadDictionary(language: string): Promise<void> {
    if (this.hasDictionary(language)) return Promise.resolve();
    const pending = this.#pending.get(language);
    if (pending) return pending;
    const entry = this.#dictionaryEntry(language);
    const task = this.source
      .read(entry.file)
      .then((bytes) => {
        this.#writeFile(this.#dictionaryPath(language), bytes);
      })
      .finally(() => {
        this.#pending.delete(language);
      });
    this.#pending.set(language, task);
    return task;
  }

  /**
   * Synchronous variant for sources with `readSync`. Returns false when the
   * source cannot read synchronously, so callers can fall back to an error
   * that points at `loadDictionary`.
   */
  loadDictionarySync(language: string): boolean {
    if (this.hasDictionary(language)) return true;
    if (!this.source.readSync) return false;
    const entry = this.#dictionaryEntry(language);
    this.#writeFile(
      this.#dictionaryPath(language),
      this.source.readSync(entry.file),
    );
    return true;
  }

  #dictionaryEntry(language: string): { file: string } {
    const entry = this.source.manifest.dictionaries[language];
    if (!entry) {
      throw new Error(
        `espeak-ng has no dictionary for "${language}". Available: ${this.availableLanguages().join(", ")}`,
      );
    }
    return entry;
  }

  #dictionaryPath(language: string): string {
    return `${this.dataPath}/${language}_dict`;
  }

  #writeCore(bytes: Uint8Array): void {
    const { core } = this.source.manifest;
    if (bytes.length !== core.size) {
      throw new Error(
        `${core.file} is ${bytes.length} bytes, the manifest expects ${core.size}. The data files and manifest.json do not match.`,
      );
    }
    let offset = 0;
    for (const entry of core.entries) {
      this.#writeFile(
        `${this.dataPath}/${entry.path}`,
        bytes.subarray(offset, offset + entry.size),
      );
      offset += entry.size;
    }
  }

  #writeFile(path: string, bytes: Uint8Array): void {
    const dir = path.slice(0, path.lastIndexOf("/"));
    this.module.FS.mkdirTree(dir);
    this.module.FS.writeFile(path, bytes);
  }
}

/** Decodes a file the way the manifest says it was stored. */
export async function decode(
  bytes: Uint8Array,
  encoding: DataEncoding,
): Promise<Uint8Array> {
  if (encoding === "identity") return bytes;
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * A `DataSource` that fetches the files over HTTP from `baseUrl`, the
 * directory that holds `manifest.json`. A trailing slash is optional.
 * `decodeImpl` replaces `decode`, for engines without `DecompressionStream`.
 */
export async function httpDataSource(
  baseUrl: string | URL,
  fetchImpl: typeof fetch = fetch,
  decodeImpl: typeof decode = decode,
): Promise<DataSource> {
  let base = String(baseUrl);
  if (!base.endsWith("/")) base += "/";
  // A relative URL such as "/espeak-ng-data/" is resolved against the page
  // (or worker) location; without one, it has to be absolute already.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(base)) {
    const location = globalThis.location?.href;
    if (!location) {
      throw new Error(
        `The espeak-ng data URL must be absolute outside a browser context: ${base}`,
      );
    }
    base = new URL(base, location).href;
  }
  const fetchBytes = async (file: string): Promise<Uint8Array> => {
    const response = await fetchImpl(new URL(file, base));
    if (!response.ok) {
      throw new Error(
        `Failed to fetch espeak-ng data file ${file} from ${base}: ${response.status} ${response.statusText}`,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  };

  const manifestResponse = await fetchImpl(new URL("manifest.json", base));
  if (!manifestResponse.ok) {
    throw new Error(
      `Failed to fetch espeak-ng data manifest from ${base}: ${manifestResponse.status} ${manifestResponse.statusText}`,
    );
  }
  const manifest = (await manifestResponse.json()) as DataManifest;
  if (manifest.version !== 1) {
    throw new Error(
      `Unsupported espeak-ng data manifest version ${String(manifest.version)} at ${base}`,
    );
  }
  return {
    manifest,
    read: async (file) => decodeImpl(await fetchBytes(file), manifest.encoding),
  };
}

/**
 * The jsDelivr URL of this package's data directory for a given version, for
 * apps that would rather not host the data themselves.
 *
 * This is jsDelivr's npm endpoint, serving the `espeak-ng-data` directory of
 * the package as published to npmjs.com.
 */
export function jsdelivrDataUrl(version: string): string {
  return `https://cdn.jsdelivr.net/npm/@spelling-creator/spellophone@${version}/espeak-ng-data/`;
}
