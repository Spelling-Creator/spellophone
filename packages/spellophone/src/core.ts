import type { DataLoader, EspeakModule } from "./data.ts";
import { DATA_PATH } from "./data.ts";

export type { DataSource, EspeakModule } from "./data.ts";
export type {
  CoreEntry,
  DataEncoding,
  DataManifest,
  DictionaryEntry,
} from "./manifest.ts";
export {
  DATA_PATH,
  DEFAULT_LANGUAGE,
  DataLoader,
  decode,
  httpDataSource,
  jsdelivrDataUrl,
} from "./data.ts";
export { encodeWav, toFloat32 } from "./wav.ts";
export { VERSION } from "./version.ts";

// espeak_PARAMETER values from speak_lib.h.
const PARAMETER_IDS = {
  rate: 1,
  volume: 2,
  pitch: 3,
  range: 4,
  punctuation: 5,
  capitals: 6,
  wordGap: 7,
} as const;

/**
 * A tunable espeak-ng parameter.
 *
 * - `rate`: words per minute, 80 to 450. Default 175.
 * - `volume`: 0 to 200. Default 100.
 * - `pitch`: 0 to 99. Default 50.
 * - `range`: pitch range, 0 to 99. Default 50.
 * - `punctuation`: 0 none, 1 all, 2 some (see `setPunctuationList`).
 * - `capitals`: 0 none, 1 sound icon, 2 spelling, 3 and above raise pitch.
 * - `wordGap`: pause between words in units of 10 ms.
 */
export type Parameter = keyof typeof PARAMETER_IDS;

// espeak_Synth flags.
const FLAG_SSML = 0x10;
const FLAG_PHONEMES = 0x100;
const FLAG_ENDPAUSE = 0x1000;

// espeak_Initialize options.
const INIT_PHONEME_EVENTS = 0x01;
const INIT_PHONEME_IPA = 0x02;

// espeak_TextToPhonemes mode bits.
const PHONEMES_IPA = 0x02;
const PHONEMES_TIE = 0x80;

// espeak_EVENT_TYPE values.
const EVENT_WORD = 1;
const EVENT_SENTENCE = 2;
const EVENT_MARK = 3;
const EVENT_PLAY = 4;
const EVENT_END = 5;
const EVENT_PHONEME = 7;

export type VoiceGender = "male" | "female";

export interface VoiceLanguage {
  /** Lower is a better match for this language. */
  priority: number;
  /** A BCP 47 style tag such as `en-gb-x-rp`. */
  name: string;
}

export interface Voice {
  name: string;
  /** Path of the voice file inside espeak-ng-data, such as `gmw/en`. */
  identifier: string;
  languages: VoiceLanguage[];
  gender?: VoiceGender;
  /** Age in years, when the voice declares one. */
  age?: number;
}

/**
 * Picks a voice by any combination of properties, the way
 * `espeak_SetVoiceByProperties` does. A plain string is a voice name or a
 * language such as `en-us`, which is what most callers want.
 */
export interface VoiceSelector {
  name?: string;
  language?: string;
  gender?: VoiceGender;
  age?: number;
  /** Chooses among equally good matches, from 0 up. */
  variant?: number;
}

interface SpeechEventBase {
  /** 1-based character position in the input text. */
  textPosition: number;
  /** Length in characters, for word events. */
  length: number;
  /** Milliseconds from the start of the audio. */
  audioPosition: number;
  /** Sample index from the start of the audio. */
  sample: number;
}
export interface WordEvent extends SpeechEventBase {
  type: "word";
  number: number;
}
export interface SentenceEvent extends SpeechEventBase {
  type: "sentence";
  number: number;
}
export interface MarkEvent extends SpeechEventBase {
  type: "mark";
  /** The `name` of the SSML `<mark>`. */
  name: string;
}
export interface PlayEvent extends SpeechEventBase {
  type: "play";
  /** The `src` of the SSML `<audio>`. */
  name: string;
}
export interface PhonemeEvent extends SpeechEventBase {
  type: "phoneme";
  phoneme: string;
}
/** End of a sentence or clause. */
export interface EndEvent extends SpeechEventBase {
  type: "end";
}
export type SpeechEvent =
  | WordEvent
  | SentenceEvent
  | MarkEvent
  | PlayEvent
  | PhonemeEvent
  | EndEvent;

