/**
 * The shape of `espeak-ng-data/manifest.json`, written by
 * `scripts/pack-data.ts` at build time and read by the data loaders.
 */
export interface DataManifest {
  /** Manifest format version. Bumped when the layout changes. */
  version: 1;
  /** The espeak-ng release the data was compiled from, such as `1.52.0`. */
  espeakVersion: string;
  /** How every file named in this manifest is stored on disk. */
  encoding: DataEncoding;
  /**
   * Every data file except the dictionaries, concatenated in `entries` order.
   * `size` is the decoded size of the whole concatenation.
   */
  core: {
    file: string;
    size: number;
    entries: CoreEntry[];
  };
  /** Per-language dictionaries keyed by espeak-ng language code (`en`, `de`...). */
  dictionaries: Record<string, DictionaryEntry>;
}

export type DataEncoding = "gzip" | "identity";

export interface CoreEntry {
  /** Path inside the espeak-ng data directory, such as `lang/gmw/en`. */
  path: string;
  /** Decoded size in bytes. */
  size: number;
}

export interface DictionaryEntry {
  /** File name relative to the data directory, such as `en_dict.gz`. */
  file: string;
  /** Decoded size in bytes. */
  size: number;
}
