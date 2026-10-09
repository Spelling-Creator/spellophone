/*
 * Shim around espeak-ng's compat/wchar.h for the Emscripten (musl) libc.
 *
 * espeak-ng's compat/wctype.h redefines iswalpha() and friends as macros for
 * its own ucd_* implementations. musl's <wchar.h> then declares the same
 * functions a second time (under _BSD_SOURCE, which musl implies in GNU mode),
 * so those declarations get rewritten by the macros into prototypes like
 * `int ucd_islower(wint_t)` that clash with ucd.h's `int ucd_islower(uint32_t)`,
 * because wint_t is `int` on wasm32.
 *
 * This header sits ahead of espeak-ng's compat directory on the include path.
 * It lifts the macros while the real headers are pulled in and puts them back
 * afterwards, so espeak-ng keeps calling the Unicode-aware ucd_* functions.
 */

#pragma GCC system_header

#if defined(iswalnum)
#define SPELLOPHONE_RESTORE_WCTYPE_MACROS 1
#undef iswalnum
#undef iswalpha
#undef iswblank
#undef iswcntrl
#undef iswdigit
#undef iswgraph
#undef iswlower
#undef iswprint
#undef iswpunct
#undef iswspace
#undef iswupper
#undef iswxdigit
#endif

#include_next <wchar.h>

#if defined(SPELLOPHONE_RESTORE_WCTYPE_MACROS)
#undef SPELLOPHONE_RESTORE_WCTYPE_MACROS
#undef iswdigit /* musl defines its own iswdigit macro; ucd's wins */
#define iswalnum ucd_isalnum
#define iswalpha ucd_isalpha
#define iswblank ucd_isblank
#define iswcntrl ucd_iscntrl
#define iswdigit ucd_isdigit
#define iswgraph ucd_isgraph
#define iswlower ucd_islower
#define iswprint ucd_isprint
#define iswpunct ucd_ispunct
#define iswspace ucd_isspace
#define iswupper ucd_isupper
#define iswxdigit ucd_isxdigit
#endif
