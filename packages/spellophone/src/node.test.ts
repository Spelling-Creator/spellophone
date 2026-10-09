import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { Espeak } from "./node.ts";
import { createEspeak, DictionaryNotLoadedError, encodeWav } from "./node.ts";

describe("createEspeak (node)", () => {
  let espeak: Espeak;

  beforeAll(async () => {
    espeak = await createEspeak();
  });

  afterAll(() => {
    espeak.dispose();
  });

  it("reports the espeak-ng version and sample rate", () => {
    expect(espeak.version).toMatch(/^\d+\.\d+/);
    expect(espeak.sampleRate).toBe(22050);
  });

  it("lists voices with languages", () => {
    const voices = espeak.listVoices();
    expect(voices.length).toBeGreaterThan(50);
    const english = voices.find((v) =>
      v.languages.some((l) => l.name === "en-us"),
    );
    expect(english).toBeDefined();
    expect(english?.identifier).toMatch(/^gmw\//);
  });

  it("synthesizes audio with word events", () => {
    const result = espeak.synthesize("Hello world.", { voice: "en-us" });
    expect(result.sampleRate).toBe(espeak.sampleRate);
    expect(result.samples.length).toBeGreaterThan(5000);
    expect(result.duration).toBeCloseTo(result.samples.length / 22050, 6);
    const words = result.events.filter((e) => e.type === "word");
    expect(words.map((w) => w.textPosition)).toEqual([1, 7]);
    expect(result.events.some((e) => e.type === "end")).toBe(true);
    // Not silence.
    expect(Math.max(...result.samples)).toBeGreaterThan(1000);
  });

  it("transcribes to IPA and to espeak phonemes", () => {
    expect(espeak.phonemes("hello", { voice: "en-us" })).toBe("həlˈoʊ");
    expect(espeak.phonemes("hello", { ipa: false })).toBe("h@l'oU");
    expect(espeak.phonemes("hello", { separator: "_" })).toBe("h_ə_l_ˈoʊ");
  });

  it("joins clauses with newlines", () => {
    const out = espeak.phonemes("One. Two.", { voice: "en-us" });
    expect(out.split("\n")).toHaveLength(2);
  });

  it("loads other languages on demand", () => {
    expect(espeak.loadedLanguages()).not.toContain("de");
    espeak.setVoice("de");
    expect(espeak.loadedLanguages()).toContain("de");
    expect(espeak.voice?.name).toBe("German");
    expect(espeak.phonemes("Haus")).toBe("hˈaʊs");
  });

  it("selects voices by properties", () => {
    espeak.setVoice({ language: "en-gb", gender: "female" });
    expect(
      espeak.voice?.languages.some((l) => l.name.startsWith("en-gb")),
    ).toBe(true);
  });

  it("applies per-call parameter overrides without keeping them", () => {
    espeak.setVoice("en-us");
    const before = espeak.getParameter("rate");
    const slow = espeak.synthesize("Hello world.", { rate: 90 });
    const fast = espeak.synthesize("Hello world.", { rate: 300 });
    expect(slow.samples.length).toBeGreaterThan(fast.samples.length * 1.5);
    expect(espeak.getParameter("rate")).toBe(before);
  });

  it("rejects unknown voices", () => {
    // Not "klingon": espeak-ng really does ship one (piqd).
    expect(() => espeak.setVoice("no-such-voice")).toThrow(/No voice matches/);
  });

  it("reports SSML marks", () => {
    const result = espeak.synthesize(
      '<speak>Hello <mark name="here"/> world</speak>',
      { ssml: true, voice: "en-us" },
    );
    const mark = result.events.find((e) => e.type === "mark");
    expect(mark).toMatchObject({ type: "mark", name: "here" });
  });

  it("encodes WAV files", () => {
    const result = espeak.synthesize("Hi.", { voice: "en-us" });
    const wav = encodeWav(result.samples, result.sampleRate);
    expect(wav.length).toBe(44 + result.samples.length * 2);
    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe("WAVE");
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(22050);
  });
});

describe("phoneme events", () => {
  it("emits IPA phoneme events when asked", async () => {
    const espeak = await createEspeak({ phonemeEvents: "ipa" });
    try {
      const result = espeak.synthesize("cat", { voice: "en-us" });
      const phonemes = result.events
        .filter((e) => e.type === "phoneme")
        .map((e) => e.phoneme);
      expect(phonemes.join("")).toContain("k");
      expect(phonemes.join("")).toContain("t");
    } finally {
      espeak.dispose();
    }
  });
});

describe("httpDataSource", () => {
  it("fetches and decodes files from a base URL", async () => {
    const { httpDataSource, DATA_DIR } = await import("./node.ts");
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const requested: string[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      const url = new URL(String(input));
      requested.push(url.pathname);
      const file = url.pathname.replace("/static/espeak-ng-data/", "");
      try {
        return new Response(await readFile(join(DATA_DIR, file)));
      } catch {
        return new Response(null, { status: 404, statusText: "Not Found" });
      }
    };

    // No trailing slash on purpose: it has to be added.
    const source = await httpDataSource(
      "https://example.test/static/espeak-ng-data",
      fakeFetch,
    );
    expect(requested).toEqual(["/static/espeak-ng-data/manifest.json"]);
    expect(source.manifest.encoding).toBe("gzip");

    const core = await source.read(source.manifest.core.file);
    expect(core.length).toBe(source.manifest.core.size);

    await expect(source.read("missing.gz")).rejects.toThrow(/404/);
  });

  it("rejects relative URLs outside a browser", async () => {
    const { httpDataSource } = await import("./node.ts");
    await expect(httpDataSource("/espeak-ng-data/")).rejects.toThrow(
      /must be absolute/,
    );
  });
});

describe("asynchronous data sources", () => {
  it("throws DictionaryNotLoadedError and recovers with loadVoice", async () => {
    const { fileDataSource, DataLoader, Espeak } = await import("./node.ts");
    const { default: createModule } = await import("../wasm/espeak-ng.js");
    const source = fileDataSource();
    // Hide readSync so dictionaries can only be fetched asynchronously, which
    // is how the browser entry point behaves.
    const asyncOnly = { manifest: source.manifest, read: source.read };
    const module = await createModule();
    const loader = new DataLoader(module, asyncOnly);
    await loader.loadCore();
    await loader.loadDictionary("en");
    const espeak = Espeak.create(module, { loader });
    try {
      expect(() => espeak.setVoice("fr")).toThrow(DictionaryNotLoadedError);
      await espeak.loadVoice("fr");
      expect(espeak.voice?.name).toBe("French (France)");
      expect(espeak.loadedLanguages()).toEqual(
        expect.arrayContaining(["en", "fr"]),
      );
    } finally {
      espeak.dispose();
    }
  });
});
