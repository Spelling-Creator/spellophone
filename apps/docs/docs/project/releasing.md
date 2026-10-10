# Versioning and releases

## Where the package is published

Spellophone was made for [Spelling Creator](https://spellingcreator.org), and
that is where it is expected to be used, so it is published to the
organization's own registry,
[GitHub Packages](https://github.com/orgs/Spelling-Creator/packages), under the
organization's scope, as `@spelling-creator/spellophone`. It is the first
Spelling Creator package published anywhere; the monorepo's `core` package may
follow the same route one day.

GitHub Packages needs a token even to read public packages. To install:

1. Create a [personal access token](https://github.com/settings/tokens) with
   the `read:packages` scope (a classic token; fine-grained tokens do not
   cover packages yet).
2. Tell your package manager that the `@spelling-creator` scope lives on
   GitHub. In the project's `.npmrc` (or `~/.npmrc`):

   ```ini
   @spelling-creator:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```

3. Export the token and install:

   ```bash
   export GITHUB_TOKEN=ghp_...
   pnpm add @spelling-creator/spellophone
   ```

In GitHub Actions, `secrets.GITHUB_TOKEN` already has `read:packages` for
repositories in the same organization, so step 1 is not needed there.

The data for browsers does not go through the registry at all: the `cdn`
option fetches it from jsDelivr's GitHub endpoint, which serves the files
committed in this repository at the release tag. See
[Browsers and workers](../guide/browser.md#fetch-it-from-jsdelivr).

### npmjs.com

The release workflow also publishes to npmjs.com when the repository has an
`NPM_TOKEN` secret. Nothing in the library depends on that; it is there so the
package can be installed without a GitHub token if the maintainers decide to
publish there.

## Versioning

Spellophone follows [Semantic Versioning](https://semver.org/). While the
major version is 0, minor versions may contain breaking changes, which the
changelog calls out.

What counts as part of the public API:

- Everything exported from `@spelling-creator/spellophone`, `/node`, `/browser`
  and `/core`, and the types of those exports.
- The layout of `espeak-ng-data/` and `manifest.json` (its `version` field is
  bumped on incompatible changes).
- The `createEspeak` options.

What does not:

- The `sp_*` functions in the wasm module and `wasm/espeak-ng.d.ts`.
- The exact phoneme output or audio for a given text, which follows espeak-ng.
  An espeak-ng upgrade is a minor version.

## Making a release

Publishing happens when a GitHub release is published. The workflow in
`.github/workflows/release.yml` does the rest.

1. Update `CHANGELOG.md`: move the `Unreleased` entries under the new version
   with today's date.
2. Bump the version in `packages/spellophone/package.json`:

   ```bash
   pnpm --filter @spelling-creator/spellophone exec pnpm version minor --no-git-tag-version
   ```

3. Commit and push to `main`.

   ```bash
   git commit -am "Release 0.2.0"
   git push origin main
   ```

4. Create the release on GitHub (Releases, "Draft a new release", or
   `gh release create v0.2.0 --generate-notes`). The tag must be `v` plus the
   version in `package.json`; the workflow checks that they match. The
   changelog section makes good release notes.

5. Publishing the release runs the workflow: it builds the package, runs the
   tests, verifies the committed wasm and data match a fresh build, publishes
   to GitHub Packages (and npmjs.com if configured) and attaches the tarball
   to the release.

The release's tag is also what makes the `cdn` option work for that version:
jsDelivr resolves `@v0.2.0` to the tagged commit.
