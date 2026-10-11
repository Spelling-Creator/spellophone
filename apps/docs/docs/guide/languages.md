# Languages and data

espeak-ng supports over a hundred languages and accents. Each one is a voice
file (tiny) plus a compiled dictionary (anything from 2 KB to 8 MB), and both
live in the `espeak-ng-data` directory this package ships.

## Voices

`listVoices()` returns every voice espeak-ng knows about, whether or not its
dictionary is loaded yet:

```ts
for (const voice of espeak.listVoices()) {
  console.log(voice.name, voice.languages.map((l) => l.name).join(", "));
}
// English (America)  en-us
// German             de
// ...
```

Select one by name or language tag (`setVoice("de")`, `setVoice("en-gb")`), or
by properties:

```ts
espeak.setVoice({ language: "en", gender: "female" });
espeak.setVoice({ name: "English (Received Pronunciation)" });
```

A string is tried as a voice name first and then as a language, the way the
`espeak-ng -v` command line does it. As a language, espeak-ng matches the
closest voice it has, so `en-us-x-anything` still finds `en-us`. A string that
matches no voice name and no language throws `EspeakError`.

### Variants

espeak-ng has voice variants (different pitches, speeds, and the famous
"whisper") in `espeak-ng-data/voices/!v`. Select one with the `+` syntax
espeak-ng uses on the command line:

```ts
espeak.setVoice("en-us+f3"); // female variant 3
espeak.setVoice("de+whisper");
```

## Dictionaries

Before a language can be spoken or transcribed, its dictionary has to be in
the module's virtual file system.

- **Node.js** reads dictionaries from disk the first time a voice needs one.
  Nothing to do.
- **Browsers** fetch them. English is fetched by `createEspeak`; add others with
  the `languages` option, `loadLanguages()` or `loadVoice()`.

`availableLanguages()` lists what the data source can provide,
`loadedLanguages()` what is ready to use. Language codes are espeak-ng's
dictionary names: `en`, `de`, `cmn`, `pt`, `es`, `ru` and so on. They are the
first part of the voice's language tag in most cases, though not all: `en-gb`
and `en-us` share `en`, and `es-419` uses `es`.

```ts
if (!espeak.loadedLanguages().includes("fr")) {
  await espeak.loadLanguages(["fr"]);
}
```

## The data directory

```
espeak-ng-data/
  manifest.json   lists everything below, with sizes
  core.bin.gz     phoneme tables, intonations, voice and language definitions
  af_dict.gz      one gzipped dictionary per language
  am_dict.gz
  ...
```

`core.bin.gz` is every file except the dictionaries, concatenated in the order
`manifest.json` lists them, so a browser makes one request for the 250 or so
small files instead of 250. All files are gzipped at build time and
decompressed by the library with `DecompressionStream`, which every supported
runtime has.

| File              | Compressed | Decoded |
| ----------------- | ---------: | ------: |
| `core.bin.gz`     |     349 KB |  725 KB |
| `en_dict.gz`      |     108 KB |  290 KB |
| `ru_dict.gz`      |     4.8 MB |  8.1 MB |
| all 114 languages |     9.1 MB |   19 MB |

The manifest's `encoding` field says how the files are stored; a repacked
directory with `"identity"` (uncompressed) files is also accepted.

## Bringing your own data

The loaders only need a `DataSource`: the manifest plus a function that
returns a file's decoded bytes. Anything that can produce those works, such as
an IndexedDB cache or files bundled into an app. See the
[low-level API](../api/low-level.md).