/** Parameters that can be set for a single call. */
export interface ParameterOverrides {
  rate?: number;
  volume?: number;
  pitch?: number;
  range?: number;
  wordGap?: number;
}

export interface SynthesizeOptions extends ParameterOverrides {
  /** Voice to switch to first. Stays selected afterwards. */
  voice?: string | VoiceSelector;
  /** The text is SSML. */
  ssml?: boolean;
  /** The text may contain `[[ ]]` phoneme mnemonics. */
  phonemes?: boolean;
  /** Add a sentence pause at the end. Default false. */
  endPause?: boolean;
}

export interface SynthesisResult {
  /** 16-bit mono PCM. */
  samples: Int16Array<ArrayBuffer>;
  sampleRate: number;
  /** Seconds of audio. */
  duration: number;
  events: SpeechEvent[];
}

export interface PhonemesOptions {
  /** Voice to switch to first. Stays selected afterwards. */
  voice?: string | VoiceSelector;
  /** International Phonetic Alphabet (default) or espeak-ng's ASCII names. */
  ipa?: boolean;
  /** Put this character between phonemes. */
  separator?: string;
  /** Use `separator` as a tie inside multi-letter phoneme names instead. */
  tie?: boolean;
}

export interface EspeakOptions {
  /** Where the data lives in the module's virtual file system. */
  dataPath?: string;
  /**
   * Emit a `phoneme` event for every phoneme while synthesizing. `"ipa"`
   * gives IPA names, `true` espeak-ng's ASCII ones.
   */
  phonemeEvents?: boolean | "ipa";
  /** Lets `Espeak` fetch dictionaries on demand. The entry points set it up. */
  loader?: DataLoader;
}

export class EspeakError extends Error {
  override readonly name: string = "EspeakError";
  /** The espeak_ERROR or espeak_ng_STATUS value. */
  readonly code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

/**
 * Thrown when a voice needs a dictionary that has not been loaded into the
 * virtual file system and the data source cannot read it synchronously.
 * Catch it, `await espeak.loadLanguages([error.language])`, and retry, or use
 * `Espeak.loadVoice`, which does exactly that.
 */
export class DictionaryNotLoadedError extends EspeakError {
  override readonly name: string = "DictionaryNotLoadedError";
  readonly language: string;
  constructor(language: string) {
    super(
      `The "${language}" dictionary is not loaded. Load it with espeak.loadLanguages(["${language}"]) or pass it in the languages option.`,
      -1,
    );
    this.language = language;
  }
}

/** The options the entry points hand to the Emscripten module factory. */
export interface ModuleFactoryOptions {
  locateFile?: (file: string, prefix: string) => string;
  printErr?: (line: string) => void;
}

/**
 * Builds the module factory options the entry points share: an optional wasm
 * location, and a stderr filter. espeak-ng prints "Can't read dictionary
 * file" whenever a voice's dictionary is not in the virtual file system,
 * which is an expected event here (it is what triggers loading it), so that
 * line is dropped and everything else still reaches `console.error`.
 */
export function moduleFactoryOptions(
  wasmUrl?: string | URL,
): ModuleFactoryOptions {
  const options: ModuleFactoryOptions = {
    printErr: (line) => {
      if (line.startsWith("Can't read dictionary file:")) return;
      console.error(line);
    },
  };
  if (wasmUrl !== undefined) {
    const wasm = String(wasmUrl);
    options.locateFile = (file, prefix) =>
      file.endsWith(".wasm") ? wasm : prefix + file;
  }
  return options;
}

function withCString<T>(
  module: EspeakModule,
  text: string,
  fn: (ptr: number) => T,
): T {
  const size = module.lengthBytesUTF8(text) + 1;
  const ptr = module._malloc(size);
  try {
    module.stringToUTF8(text, ptr, size);
    return fn(ptr);
  } finally {
    module._free(ptr);
  }
}

function readLanguages(module: EspeakModule, ptr: number): VoiceLanguage[] {
  const languages: VoiceLanguage[] = [];
  if (ptr === 0) return languages;
  let p = ptr;
  for (;;) {
    const priority = module.HEAPU8[p] ?? 0;
    if (priority === 0) break;
    const name = module.UTF8ToString(p + 1);
    languages.push({ priority, name });
    p += 1 + module.lengthBytesUTF8(name) + 1;
  }
  return languages;
}

function genderFromCode(code: number): VoiceGender | undefined {
  if (code === 1) return "male";
  if (code === 2) return "female";
  return undefined;
}

/**
 * A synchronous espeak-ng instance.
 *
 * Get one from `createEspeak` (the `spellophone/node` and `spellophone/browser`
 * entry points) or, to bring your own module and data, from `Espeak.create`.
 */
export class Espeak {
  readonly module: EspeakModule;
  /** Samples per second of the audio `synthesize` returns. */
  readonly sampleRate: number;
  /** espeak-ng's version string, such as `1.52.0`. */
  readonly version: string;
  readonly dataPath: string;
  readonly #loader: DataLoader | undefined;
  #disposed = false;
  /** Lowercased language tag to voice identifier, see `#voiceForLanguage`. */
  #languageVoices: Map<string, string> | undefined;

