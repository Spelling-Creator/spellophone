# Versioning and releases

## Where the package is published

Spellophone is published to
[npmjs.com](https://www.npmjs.com/package/@spelling-creator/spellophone) under
the Spelling Creator organization's scope, as `@spelling-creator/spellophone`,
so it installs with no extra registry setup:

```bash
pnpm add @spelling-creator/spellophone
```

Every release also has the package tarball attached on
[GitHub](https://github.com/Spelling-Creator/spellophone/releases). It is the
exact file that was published to npm, so it can be installed directly
(`pnpm add ./spellophone-v0.2.0.tgz`) or compared against the registry.

The `cdn` option fetches the browser data from jsDelivr's npm endpoint, which
serves the `espeak-ng-data` directory of the published package. See
[Browsers and workers](../guide/browser.md#fetch-it-from-jsdelivr).

Version 0.1.0 was published only to GitHub Packages, before the move to
npmjs.com, and its `cdn` option reads from jsDelivr's GitHub endpoint instead.

### Trusted publishing

The release workflow publishes with npm's
[trusted publishing](https://docs.npmjs.com/trusted-publishers): GitHub
Actions hands npm a short-lived OIDC token, and npm accepts it because the
package names this repository and workflow as its trusted publisher. There is
no npm token stored anywhere, and every version gets a
[provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
linking it to the commit and workflow run that built it.

npm only accepts a trusted publisher for a package that already exists, so the
first version on npmjs.com, 0.2.0, was published by hand. It was built locally
from the release tag, and its tarball is byte for byte the one the workflow
built (the build is reproducible), but it has no provenance attestation.
Every version after it comes from the workflow.

The trusted publisher is set on npmjs.com, in the package's settings under
"Trusted publishing", or with
`npm trust github @spelling-creator/spellophone --file release.yml --repository Spelling-Creator/spellophone --allow-publish`:

| Field             | Value              |
| ----------------- | ------------------ |
| Publisher         | GitHub Actions     |
| Organization      | `Spelling-Creator` |
| Repository        | `spellophone`      |
| Workflow filename | `release.yml`      |
| Environment       | (empty)            |

Renaming the workflow file or moving the repository breaks publishing until
this is updated. Once it works, npm recommends setting the package's
publishing access to "Require two-factor authentication and disallow tokens"
so that nothing but the workflow can publish.

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

5. Publishing the release runs the workflow: it builds the package from
   source, wasm and data included, runs the tests, packs the tarball,
   publishes it to npmjs.com and attaches it to the release.

The `cdn` option works for the new version as soon as it is on npmjs.com.
