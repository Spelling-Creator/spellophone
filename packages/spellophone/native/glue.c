/*
 * Spellophone: the thin C layer between espeak-ng and JavaScript.
 *
 * Copyright (C) 2026 Spelling Creator
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see: <http://www.gnu.org/licenses/>.
 *
 * Everything here is exported with a flat C ABI so the TypeScript side only
 * ever passes integers and C strings across the WebAssembly boundary. Audio and
 * events are collected into growable buffers during a synchronous
 * espeak_Synth() call and read out afterwards, which keeps the JavaScript API
 * free of callbacks and function-pointer tables.
 */

#include <emscripten.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include <espeak-ng/espeak_ng.h>
#include <espeak-ng/speak_lib.h>

/* Internal header: gives us `translator` and `dictionary_name`, see below. */
#include "translate.h"

#define SP_EXPORT EMSCRIPTEN_KEEPALIVE

/* ------------------------------------------------------------------------ */
/* Growable byte buffers                                                    */
/* ------------------------------------------------------------------------ */

typedef struct {
  uint8_t *data;
  size_t len;
  size_t cap;
} sp_buf;

static sp_buf sp_audio;   /* int16 PCM samples, mono */
static sp_buf sp_events;  /* packed sp_event records */
static sp_buf sp_strings; /* NUL-terminated names referenced by events */
static sp_buf sp_phonemes; /* output of sp_text_to_phonemes */

static int sp_buf_reserve(sp_buf *b, size_t extra) {
  size_t need = b->len + extra;
  if (need <= b->cap) return 0;
  size_t cap = b->cap ? b->cap : 4096;
  while (cap < need) cap *= 2;
  uint8_t *data = realloc(b->data, cap);
  if (!data) return -1;
  b->data = data;
  b->cap = cap;
  return 0;
}

static int sp_buf_append(sp_buf *b, const void *src, size_t n) {
  if (sp_buf_reserve(b, n) != 0) return -1;
  memcpy(b->data + b->len, src, n);
  b->len += n;
  return 0;
}

static void sp_buf_reset(sp_buf *b) { b->len = 0; }

/* ------------------------------------------------------------------------ */
/* Events                                                                   */
/* ------------------------------------------------------------------------ */

/*
 * The fixed-size record the TypeScript side decodes. Keep this in sync with
 * EVENT_RECORD_SIZE and the field order in src/events.ts.
 */
typedef struct {
  int32_t type;           /* espeak_EVENT_TYPE */
  int32_t text_position;  /* 1-based character position in the input text */
  int32_t length;         /* characters, for word events */
  int32_t audio_position; /* milliseconds from the start of the audio */
  int32_t sample;         /* sample index from the start of the audio */
  int32_t number;         /* word/sentence number, or the phoneme code */
  int32_t name_offset;    /* offset into sp_strings, or -1 */
} sp_event;

static int sp_append_string(const char *s, size_t n) {
  int32_t offset = (int32_t)sp_strings.len;
  if (sp_buf_append(&sp_strings, s, n) != 0) return -1;
  static const char nul = 0;
  if (sp_buf_append(&sp_strings, &nul, 1) != 0) return -1;
  return offset;
}

static int sp_synth_callback(short *wav, int numsamples, espeak_EVENT *events) {
  if (wav && numsamples > 0) {
    sp_buf_append(&sp_audio, wav, (size_t)numsamples * sizeof(short));
  }
  for (espeak_EVENT *ev = events; ev && ev->type != espeakEVENT_LIST_TERMINATED;
       ev++) {
    sp_event rec;
    rec.type = ev->type;
    rec.text_position = (int32_t)ev->text_position;
    rec.length = ev->length;
    rec.audio_position = ev->audio_position;
    rec.sample = ev->sample;
    rec.number = 0;
    rec.name_offset = -1;

    switch (ev->type) {
    case espeakEVENT_MARK:
    case espeakEVENT_PLAY:
      if (ev->id.name) {
        rec.name_offset = sp_append_string(ev->id.name, strlen(ev->id.name));
      }
      break;
    case espeakEVENT_PHONEME:
      /* id.string is 8 bytes and is not guaranteed to be NUL-terminated. */
      rec.name_offset =
          sp_append_string(ev->id.string, strnlen(ev->id.string, 8));
      break;
    default:
      rec.number = ev->id.number;
      break;
    }
    sp_buf_append(&sp_events, &rec, sizeof rec);
  }
  return 0; /* keep going */
}

