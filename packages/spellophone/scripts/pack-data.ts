// Packs a compiled espeak-ng-data directory into the layout the loaders read:
//
//   manifest.json   what is where (see src/manifest.ts)
//   core.bin.gz     every file except the dictionaries, concatenated and gzipped
//   <lang>_dict.gz  one gzipped dictionary per language
//
// espeak-ng-data is ~120 files, most of them tiny voice and language
// definitions, so a browser fetches one small core file plus only the
// dictionaries it needs. Everything is gzipped because the dictionaries
// compress to roughly a third of their size and DecompressionStream is
// available in every runtime this library targets, so no CDN or server has to
// be trusted to compress the transfer.

import { gzipSync } from "node:zlib";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, posix, relative } from "node:path";
import type { CoreEntry, DataManifest } from "../src/manifest.ts";

function listFiles(dir: string, root: string = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).toSorted()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full, root));
    } else {
      out.push(relative(root, full).split("\\").join(posix.sep));
    }
  }
  return out;
}

function gzip(bytes: Uint8Array): Uint8Array {
  return gzipSync(bytes, { level: 9 });
}

export function packData(
  rawDir: string,
  outDir: string,
  espeakVersion: string,
): DataManifest {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const manifest: DataManifest = {
    version: 1,
    espeakVersion,
    encoding: "gzip",
    core: { file: "core.bin.gz", size: 0, entries: [] },
    dictionaries: {},
  };

  const coreChunks: Uint8Array[] = [];
  for (const path of listFiles(rawDir)) {
    // phondata-manifest is a build-time listing espeak-ng never reads back.
    if (path === "phondata-manifest") continue;

    const bytes = readFileSync(join(rawDir, path));
    const dict = /^([a-z-]+)_dict$/.exec(path);
    if (dict?.[1]) {
      const file = `${path}.gz`;
      writeFileSync(join(outDir, file), gzip(bytes));
      manifest.dictionaries[dict[1]] = { file, size: bytes.length };
    } else {
      const entry: CoreEntry = { path, size: bytes.length };
      manifest.core.entries.push(entry);
      manifest.core.size += bytes.length;
      coreChunks.push(bytes);
    }
  }

  writeFileSync(
    join(outDir, manifest.core.file),
    gzip(Buffer.concat(coreChunks)),
  );
  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  const dictCount = Object.keys(manifest.dictionaries).length;
  console.log(
    `packed ${manifest.core.entries.length} core files and ${dictCount} dictionaries into ${outDir}`,
  );
  return manifest;
}