  private constructor(
    module: EspeakModule,
    sampleRate: number,
    dataPath: string,
    loader: DataLoader | undefined,
  ) {
    this.module = module;
    this.sampleRate = sampleRate;
    this.dataPath = dataPath;
    this.#loader = loader;
    // espeak_Info returns "<version>  Data at: <path>".
    const info = module.UTF8ToString(module._sp_version());
    this.version = info.split(/\s+/)[0] ?? info;
  }

  /**
   * Initializes espeak-ng on an already instantiated module whose virtual
   * file system holds espeak-ng-data at `options.dataPath` (default
   * `/espeak-ng-data`), with at least the English dictionary present.
   */
  static create(module: EspeakModule, options: EspeakOptions = {}): Espeak {
    const dataPath = options.dataPath ?? options.loader?.dataPath ?? DATA_PATH;
    let flags = 0;
    if (options.phonemeEvents) flags |= INIT_PHONEME_EVENTS;
    if (options.phonemeEvents === "ipa") flags |= INIT_PHONEME_IPA;
    const rate = withCString(module, dataPath, (ptr) =>
      module._sp_initialize(ptr, flags),
    );
    if (rate <= 0) {
      throw new EspeakError(
        `espeak-ng failed to initialize with data at ${dataPath} (status ${rate}). Is the data loaded, including the English dictionary?`,
        rate,
      );
    }
    return new Espeak(module, rate, dataPath, options.loader);
  }

  /** Every voice and language espeak-ng-data defines. */
  listVoices(): Voice[] {
    this.#check();
    const m = this.module;
    const voices: Voice[] = [];
    const count = m._sp_voice_count();
    for (let i = 0; i < count; i++) {
      const voice: Voice = {
        name: m.UTF8ToString(m._sp_voice_name(i)),
        identifier: m.UTF8ToString(m._sp_voice_identifier(i)),
        languages: readLanguages(m, m._sp_voice_languages(i)),
      };
      const gender = genderFromCode(m._sp_voice_gender(i));
      if (gender) voice.gender = gender;
      const age = m._sp_voice_age(i);
      if (age > 0) voice.age = age;
      voices.push(voice);
    }
    return voices;
  }

  /** The selected voice, or null before any has been selected. */
  get voice(): { name: string; languages: VoiceLanguage[] } | null {
    this.#check();
    const m = this.module;
    const namePtr = m._sp_current_voice_name();
    if (namePtr === 0) return null;
    return {
      name: m.UTF8ToString(namePtr),
      languages: readLanguages(m, m._sp_current_voice_languages()),
    };
  }

  /**
   * Selects a voice by name, language or properties. Loads the dictionary it
   * needs when the data source can do so synchronously (Node), and throws
   * `DictionaryNotLoadedError` otherwise. Use `loadVoice` to await it instead.
   */
  setVoice(selector: string | VoiceSelector): void {
    this.#check();
    this.#selectVoice(selector);
    if (this.module._sp_dictionary_loaded()) return;

    const language = this.module.UTF8ToString(
      this.module._sp_dictionary_name(),
    );
    if (this.#loader?.loadDictionarySync(language)) {
      this.#selectVoice(selector);
      if (this.module._sp_dictionary_loaded()) return;
    }
    throw new DictionaryNotLoadedError(language);
  }

