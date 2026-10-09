# WebAssembly build of libespeak-ng plus the Spellophone glue.
#
# Configure with emcmake so the Emscripten toolchain is picked up:
#
#   emcmake cmake -S packages/spellophone/native -B build/wasm -DCMAKE_BUILD_TYPE=Release
#   cmake --build build/wasm
#
# `pnpm --filter @spelling-creator/spellophone build:wasm` runs exactly that (see scripts/build-wasm.ts).
#
# This compiles the vendored espeak-ng sources directly instead of going through
# espeak-ng's own CMakeLists.txt: that one also builds the CLI, fetches libsonic
# from GitHub at configure time and runs the data compiler, none of which make
# sense for a wasm target. The data files are compiled by a native host build
# (see scripts/build-data.ts) and loaded into the virtual file system at run time.

cmake_minimum_required(VERSION 3.20)
project(spellophone C CXX)

if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "This project targets Emscripten. Configure it with emcmake.")
endif()

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

set(ESPEAK_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/../../../vendor/espeak-ng"
  CACHE PATH "Path to the espeak-ng source tree")
get_filename_component(ESPEAK_ROOT "${ESPEAK_ROOT}" ABSOLUTE)
if(NOT EXISTS "${ESPEAK_ROOT}/src/libespeak-ng/speech.c")
  message(FATAL_ERROR "espeak-ng sources not found at ${ESPEAK_ROOT}. Run `pnpm fetch:espeak` first.")
endif()

# Where the data lives inside the Emscripten virtual file system. The
# TypeScript loader mounts or writes the data there before calling sp_initialize.
set(SPELLOPHONE_DATA_PATH "/espeak-ng-data" CACHE STRING "Virtual FS path of espeak-ng-data")

set(SPELLOPHONE_OUTPUT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../wasm"
  CACHE PATH "Directory the .js/.wasm/.d.ts outputs are written to")
get_filename_component(SPELLOPHONE_OUTPUT_DIR "${SPELLOPHONE_OUTPUT_DIR}" ABSOLUTE)

# --- config.h ----------------------------------------------------------------
# Mirrors espeak-ng's cmake/config.cmake for the features that matter in wasm.
include(CheckSymbolExists)
check_symbol_exists(mkstemp "stdlib.h" HAVE_MKSTEMP)
set(USE_ASYNC 0)        # no threads: synthesis is synchronous
set(USE_KLATT 1)
set(USE_LIBPCAUDIO 0)   # no audio device: samples go back to JavaScript
set(USE_LIBSONIC 0)     # rates above 450 wpm need libsonic; not an MVP feature
set(USE_MBROLA 0)       # mbrola spawns an external binary
set(USE_SPEECHPLAYER 1)

file(STRINGS "${ESPEAK_ROOT}/CMakeLists.txt" _espeak_version_line REGEX "^  VERSION [0-9.]+")
string(REGEX REPLACE "^  VERSION ([0-9.]+).*$" "\\1" PROJECT_VERSION "${_espeak_version_line}")
message(STATUS "espeak-ng version: ${PROJECT_VERSION}")

set(ESPEAK_CONFIG_DIR "${CMAKE_CURRENT_BINARY_DIR}/include")
configure_file("${ESPEAK_ROOT}/src/libespeak-ng/config.h.in" "${ESPEAK_CONFIG_DIR}/config.h")

# --- ucd-tools ----------------------------------------------------------------
set(UCD_DIR "${ESPEAK_ROOT}/src/ucd-tools/src")
add_library(ucd STATIC
  "${UCD_DIR}/case.c"
  "${UCD_DIR}/categories.c"
  "${UCD_DIR}/ctype.c"
  "${UCD_DIR}/proplist.c"
  "${UCD_DIR}/scripts.c"
  "${UCD_DIR}/tostring.c"
)
target_include_directories(ucd PUBLIC "${UCD_DIR}/include")

# --- speechPlayer -------------------------------------------------------------
set(SPLAYER_DIR "${ESPEAK_ROOT}/src/speechPlayer")
add_library(speechPlayer STATIC
  "${SPLAYER_DIR}/src/frame.cpp"
  "${SPLAYER_DIR}/src/speechPlayer.cpp"
  "${SPLAYER_DIR}/src/speechWaveGenerator.cpp"
)
target_include_directories(speechPlayer PUBLIC "${SPLAYER_DIR}/include")
target_compile_options(speechPlayer PRIVATE -fno-exceptions -fno-rtti)

