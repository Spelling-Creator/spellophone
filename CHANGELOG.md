# Changelog

All notable changes to `@spelling-creator/spellophone` are listed here. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The docs site uses the new Spelling Creator icon, as its favicon and in
  its header.

### Fixed

- The published package now includes the README.

## [0.2.1] - 2026-10-11

### Fixed

- `setVoice` (and the `voice` option of `synthesize` and `phonemes`) now
  accepts a language tag that has no voice file of the same name, such as
  `"en-gb"` or `"en-gb+f3"`. A string that matches no voice name is retried
  as a language when a voice lists exactly that language tag (ignoring case),
  and throws otherwise.
- Loading data over HTTP no longer fails when the server sends the `.gz`
  files with `Content-Encoding: gzip`, as Vite's dev server does for files
  imported with `?url`. The browser has already unzipped those, so
  `httpDataSource` now passes on a file that does not start with the gzip
  magic bytes as it is.
- A data file that fails to decode now names the file in the error.

## [0.2.0] - 2026-10-10

espeak-ng 1.52.0, unchanged.

### Added

- `@spelling-creator/spellophone/wasm2js`: espeak-ng compiled to plain
  JavaScript by Binaryen's `wasm2js`, for engines without WebAssembly
  (`createWasm2jsModule`).
- A `fallback` option for the browser `createEspeak`. Pass
  `() => import("@spelling-creator/spellophone/wasm2js")` and the wasm2js
  module is used where WebAssembly is blocked, such as Safari in Lockdown Mode
  or under a Content-Security-Policy without `wasm-unsafe-eval`.
  `canCompileWasm()` exposes the check it makes.
- A legacy build lowered to ES5 with swc, with the polyfills it needs and
  no WebAssembly: `@spelling-creator/spellophone/legacy` as an ES module, and
  `dist/legacy/spellophone.iife.js` as a classic script that defines a
  `Spellophone` global.
- `httpDataSource` takes an optional third argument that replaces the gzip
  decoding.

### Changed

- The package is now published to npmjs.com instead of GitHub Packages, so
  installing it no longer needs a GitHub token or an `.npmrc` entry. The
  tarball is still attached to each GitHub release. Versions after this one
  also carry a provenance attestation.
- `cdn: "jsdelivr"` and `jsdelivrDataUrl` now use jsDelivr's npm endpoint
  (`cdn.jsdelivr.net/npm/@spelling-creator/spellophone@<version>/`) instead
  of its GitHub endpoint.
- `EspeakModule` (and what `DataLoader` and `Espeak.create` accept) no longer
  includes `NODEFS`, which the wasm2js module does not have. `MainModule` from
  `@spelling-creator/spellophone/wasm/espeak-ng.js` is still the full type.
- The docs site uses the Spelling Creator favicon, and its header links to
  the package on npmjs.com.

### Development

- The compiled wasm and data are no longer committed, and were removed from
  the repository's history. `pnpm build` compiles them from espeak-ng's
  sources, and CI builds them on Linux and macOS and fails if the two builds
  differ in any byte.
- The release workflow publishes with npm's trusted publishing (OIDC), so the
  repository holds no npm token.
- The tsdown config uses `deps.neverBundle` in place of `external`, which
  tsdown 0.23 deprecates. The output is the same.

## [0.1.0] - 2026-10-09

First release. espeak-ng 1.52.0.

### Added

- `createEspeak` for Node.js (`@spelling-creator/spellophone/node`) and for
  browsers and workers (`@spelling-creator/spellophone/browser`); the bare
  import picks the right one.
- `Espeak.synthesize`: 16-bit PCM audio with word, sentence, end, mark, play
  and phoneme events; per-call `rate`, `pitch`, `range`, `volume` and
  `wordGap`; SSML and `[[ ]]` phoneme input.
- `Espeak.phonemes`: IPA or espeak-ng ASCII transcription with optional
  separator and ties.
- Voice listing and selection by name, language or properties, including
  espeak-ng's `+variant` syntax.
- Dictionaries load on demand: synchronously from disk in Node.js, over HTTP
  in browsers with `languages`, `loadLanguages` and `loadVoice`.
- Data served from your own host (`dataUrl`) or from jsDelivr's GitHub
  endpoint (`cdn: "jsdelivr"`); all data files gzipped and decoded with
  `DecompressionStream`.
- `encodeWav` and `toFloat32` helpers.
- Low-level `Espeak.create`, `DataLoader`, `DataSource`, `httpDataSource`
  and `fileDataSource` for custom module and data loading.

[Unreleased]: https://github.com/Spelling-Creator/spellophone/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/Spelling-Creator/spellophone/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Spelling-Creator/spellophone/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Spelling-Creator/spellophone/releases/tag/v0.1.0