  /** Like `setVoice`, but fetches a missing dictionary first. */
  async loadVoice(selector: string | VoiceSelector): Promise<void> {
    try {
      this.setVoice(selector);
    } catch (error) {
      if (!(error instanceof DictionaryNotLoadedError) || !this.#loader)
        throw error;
      await this.#loader.loadDictionary(error.language);
      this.setVoice(selector);
    }
  }

  /** Languages whose dictionary is loaded and ready to use. */
  loadedLanguages(): string[] {
    return this.#loader?.loadedLanguages() ?? [];
  }

  /** Languages the data source can provide a dictionary for. */
  availableLanguages(): string[] {
    return this.#loader?.availableLanguages() ?? [];
  }

  /** Fetches the dictionaries for these languages so voices can use them. */
  async loadLanguages(languages: string[]): Promise<void> {
    if (!this.#loader) {
      throw new Error("This Espeak instance has no data loader.");
    }
    await Promise.all(
      languages.map((lang) => this.#loader!.loadDictionary(lang)),
    );
  }

  getParameter(parameter: Parameter, current: boolean = true): number {
    this.#check();
    return this.module._sp_get_parameter(
      PARAMETER_IDS[parameter],
      current ? 1 : 0,
    );
  }

  /** Sets a parameter for every later call. See `Parameter` for the ranges. */
  setParameter(
    parameter: Parameter,
    value: number,
    relative: boolean = false,
  ): void {
    this.#check();
    const status = this.module._sp_set_parameter(
      PARAMETER_IDS[parameter],
      value,
      relative ? 1 : 0,
    );
    if (status !== 0) {
      throw new EspeakError(`Could not set ${parameter} to ${value}`, status);
    }
  }

  /**
   * Synthesizes `text` and returns the audio and the events espeak-ng raised
   * while producing it. Parameter overrides apply to this call only.
   */
  synthesize(text: string, options: SynthesizeOptions = {}): SynthesisResult {
    this.#check();
    if (options.voice !== undefined) this.setVoice(options.voice);
    const restore = this.#applyOverrides(options);
    try {
      let flags = 0;
      if (options.ssml) flags |= FLAG_SSML;
      if (options.phonemes) flags |= FLAG_PHONEMES;
      if (options.endPause) flags |= FLAG_ENDPAUSE;
      const status = withCString(this.module, text, (ptr) =>
        this.module._sp_synthesize(ptr, flags),
      );
      if (status !== 0) {
        throw new EspeakError(`Synthesis failed (status ${status})`, status);
      }
      return this.#collectResult();
    } finally {
      restore();
    }
  }

  /**
   * Transcribes `text` to phonemes, in IPA by default. espeak-ng works one
   * clause at a time, so the clauses are joined with a newline, as the
   * `espeak-ng -x` command line does.
   */
  phonemes(text: string, options: PhonemesOptions = {}): string {
    this.#check();
    if (options.voice !== undefined) this.setVoice(options.voice);
    let mode = options.ipa === false ? 0 : PHONEMES_IPA;
    if (options.tie) mode |= PHONEMES_TIE;
    if (options.separator) {
      const code = options.separator.codePointAt(0) ?? 0;
      if (code > 0xffff) {
        throw new RangeError(
          "The phoneme separator must be a single BMP character.",
        );
      }
      mode |= code << 8;
    }
    const ptr = withCString(this.module, text, (p) =>
      this.module._sp_text_to_phonemes(p, mode),
    );
    return this.module.UTF8ToString(ptr);
  }

  /** Releases espeak-ng. The instance cannot be used afterwards. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.module._sp_terminate();
  }

  #check(): void {
    if (this.#disposed)
      throw new Error("This Espeak instance has been disposed.");
  }

  #selectVoice(selector: string | VoiceSelector): void {
    const m = this.module;
    const byName = (name: string): number =>
      withCString(m, name, (ptr) => m._sp_set_voice_by_name(ptr));
    let status: number;
    if (typeof selector === "string") {
      status = byName(selector);
      // espeak_SetVoiceByName only matches voice file names and voice names,
      // so a language such as "en-gb" (in the file gmw/en) finds nothing.
      // Retry with the voice that lists that exact language, keeping any
      // +variant. Not with espeak_SetVoiceByProperties, as the espeak-ng
      // command line does: it drops the variant, and it settles for the
      // closest voice, so a typo would pick some voice instead of throwing
      // ("no-such-voice" finds Norwegian).
      if (status !== 0) {
        const plus = selector.indexOf("+");
        const tag = plus < 0 ? selector : selector.slice(0, plus);
        const identifier = this.#voiceForLanguage(tag);
        if (identifier !== undefined) {
          status = byName(identifier + selector.slice(tag.length));
        }
      }
    } else {
      const gender =
        selector.gender === "male" ? 1 : selector.gender === "female" ? 2 : 0;
      status = withCString(m, selector.name ?? "", (name) =>
        withCString(m, selector.language ?? "", (language) =>
          m._sp_set_voice_by_properties(
            name,
            language,
            gender,
            selector.age ?? 0,
            selector.variant ?? 0,
          ),
        ),
      );
    }
    if (status !== 0) {
      const description =
        typeof selector === "string"
          ? `"${selector}"`
          : JSON.stringify(selector);
      throw new EspeakError(
        `No voice matches ${description} (status ${status})`,
        status,
      );
    }
  }

  /**
   * The identifier of the voice that lists this language tag (ignoring case)
   * with the best priority, which is the one espeak-ng picks for it. Built
   * once, since listing the voices reads every voice file.
   */
  #voiceForLanguage(tag: string): string | undefined {
    if (!this.#languageVoices) {
      const best = new Map<string, { identifier: string; priority: number }>();
      for (const voice of this.listVoices()) {
        for (const { name, priority } of voice.languages) {
          const key = name.toLowerCase();
          const current = best.get(key);
          if (!current || priority < current.priority) {
            best.set(key, { identifier: voice.identifier, priority });
          }
        }
      }
      this.#languageVoices = new Map(
        [...best].map(([key, { identifier }]) => [key, identifier]),
      );
    }
    return this.#languageVoices.get(tag.toLowerCase());
  }