/* ------------------------------------------------------------------------ */
/* Lifecycle                                                                */
/* ------------------------------------------------------------------------ */

static int sp_sample_rate = 0;

/*
 * Initializes espeak-ng against the data directory at `path` inside the
 * Emscripten virtual file system. `options` are espeakINITIALIZE_* flags
 * (the DONT_EXIT flag is always added). Returns the sample rate, or a negative
 * espeak_ng_STATUS on failure.
 */
SP_EXPORT int sp_initialize(const char *path, int options) {
  int rate = espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 500, path,
                               options | espeakINITIALIZE_DONT_EXIT);
  if (rate <= 0) return rate == 0 ? -1 : rate;
  sp_sample_rate = rate;
  espeak_SetSynthCallback(sp_synth_callback);
  return rate;
}

SP_EXPORT int sp_sample_rate_get(void) { return sp_sample_rate; }

SP_EXPORT void sp_terminate(void) {
  espeak_SetSynthCallback(NULL);
  espeak_Terminate();
  free(sp_audio.data);
  free(sp_events.data);
  free(sp_strings.data);
  free(sp_phonemes.data);
  memset(&sp_audio, 0, sizeof sp_audio);
  memset(&sp_events, 0, sizeof sp_events);
  memset(&sp_strings, 0, sizeof sp_strings);
  memset(&sp_phonemes, 0, sizeof sp_phonemes);
  sp_sample_rate = 0;
}

SP_EXPORT const char *sp_version(void) { return espeak_Info(NULL); }

/* ------------------------------------------------------------------------ */
/* Synthesis                                                                */
/* ------------------------------------------------------------------------ */

/*
 * Synthesizes `text` (UTF-8). `flags` are espeakSSML, espeakPHONEMES,
 * espeakENDPAUSE and friends; espeakCHARS_UTF8 is always set. Returns 0 on
 * success or an espeak_ERROR value. Read the result with the sp_audio_* and
 * sp_events_* accessors before the next call, which resets the buffers.
 */
SP_EXPORT int sp_synthesize(const char *text, int flags) {
  sp_buf_reset(&sp_audio);
  sp_buf_reset(&sp_events);
  sp_buf_reset(&sp_strings);
  size_t size = strlen(text) + 1;
  return (int)espeak_Synth(text, size, 0, POS_CHARACTER, 0,
                           (unsigned int)(flags | espeakCHARS_UTF8), NULL,
                           NULL);
}

SP_EXPORT const short *sp_audio_data(void) {
  return (const short *)sp_audio.data;
}
SP_EXPORT int sp_audio_samples(void) {
  return (int)(sp_audio.len / sizeof(short));
}
SP_EXPORT const void *sp_events_data(void) { return sp_events.data; }
SP_EXPORT int sp_events_count(void) {
  return (int)(sp_events.len / sizeof(sp_event));
}
SP_EXPORT int sp_event_size(void) { return (int)sizeof(sp_event); }
SP_EXPORT const char *sp_strings_data(void) {
  return (const char *)sp_strings.data;
}

/* ------------------------------------------------------------------------ */
/* Phonemes                                                                 */
/* ------------------------------------------------------------------------ */

/*
 * Converts `text` to a phoneme string using the current voice. `phoneme_mode`
 * is the espeak_TextToPhonemes mode word (bit 1 selects IPA, bits 8-23 carry a
 * separator character). espeak-ng works one clause at a time, so the clauses
 * are joined with a newline, which matches the `espeak-ng -x` CLI output.
 */
SP_EXPORT const char *sp_text_to_phonemes(const char *text, int phoneme_mode) {
  sp_buf_reset(&sp_phonemes);
  const void *ptr = text;
  int first = 1;
  while (ptr) {
    const char *clause = espeak_TextToPhonemes(&ptr, espeakCHARS_UTF8,
                                               phoneme_mode);
    if (!clause) break;
    if (!first) sp_buf_append(&sp_phonemes, "\n", 1);
    first = 0;
    sp_buf_append(&sp_phonemes, clause, strlen(clause));
  }
  static const char nul = 0;
  sp_buf_append(&sp_phonemes, &nul, 1);
  return (const char *)sp_phonemes.data;
}

