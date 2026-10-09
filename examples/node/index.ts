// Synthesizes a sentence to a WAV file and prints its phonemes.
//
//   pnpm example:node            (from the repository root)
//   pnpm example:node -- "Any text you like" de

import { writeFile } from "node:fs/promises";
import { createEspeak, encodeWav } from "@spelling-creator/spellophone";

const [text = "Hello from spellophone.", voice = "en-us"] =
  process.argv.slice(2);

const espeak = await createEspeak();
console.log(`espeak-ng ${espeak.version}, ${espeak.sampleRate} Hz`);

espeak.setVoice(voice);
console.log(`voice: ${espeak.voice?.name}`);

console.log(`IPA:   ${espeak.phonemes(text)}`);
console.log(`ASCII: ${espeak.phonemes(text, { ipa: false })}`);

const result = espeak.synthesize(text, { rate: 160 });
await writeFile("hello.wav", encodeWav(result.samples, result.sampleRate));
console.log(`wrote hello.wav (${result.duration.toFixed(2)} s)`);

for (const event of result.events) {
  if (event.type === "word") {
    const word = text.slice(
      event.textPosition - 1,
      event.textPosition - 1 + event.length,
    );
    console.log(`  ${String(event.audioPosition).padStart(5)} ms  ${word}`);
  }
}

espeak.dispose();
