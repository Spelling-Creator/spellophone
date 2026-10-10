// The legacy build, as published: dist/legacy is rebuilt first, then checked
// for ES5 syntax and run in a context stripped of the newer built-ins IE 11
// lacks. Also the browser entry point's fallback to the wasm2js module.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { parse } from "acorn";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type * as Legacy from "./legacy.ts";
import { DATA_DIR } from "./node.ts";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const legacyDir = join(packageDir, "dist", "legacy");
const DATA_URL = "https://example.test/espeak-ng-data/";

describe("legacy build", () => {
  // Only the legacy configs (see tsdown.config.ts), so the test always runs
  // against the current source without rebuilding the rest of dist.
  beforeAll(() => {
    const build = spawnSync("pnpm", ["exec", "tsdown", "--filter", "legacy"], {
      cwd: packageDir,
      encoding: "utf8",
    });
    if (build.status !== 0) {
      throw new Error(
        `Building the legacy bundle failed:\n${build.stdout}\n${build.stderr}`,
      );
    }
  }, 120_000);

  it.each(["spellophone.iife.js", "spellophone.js"])(
    "%s is ES5 with nothing left to import",
    (file) => {
      const code = readFileSync(join(legacyDir, file), "utf8");
      const program = parse(code, {
        ecmaVersion: 5,
        sourceType: file.endsWith(".iife.js") ? "script" : "module",
      });
      expect(program.body.map((node) => node.type)).not.toContain(
        "ImportDeclaration",
      );
    },
  );

  it("runs without WebAssembly or any modern built-in", async () => {
    const context = createContext({
      console,
      setTimeout,
      XMLHttpRequest: FakeXMLHttpRequest,
    });
    runInContext(
      `window = self = this; (${stripToEs5.toString()})();`,
      context,
    );
    expect(runInContext("typeof WebAssembly + typeof Promise", context)).toBe(
      "undefinedundefined",
    );

    runInContext(
      readFileSync(join(legacyDir, "spellophone.iife.js"), "utf8"),
      context,
    );
    const { createEspeak } = runInContext(
      "Spellophone",
      context,
    ) as typeof Legacy;
    const espeak = await createEspeak({
      dataUrl: DATA_URL,
      languages: ["de"],
    });
    expect(espeak.phonemes("hello", { voice: "en-us" })).toBe("həlˈoʊ");
    expect(espeak.phonemes("Haus", { voice: "de" })).toBe("hˈaʊs");
    const { samples, events } = espeak.synthesize("Hello world.", {
      voice: "en-us",
    });
    expect(samples.length).toBeGreaterThan(5000);
    expect(events.filter((e) => e.type === "word")).toHaveLength(2);
    await espeak.loadVoice("fr");
    expect(espeak.phonemes("bonjour")).toBe("bɔ̃ʒˈuʁ");
    espeak.dispose();
  }, 120_000);
});

describe("browser fallback to wasm2js", () => {
  // canCompileWasm remembers its answer, so each test gets a fresh module.
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the fallback when WebAssembly is unavailable", async () => {
    vi.stubGlobal("WebAssembly", undefined);
    const { canCompileWasm, createEspeak } = await import("./browser.ts");
    expect(canCompileWasm()).toBe(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fallback = vi.fn(() => import("./wasm2js.ts"));

    const espeak = await createEspeak({
      dataUrl: DATA_URL,
      fetch: fileFetch,
      fallback,
    });
    expect(fallback).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/wasm2js/));
    expect(espeak.phonemes("hello", { voice: "en-us" })).toBe("həlˈoʊ");
    espeak.dispose();
  }, 120_000);

  it("probes only once when a Content-Security-Policy blocks WebAssembly", async () => {
    let compiles = 0;
    vi.stubGlobal("WebAssembly", {
      Module: function Module() {
        compiles++;
        throw new Error("Refused to compile WebAssembly (CSP)");
      },
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { canCompileWasm, createEspeak } = await import("./browser.ts");
    const espeak = await createEspeak({
      dataUrl: DATA_URL,
      fetch: fileFetch,
      fallback: () => import("./wasm2js.ts"),
    });
    expect(canCompileWasm()).toBe(false);
    expect(compiles).toBe(1);
    espeak.dispose();
  }, 120_000);

  it("does not load the fallback when WebAssembly works", async () => {
    const { createEspeak } = await import("./browser.ts");
    const fallback = vi.fn(() => import("./wasm2js.ts"));
    const espeak = await createEspeak({
      dataUrl: DATA_URL,
      fetch: fileFetch,
      fallback,
    });
    expect(fallback).not.toHaveBeenCalled();
    espeak.dispose();
  });
});

/** Serves DATA_URL from the package's data directory. */
function dataFile(url: string): string {
  if (!url.startsWith(DATA_URL)) throw new Error(`Unexpected URL ${url}`);
  return join(DATA_DIR, url.slice(DATA_URL.length));
}