# --- libespeak-ng -------------------------------------------------------------
set(LIB_DIR "${ESPEAK_ROOT}/src/libespeak-ng")
add_library(espeak-ng STATIC
  "${LIB_DIR}/common.c"
  "${LIB_DIR}/mnemonics.c"
  "${LIB_DIR}/error.c"
  "${LIB_DIR}/ieee80.c"
  "${LIB_DIR}/compiledata.c"
  "${LIB_DIR}/compiledict.c"
  "${LIB_DIR}/dictionary.c"
  "${LIB_DIR}/encoding.c"
  "${LIB_DIR}/intonation.c"
  "${LIB_DIR}/langopts.c"
  "${LIB_DIR}/numbers.c"
  "${LIB_DIR}/phoneme.c"
  "${LIB_DIR}/phonemelist.c"
  "${LIB_DIR}/readclause.c"
  "${LIB_DIR}/setlengths.c"
  "${LIB_DIR}/soundicon.c"
  "${LIB_DIR}/spect.c"
  "${LIB_DIR}/ssml.c"
  "${LIB_DIR}/synthdata.c"
  "${LIB_DIR}/synthesize.c"
  "${LIB_DIR}/tr_languages.c"
  "${LIB_DIR}/translate.c"
  "${LIB_DIR}/translateword.c"
  "${LIB_DIR}/voices.c"
  "${LIB_DIR}/wavegen.c"
  "${LIB_DIR}/speech.c"
  "${LIB_DIR}/espeak_api.c"
  "${LIB_DIR}/klatt.c"
  "${LIB_DIR}/sPlayer.c"
)
# include/ must come before espeak-ng's compat/ directory: see include/wchar.h.
target_include_directories(espeak-ng
  PUBLIC
    "${CMAKE_CURRENT_SOURCE_DIR}/include"
    "${ESPEAK_ROOT}/src/include"
    "${ESPEAK_ROOT}/src/include/compat"
  PRIVATE "${ESPEAK_CONFIG_DIR}"
)
target_compile_definitions(espeak-ng
  PRIVATE
    LIBESPEAK_NG_EXPORT=1
    "PATH_ESPEAK_DATA=\"${SPELLOPHONE_DATA_PATH}\""
  INTERFACE
    LIBESPEAK_NG_EXPORT=1
)
target_compile_options(espeak-ng PRIVATE -fno-exceptions -fwrapv -fvisibility=hidden)
target_link_libraries(espeak-ng PRIVATE ucd speechPlayer m)

# --- the wasm module ----------------------------------------------------------
add_executable(spellophone glue.c)
target_link_libraries(spellophone PRIVATE espeak-ng)
# glue.c reads two of libespeak-ng's internal globals (see sp_dictionary_name).
target_include_directories(spellophone PRIVATE "${ESPEAK_CONFIG_DIR}" "${LIB_DIR}")
set_target_properties(spellophone PROPERTIES
  OUTPUT_NAME "espeak-ng"
  SUFFIX ".js"
  RUNTIME_OUTPUT_DIRECTORY "${SPELLOPHONE_OUTPUT_DIR}"
)

# Every sp_* function in glue.c is EMSCRIPTEN_KEEPALIVE, so only the libc
# helpers the TypeScript side calls need listing here.
set(SPELLOPHONE_EXPORTS "_malloc,_free")
set(SPELLOPHONE_RUNTIME_EXPORTS
  "FS,NODEFS,UTF8ToString,stringToUTF8,lengthBytesUTF8,HEAPU8,HEAP16,HEAP32")

target_link_options(spellophone PRIVATE
  "-sMODULARIZE=1"
  "-sEXPORT_ES6=1"
  "-sEXPORT_NAME=createEspeakModule"
  "-sENVIRONMENT=web,worker,node"
  "-sFORCE_FILESYSTEM=1"
  "-lnodefs.js"
  "-sALLOW_MEMORY_GROWTH=1"
  "-sINITIAL_MEMORY=32MB"
  "-sSTACK_SIZE=1MB"
  "-sEXPORTED_FUNCTIONS=${SPELLOPHONE_EXPORTS}"
  "-sEXPORTED_RUNTIME_METHODS=${SPELLOPHONE_RUNTIME_EXPORTS}"
  "-sINCOMING_MODULE_JS_API=locateFile,wasmBinary,print,printErr,instantiateWasm"
  # Keep Node's process-level handlers out of the host application.
  "-sNODEJS_CATCH_EXIT=0"
  "-sNODEJS_CATCH_REJECTION=0"
  "-sMIN_NODE_VERSION=220000"
  "-sTEXTDECODER=2"
  "-sASSERTIONS=0"
  "--emit-tsd=espeak-ng.d.ts"
)
