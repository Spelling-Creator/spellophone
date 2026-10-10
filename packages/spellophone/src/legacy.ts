// The legacy build: the browser API on top of the wasm2js module, bundled
// with everything it needs and lowered to ES5 by swc (see tsdown.config.ts),
// for engines without WebAssembly or without modern JavaScript.

import { gunzipSync, strFromU8 } from "fflate";
import type { DataEncoding, Espeak } from "./core.ts";
import { decode, httpDataSource } from "./core.ts";
import type { BrowserEspeakOptions } from "./web.ts";
import { createWebEspeak, resolveDataUrl } from "./web.ts";
import { createWasm2jsModule } from "./wasm2js.ts";

export * from "./core.ts";
export { resolveDataUrl } from "./web.ts";
export { createWasm2jsModule } from "./wasm2js.ts";

/**
 * The browser options, minus `wasmUrl` and `fallback`: there is no wasm to
 * locate or to fall back from.
 */
export type LegacyEspeakOptions = Omit<
  BrowserEspeakOptions,
  "wasmUrl" | "fallback"
>;

/** `decode`, falling back to fflate where `DecompressionStream` is missing. */
function legacyDecode(
  bytes: Uint8Array,
  encoding: DataEncoding,
): Promise<Uint8Array> {
  if (encoding === "gzip" && typeof DecompressionStream === "undefined") {
    return Promise.resolve(gunzipSync(bytes));
  }
  return decode(bytes, encoding);
}

/**
 * The part of `fetch` that `httpDataSource` uses, over XMLHttpRequest, for
 * engines that have no `fetch`.
 */
function xhrFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "arraybuffer";
    xhr.addEventListener("load", () => {
      const body = new Uint8Array(xhr.response as ArrayBuffer);
      const response: Pick<
        Response,
        "ok" | "status" | "statusText" | "arrayBuffer" | "json"
      > = {
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        arrayBuffer: () => Promise.resolve(body.buffer),
        json: () => Promise.resolve(JSON.parse(strFromU8(body))),
      };
      resolve(response as Response);
    });
    // Like fetch, reject for anything that ends the request without a
    // response, so a caller is never left waiting.
    for (const type of ["error", "abort", "timeout"]) {
      xhr.addEventListener(type, () => {
        reject(new TypeError(`Failed to fetch ${url} (${type})`));
      });
    }
    xhr.send();
  });
}

/**
 * Creates a ready-to-use espeak-ng instance without WebAssembly. Works like
 * the browser entry point's `createEspeak`; synthesis is about seven times
 * slower.
 */
export async function createEspeak(
  options: LegacyEspeakOptions = {},
): Promise<Espeak> {
  const dataUrl = resolveDataUrl(options);
  const fetchImpl =
    options.fetch ?? (typeof fetch === "function" ? fetch : xhrFetch);
  return createWebEspeak(
    createWasm2jsModule(),
    httpDataSource(dataUrl, fetchImpl, legacyDecode),
    options,
  );
}