  #applyOverrides(overrides: ParameterOverrides): () => void {
    const previous: [Parameter, number][] = [];
    for (const parameter of [
      "rate",
      "volume",
      "pitch",
      "range",
      "wordGap",
    ] as const) {
      const value = overrides[parameter];
      if (value === undefined) continue;
      previous.push([parameter, this.getParameter(parameter)]);
      this.setParameter(parameter, value);
    }
    return () => {
      for (const [parameter, value] of previous)
        this.setParameter(parameter, value);
    };
  }

  #collectResult(): SynthesisResult {
    const m = this.module;
    const sampleCount = m._sp_audio_samples();
    const samplePtr = m._sp_audio_data();
    // Copy out: the heap buffer is replaced whenever the wasm memory grows.
    const samples = new Int16Array(
      m.HEAP16.buffer,
      samplePtr,
      sampleCount,
    ).slice();

    const events: SpeechEvent[] = [];
    const count = m._sp_events_count();
    const recordSize = m._sp_event_size();
    const base = m._sp_events_data();
    const strings = m._sp_strings_data();
    for (let i = 0; i < count; i++) {
      const at = (base + i * recordSize) >> 2;
      const heap = m.HEAP32;
      const type = heap[at] ?? 0;
      const common: SpeechEventBase = {
        textPosition: heap[at + 1] ?? 0,
        length: heap[at + 2] ?? 0,
        audioPosition: heap[at + 3] ?? 0,
        sample: heap[at + 4] ?? 0,
      };
      const number = heap[at + 5] ?? 0;
      const nameOffset = heap[at + 6] ?? -1;
      const name = nameOffset >= 0 ? m.UTF8ToString(strings + nameOffset) : "";
      switch (type) {
        case EVENT_WORD:
          events.push({ type: "word", ...common, number });
          break;
        case EVENT_SENTENCE:
          events.push({ type: "sentence", ...common, number });
          break;
        case EVENT_MARK:
          events.push({ type: "mark", ...common, name });
          break;
        case EVENT_PLAY:
          events.push({ type: "play", ...common, name });
          break;
        case EVENT_PHONEME:
          events.push({ type: "phoneme", ...common, phoneme: name });
          break;
        case EVENT_END:
          events.push({ type: "end", ...common });
          break;
        default:
          // MSG_TERMINATED and SAMPLERATE are bookkeeping, not speech.
          break;
      }
    }

    return {
      samples,
      sampleRate: this.sampleRate,
      duration: sampleCount / this.sampleRate,
      events,
    };
  }
}
