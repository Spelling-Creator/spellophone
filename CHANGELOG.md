# Changelog

All notable changes to `@spelling-creator/spellophone` are listed here. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/Spelling-Creator/spellophone/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Spelling-Creator/spellophone/releases/tag/v0.1.0