async function fileFetch(input: string | URL | Request): Promise<Response> {
  try {
    return new Response(await readFile(dataFile(String(input))));
  } catch {
    return new Response(null, { status: 404, statusText: "Not Found" });
  }
}

/** Just enough of XMLHttpRequest for the legacy build's xhrFetch. */
class FakeXMLHttpRequest {
  status = 0;
  statusText = "";
  responseType = "";
  response: ArrayBuffer | null = null;
  #url = "";
  #listeners = new Map<string, () => void>();

  open(_method: string, url: string): void {
    this.#url = url;
  }

  addEventListener(type: string, listener: () => void): void {
    this.#listeners.set(type, listener);
  }

  send(): void {
    readFile(dataFile(this.#url)).then(
      (bytes) => {
        this.status = 200;
        this.statusText = "OK";
        this.response = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        );
        this.#listeners.get("load")?.();
      },
      () => {
        this.status = 404;
        this.statusText = "Not Found";
        this.response = new ArrayBuffer(0);
        this.#listeners.get("load")?.();
      },
    );
  }
}

/**
 * Removes, inside a vm context, the ES2015 and later built-ins IE 11 does not
 * have, so that anything the polyfills miss fails here rather than in IE 11.
 * Runs as a string in that context, so it must be ES5 itself and refer to
 * nothing outside.
 */
function stripToEs5(): void {
  var global = Function("return this")();
  var typedArray = Object.getPrototypeOf(Int8Array.prototype);
  var removals: [object, string[]][] = [
    [
      typedArray,
      ["at", "copyWithin", "entries", "every", "fill", "filter", "find"]
        .concat(["findIndex", "findLast", "findLastIndex", "forEach"])
        .concat(["includes", "indexOf", "join", "keys", "lastIndexOf", "map"])
        .concat(["reduce", "reduceRight", "reverse", "slice", "some", "sort"])
        .concat(["toLocaleString", "toReversed", "toSorted", "values"])
        .concat(["with"]),
    ],
    [Object.getPrototypeOf(Int8Array), ["from", "of"]],
    [
      Array.prototype,
      ["at", "copyWithin", "entries", "fill", "find", "findIndex", "findLast"]
        .concat(["findLastIndex", "flat", "flatMap", "includes", "keys"])
        .concat(["toReversed", "toSorted", "toSpliced", "values", "with"]),
    ],
    [Array, ["from", "of"]],
    [
      String.prototype,
      ["at", "codePointAt", "endsWith", "includes", "isWellFormed"]
        .concat(["matchAll", "normalize", "padEnd", "padStart", "repeat"])
        .concat(["replaceAll", "startsWith", "toWellFormed", "trimEnd"])
        .concat(["trimLeft", "trimRight", "trimStart"]),
    ],
    [String, ["fromCodePoint", "raw"]],
    [
      Object,
      [
        "assign",
        "entries",
        "fromEntries",
        "getOwnPropertyDescriptors",
        "is",
      ].concat(["getOwnPropertySymbols", "groupBy", "hasOwn", "values"]),
    ],
    [
      Number,
      ["isFinite", "isInteger", "isNaN", "isSafeInteger", "parseFloat"]
        .concat(["parseInt", "EPSILON", "MAX_SAFE_INTEGER"])
        .concat(["MIN_SAFE_INTEGER"]),
    ],
    [
      Math,
      ["acosh", "asinh", "atanh", "cbrt", "clz32", "cosh", "expm1", "fround"]
        .concat(["hypot", "imul", "log10", "log1p", "log2", "sign", "sinh"])
        .concat(["tanh", "trunc", "f16round", "sumPrecise"]),
    ],
    [
      global,
      ["AggregateError", "Atomics", "BigInt", "BigInt64Array"]
        .concat(["BigUint64Array", "Float16Array", "Iterator"])
        .concat(["Blob", "DecompressionStream", "FinalizationRegistry"])
        .concat(["Map", "Promise", "Proxy", "Reflect", "Response", "Set"])
        .concat(["SharedArrayBuffer", "Symbol", "TextDecoder", "TextEncoder"])
        .concat(["URL", "URLSearchParams", "WeakMap", "WeakRef", "WeakSet"])
        .concat(["WebAssembly", "fetch", "globalThis", "queueMicrotask"])
        .concat(["structuredClone"]),
    ],
  ];
  // Symbol-keyed iterators go first, while Symbol still exists.
  delete (typedArray as Record<symbol, unknown>)[Symbol.iterator];
  delete (Array.prototype as unknown as Record<symbol, unknown>)[
    Symbol.iterator
  ];
  delete (String.prototype as unknown as Record<symbol, unknown>)[
    Symbol.iterator
  ];
  for (var i = 0; i < removals.length; i++) {
    var target = removals[i]![0] as Record<string, unknown>;
    var names = removals[i]![1];
    for (var j = 0; j < names.length; j++) delete target[names[j]!];
  }
}
