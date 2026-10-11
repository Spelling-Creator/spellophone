# Spellophone

## Overview

This is a WebAssembly port of `espeak-ng` by the Spelling Creator organization,
published as `@spelling-creator/spellophone` on npmjs.com. The docs live
at https://spellophone.spellingcreator.org (source in `apps/docs/docs`).

Layout:

- `packages/spellophone`: the library. `native/` holds the C glue and the
  Emscripten CMake project, `src/` the TypeScript, `scripts/` the build steps,
  `wasm/` and `espeak-ng-data/` the build output (not committed).
- `apps/docs`: VitePress docs.
- `examples/node`, `examples/browser`: runnable examples, also built in CI.
- `vendor/espeak-ng`: the pinned espeak-ng checkout (`pnpm fetch:espeak`), not
  committed. `vendor/espeak-ng.json` pins the tag.

Build `wasm/` and `espeak-ng-data/` with `mise install && pnpm build` before
testing or type-checking, and again after bumping espeak-ng or changing
`native/` or the build scripts. The build must stay reproducible: CI builds
on Linux and macOS and fails if the outputs differ.

## Language

TypeScript everywhere, including scripts and configs (Node 24 runs `.ts`
directly). Run scripts with `node scripts/foo.ts`, no tsx or ts-node.

## Verifying in a Browser (for examples)

If you have it installed, use the Playwright MCP for this. If not, use the Playwright CLI instead (see `playwright-cli --help`).

## Searching the Codebase

Use fast, modern tools instead of the slow defaults:

- [`rg`](https://github.com/BurntSushi/ripgrep) (ripgrep) for text search, not `grep`. It respects `.gitignore` and skips `node_modules` for you.
- [`fd`](https://github.com/sharkdp/fd) for finding files by name, not `find`.
- [`ast-grep`](https://ast-grep.github.io) for structural searches and rewrites, like finding every call to a function or every component that uses a certain prop. Call it as `ast-grep`. The `sg` alias is deprecated, so don't use it.
- `jq` for reading and querying JSON.

If your harness has dedicated search or file tools that already wrap these, those are fine too.

## Code Quality

Always lint and format:

```bash
pnpm run fmt && pnpm run lint
```

Formatting is [oxfmt](https://oxc.rs/docs/guide/usage/formatter.md) (`.oxfmtrc.json`)
and linting is [oxlint](https://oxc.rs/docs/guide/usage/linter.md) (`.oxlintrc.json`).
Type-check with `pnpm typecheck` (TypeScript 7) and test with `pnpm test`
(vitest).

Don't skip this. If you must, use `pnpm exec` or `pnpm dlx`, not `npx`.

## Docs (IMPORTANT!!!)

Always update the docs if necessary when changing or adding code. If the docs already contain outdated information, expand your scope to cover that info too.

## Releases

Semantic versioning. Add to `CHANGELOG.md` under `Unreleased` with every
user-facing change. Publishing happens when a GitHub release is published,
with a tag (`vX.Y.Z`) matching the version in
`packages/spellophone/package.json`; see `apps/docs/docs/project/releasing.md`.

## Outdated packages

PLEASE, PLEASE do not use a package that is old or deprecated. EVEN IF IT IS "INDUSTRY STANDARD" THAT DOES NOT MEAN IT IS GOOD!!! USE THE BEST PACKAGE AND LATEST VERSION LIKE A NORMAL PERSON WOULD!

## Keep things human

Do no use em dashes or other special symbols not normally found in writing. Do not word things in a weird way. Keep it looking human. If you need to use, for example, an arrow icon, use an SVG instead.

Replacing an em dash with a hyphen is NOT a fix. A spaced hyphen doing an em dash's job ("the limit - 4 bytes", "fast - but wrong") is the same tic with a different character. Reword the sentence instead: use a comma, a colon, parentheses, or the actual word ("minus", "to", "through"). Plain hyphens in compound words and numeric ranges like 0-1 are fine.

## Use American spelling

It's fine to be British in the chat if the person is actually in a region where its spelled like that. But if not just use American spelling. The library itself MUST use American spelling.
