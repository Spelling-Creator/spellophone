import type {
  Espeak,
  SynthesisResult,
} from "@spelling-creator/spellophone/browser";
import {
  canCompileWasm,
  createEspeak,
  encodeWav,
  toFloat32,
} from "@spelling-creator/spellophone/browser";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const textEl = $<HTMLTextAreaElement>("text");
const voiceEl = $<HTMLSelectElement>("voice");
const rateEl = $<HTMLInputElement>("rate");
const pitchEl = $<HTMLInputElement>("pitch");
const speakEl = $<HTMLButtonElement>("speak");
const downloadEl = $<HTMLButtonElement>("download");
const statusEl = $<HTMLSpanElement>("status");
const ipaEl = $<HTMLOutputElement>("ipa");
const eventsEl = $<HTMLOutputElement>("events");

// Where the data comes from. The Vite config serves this package's
// espeak-ng-data directory at /espeak-ng-data/ (and copies it into the build),
// which is the self-hosting setup. Add ?cdn to the URL to fetch it from
// jsDelivr instead, which needs no hosting at all but only works for versions
// that have been published to npm.
const useCdn = new URLSearchParams(location.search).has("cdn");

let espeak: Espeak;
let audioContext: AudioContext | undefined;
let last: SynthesisResult | undefined;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function speakerLanguage(name: string): string {
  return name.split("-")[0] ?? name;
}

async function init(): Promise<void> {
  const started = performance.now();
  espeak = await createEspeak({
    ...(useCdn ? { cdn: "jsdelivr" } : { dataUrl: "/espeak-ng-data/" }),
    // Where WebAssembly is blocked (iOS Lockdown Mode, a Content-Security-Policy
    // without 'wasm-unsafe-eval'), run the slower wasm2js build instead. The
    // dynamic import keeps it in a separate chunk that is only fetched then.
    fallback: () => import("@spelling-creator/spellophone/wasm2js"),
  });
  const ms = Math.round(performance.now() - started);
  const engine = canCompileWasm() ? "WebAssembly" : "wasm2js";
  setStatus(
    `espeak-ng ${espeak.version} ready in ${ms} ms (${engine}, ${useCdn ? "jsDelivr" : "self-hosted"} data)`,
  );

  // One entry per language, voices sorted by name. Dictionaries are fetched
  // on demand when a language is first selected.
  const voices = espeak
    .listVoices()
    .toSorted((a, b) => a.name.localeCompare(b.name));
  for (const voice of voices) {
    const language = voice.languages[0]?.name ?? voice.name;
    const option = document.createElement("option");
    option.value = language;
    option.textContent = `${voice.name} (${language})`;
    if (language === "en-us") option.selected = true;
    voiceEl.append(option);
  }

  voiceEl.disabled = false;
  speakEl.disabled = false;
  update();
}

async function selectVoice(): Promise<void> {
  const language = voiceEl.value;
  const loaded = espeak.loadedLanguages();
  if (!loaded.includes(speakerLanguage(language))) {
    setStatus(`Fetching the ${speakerLanguage(language)} dictionary...`);
  }
  await espeak.loadVoice(language);
  setStatus(`Voice: ${espeak.voice?.name ?? language}`);
}

async function update(): Promise<void> {
  try {
    await selectVoice();
    ipaEl.value = espeak.phonemes(textEl.value);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
}

function play(result: SynthesisResult): void {
  audioContext ??= new AudioContext();
  const buffer = audioContext.createBuffer(
    1,
    result.samples.length,
    result.sampleRate,
  );
  buffer.copyToChannel(toFloat32(result.samples), 0);
  const node = audioContext.createBufferSource();
  node.buffer = buffer;
  node.connect(audioContext.destination);
  node.start();
}

function showEvents(result: SynthesisResult, text: string): void {
  const lines: string[] = [];
  for (const event of result.events) {
    if (event.type !== "word") continue;
    const start = event.textPosition - 1;
    const word = text.slice(start, start + event.length);
    lines.push(`${String(event.audioPosition).padStart(5)} ms  ${word}`);
  }
  eventsEl.value = lines.join("\n");
}

speakEl.addEventListener("click", async () => {
  try {
    await selectVoice();
    const text = textEl.value;
    last = espeak.synthesize(text, {
      rate: Number(rateEl.value),
      pitch: Number(pitchEl.value),
    });
    play(last);
    showEvents(last, text);
    downloadEl.disabled = false;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

downloadEl.addEventListener("click", () => {
  if (!last) return;
  const wav = encodeWav(last.samples, last.sampleRate);
  const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "spellophone.wav";
  a.click();
  URL.revokeObjectURL(url);
});

textEl.addEventListener("input", () => void update());
voiceEl.addEventListener("change", () => void update());

init().catch((error: unknown) => {
  setStatus(
    `Failed to load: ${error instanceof Error ? error.message : String(error)}`,
  );
});
