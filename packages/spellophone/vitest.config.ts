import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const pkg: { version: string } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

// The wasm and data are build output, not in git. Say so up front rather
// than let every test fail on a missing import.
for (const built of ["./wasm/espeak-ng.js", "./espeak-ng-data/manifest.json"]) {
  if (!existsSync(new URL(built, import.meta.url))) {
    throw new Error(
      `${built.slice(2)} is missing. Build the wasm and data first: mise install, then pnpm build (see apps/docs/docs/project/building.md).`,
    );
  }
}

export default defineConfig({
  define: {
    __SPELLOPHONE_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