/* ------------------------------------------------------------------------ */
/* Voices                                                                   */
/* ------------------------------------------------------------------------ */

static const espeak_VOICE **sp_voices = NULL;
static int sp_voices_len = 0;

static void sp_refresh_voices(void) {
  sp_voices = espeak_ListVoices(NULL);
  sp_voices_len = 0;
  if (!sp_voices) return;
  while (sp_voices[sp_voices_len]) sp_voices_len++;
}

SP_EXPORT int sp_voice_count(void) {
  sp_refresh_voices();
  return sp_voices_len;
}

static const espeak_VOICE *sp_voice_at(int i) {
  if (!sp_voices || i < 0 || i >= sp_voices_len) return NULL;
  return sp_voices[i];
}

SP_EXPORT const char *sp_voice_name(int i) {
  const espeak_VOICE *v = sp_voice_at(i);
  return v ? v->name : NULL;
}
SP_EXPORT const char *sp_voice_identifier(int i) {
  const espeak_VOICE *v = sp_voice_at(i);
  return v ? v->identifier : NULL;
}
/*
 * The languages field is a list of (priority byte, NUL-terminated name) pairs
 * ending with a 0 priority byte. The TypeScript side walks it.
 */
SP_EXPORT const char *sp_voice_languages(int i) {
  const espeak_VOICE *v = sp_voice_at(i);
  return v ? v->languages : NULL;
}
SP_EXPORT int sp_voice_gender(int i) {
  const espeak_VOICE *v = sp_voice_at(i);
  return v ? v->gender : 0;
}
SP_EXPORT int sp_voice_age(int i) {
  const espeak_VOICE *v = sp_voice_at(i);
  return v ? v->age : 0;
}

SP_EXPORT int sp_set_voice_by_name(const char *name) {
  return (int)espeak_SetVoiceByName(name);
}

SP_EXPORT int sp_set_voice_by_properties(const char *name, const char *language,
                                         int gender, int age, int variant) {
  espeak_VOICE props;
  memset(&props, 0, sizeof props);
  props.name = (name && *name) ? name : NULL;
  props.languages = (language && *language) ? language : NULL;
  props.gender = (unsigned char)gender;
  props.age = (unsigned char)age;
  props.variant = (unsigned char)variant;
  return (int)espeak_SetVoiceByProperties(&props);
}

SP_EXPORT const char *sp_current_voice_name(void) {
  espeak_VOICE *v = espeak_GetCurrentVoice();
  return v ? v->name : NULL;
}

SP_EXPORT const char *sp_current_voice_languages(void) {
  espeak_VOICE *v = espeak_GetCurrentVoice();
  return v ? v->languages : NULL;
}

/*
 * Dictionaries are loaded on demand from the data directory, and the
 * JavaScript side may not have put every `<lang>_dict` file there yet (a
 * browser only fetches the languages it was asked for). espeak-ng records the
 * dictionary a voice wants in `dictionary_name` before trying to open it, and
 * leaves the translator without dictionary data when the file is missing, so
 * these two let the loader find out which file to fetch and retry.
 */
SP_EXPORT const char *sp_dictionary_name(void) { return dictionary_name; }

SP_EXPORT int sp_dictionary_loaded(void) {
  return translator != NULL && translator->data_dictlist != NULL;
}

/* ------------------------------------------------------------------------ */
/* Parameters                                                               */
/* ------------------------------------------------------------------------ */

SP_EXPORT int sp_set_parameter(int parameter, int value, int relative) {
  return (int)espeak_SetParameter((espeak_PARAMETER)parameter, value, relative);
}

SP_EXPORT int sp_get_parameter(int parameter, int current) {
  return espeak_GetParameter((espeak_PARAMETER)parameter, current);
}

SP_EXPORT int sp_set_punctuation_list(const wchar_t *list) {
  return (int)espeak_SetPunctuationList(list);
}
