---
layout: home

hero:
  name: Spellophone
  text: espeak-ng in JavaScript
  tagline: Text-to-speech and phoneme transcription for Node.js and browsers, compiled to WebAssembly. No server, no native addon.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/
    - theme: alt
      text: GitHub
      link: https://github.com/Spelling-Creator/spellophone

features:
  - title: Speech synthesis
    details: Over a hundred languages and accents, 16-bit PCM out, with word, sentence, mark and phoneme events for highlighting and timing.
  - title: Phoneme transcription
    details: Turn text into IPA or espeak-ng's ASCII phonemes with one call, which is what spelling and reading tools usually need.
  - title: Runs anywhere
    details: One package for Node.js, browsers and workers. Dictionaries are fetched on demand, so a page only downloads the languages it uses.
  - title: Typed and small
    details: Written in TypeScript, bundled with tsdown. About 380 KB of wasm plus 450 KB of compressed data for English.
---
