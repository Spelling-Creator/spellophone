// A rolldown plugin that lowers the legacy build to ES5 with swc. Oxc, which
// tsdown uses for everything else, only lowers as far as ES2015.
//
// It works in two passes:
//
// 1. transform: each of our own modules (src/ and wasm/) is lowered and gets
//    `import "core-js/modules/..."` lines for the built-ins it uses that the
//    targets lack. The bundler then pulls those polyfills in like any other
//    import. Packages from node_modules are skipped: core-js must not
//    polyfill itself, and pnpm would not let them resolve core-js anyway.
// 2. renderChunk: the finished chunk is lowered again, which catches the
//    bundler's own helpers and anything from node_modules, and minified.
//
// The bundler must not minify or reprint the output afterwards (`minify:
// false`), or the second pass is undone.

import type { Options } from "@swc/core";
import { transform } from "@swc/core";
import type { Rolldown } from "tsdown";

/** The engines the legacy build is for. IE 11 lacks the most of them. */
export const LEGACY_TARGETS = "ie 11";

// tsdown builds the type declarations in the same bundle; leave them alone.
const DECLARATION = /\.d\.[cm]?ts$/;

// These two wrap every `instanceof` and `typeof` in a helper call, only to
// support Symbol.hasInstance and polyfilled symbols, neither of which this
// code relies on. Skipping them keeps the hot paths of the module plain and
// means the second pass needs no helpers at all (see renderChunk).
const EXCLUDE = ["transform-instanceof", "transform-typeof-symbol"];

export function swcEs5(): Rolldown.Plugin {
  return {
    name: "spellophone:swc-es5",
    transform: {
      filter: {
        id: {
          include: /\.[cm]?[jt]s$/,
          // \0 marks virtual modules, such as rolldown's own runtime, which
          // must not import polyfills: they would end up ahead of it.
          exclude: [/node_modules/, /^\0/, DECLARATION],
        },
      },
      async handler(code, id) {
        const result = await transform(code, {
          filename: id,
          sourceMaps: true,
          isModule: true,
          swcrc: false,
          configFile: false,
          jsc: {
            parser: /\.[cm]?ts$/.test(id)
              ? { syntax: "typescript" }
              : { syntax: "ecmascript" },
          },
          env: {
            targets: LEGACY_TARGETS,
            mode: "usage",
            coreJs: "3.50",
            exclude: EXCLUDE,
          },
          module: { type: "es6" },
        });
        return { code: result.code, map: result.map ?? null };
      },
    },
    async renderChunk(code, chunk, outputOptions) {
      if (DECLARATION.test(chunk.fileName)) return null;
      const isModule = outputOptions.format === "es";
      const options: Options = {
        filename: chunk.fileName,
        sourceMaps: true,
        isModule,
        swcrc: false,
        configFile: false,
        minify: true,
        jsc: {
          parser: { syntax: "ecmascript" },
          minify: { compress: true, mangle: true },
        },
        env: { targets: LEGACY_TARGETS, exclude: EXCLUDE },
      };
      if (isModule) options.module = { type: "es6" };
      const result = await transform(code, options);
      // swc puts the helpers a transform needs at the top of the file. In an
      // IIFE that is outside the wrapper, where they would become globals of
      // the page, so make sure nothing needed one.
      if (
        outputOptions.format === "iife" &&
        !result.code.startsWith(`var ${outputOptions.name}=`)
      ) {
        throw new Error(
          `swc added code outside the IIFE of ${chunk.fileName}: ${result.code.slice(0, 200)}`,
        );
      }
      return { code: result.code, map: result.map ?? null };
    },
  };
}
