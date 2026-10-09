# Events, SSML and phonemes

## Synthesis results

```ts
const result = espeak.synthesize("Hello world. How are you?", {
  voice: "en-us",
  rate: 160, // words per minute, 80 to 450
  pitch: 50, // 0 to 99
  range: 50, // pitch range, 0 to 99
  volume: 100, // 0 to 200
  wordGap: 0, // extra pause between words, in 10 ms units
  endPause: true, // trailing sentence pause
});

result.samples; // Int16Array, mono PCM
result.sampleRate; // 22050
result.duration; // seconds
result.events; // SpeechEvent[]
```

`rate`, `pitch`, `range`, `volume` and `wordGap` apply to that call only. To
change them for every later call, use `setParameter`:

```ts
espeak.setParameter("rate", 140);
espeak.getParameter("rate"); // 140
```

## Events

Every event carries where it happened:

| Field           | Meaning                                   |
| --------------- | ----------------------------------------- |
| `textPosition`  | 1-based character index in the input text |
| `length`        | Length in characters (for word events)    |
| `audioPosition` | Milliseconds from the start of the audio  |
| `sample`        | Sample index from the start of the audio  |

And its type:

| `type`     | Extra field | When                                                       |
| ---------- | ----------- | ---------------------------------------------------------- |
| `word`     | `number`    | A word starts                                              |
| `sentence` | `number`    | A sentence starts                                          |
| `end`      |             | A sentence or clause ends                                  |
| `mark`     | `name`      | An SSML `<mark name="...">` is reached                     |
| `play`     | `name`      | An SSML `<audio src="...">` is reached (nothing is played) |
| `phoneme`  | `phoneme`   | Each phoneme, when `phonemeEvents` is on                   |

Word events are what you want for karaoke-style highlighting:

```ts
const text = "Hello world.";
for (const event of result.events) {
  if (event.type === "word") {
    const word = text.slice(
      event.textPosition - 1,
      event.textPosition - 1 + event.length,
    );
    setTimeout(() => highlight(word), event.audioPosition);
  }
}
```

### Phoneme events

Pass `phonemeEvents` to `createEspeak` to get an event per phoneme while
synthesizing, in espeak-ng's ASCII names (`true`) or IPA (`"ipa"`):

```ts
const espeak = await createEspeak({ phonemeEvents: "ipa" });
const result = espeak.synthesize("cat");
result.events.filter((e) => e.type === "phoneme").map((e) => e.phoneme);
// ["k", "a", "t"]
```

## SSML

With `ssml: true`, the text is parsed as
[SSML](https://www.w3.org/TR/speech-synthesis11/). espeak-ng supports the
common subset: `<speak>`, `<voice>`, `<prosody>`, `<break>`, `<emphasis>`,
`<say-as>`, `<mark>`, `<audio>`, `<s>` and `<p>`.

```ts
const result = espeak.synthesize(
  `<speak>
     Say it <prosody rate="slow">slowly</prosody>,
     <break time="500ms"/>
     then <mark name="fast"/><prosody rate="fast">quickly</prosody>.
   </speak>`,
  { ssml: true },
);
result.events.find((e) => e.type === "mark"); // { type: "mark", name: "fast", ... }
```

## Phoneme transcription

`phonemes` runs espeak-ng's text analysis without synthesizing audio:

```ts
espeak.setVoice("en-us");
espeak.phonemes("hello world"); // "həlˈoʊ wˈɜːld"
espeak.phonemes("hello world", { ipa: false }); // "h@l'oU w'3:ld"
espeak.phonemes("hello", { separator: "_" }); // "h_ə_l_ˈoʊ"
espeak.phonemes("hello", { separator: "‿", tie: true }); // ties multi-letter phonemes
```

espeak-ng works a clause at a time, so the clauses of a longer text come back
joined with newlines, exactly as `espeak-ng --ipa` prints them:

```ts
espeak.phonemes("One. Two.").split("\n"); // ["wˈʌn", "tˈuː"]
```

The output depends on the selected voice, so pick one first (or pass `voice`).

## Phoneme input

The reverse direction also exists: with `phonemes: true`, text in `[[ ]]` is
read as espeak-ng phoneme mnemonics instead of words, which lets you control
pronunciation exactly:

```ts
espeak.synthesize("The name is [[dZ'oUn]].", { phonemes: true });
```
