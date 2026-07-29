---
name: release
description: Cut a release of otpless-headless-rn — version bump, changelog promotion, release-it mechanics, npm publish. Use when asked to release, bump the package version, publish to npm, or prepare a release PR.
---

# Release procedure

Releases publish `otpless-headless-rn` to npm. Follow in order; stop and report if any step fails.

## 1. Pre-flight

- Working tree clean, on an up-to-date `main` (or a release branch cut from it).
- `make gate` passes.
- This repo's Atlas page reflects current HEAD (the `atlas-docs` PR job is green) — if not, run the
  **docs-sync** skill first.
- Parity check: if this release changes the response envelope or public TS surface, confirm
  `react-native-headless-lite` has a coordinated plan (see the parity rule in `CLAUDE.md`). Breaking entries
  in the changelog must carry `**BREAKING:**`.

## 2. Version bump

Semver: patch = fixes, minor = additive features, major = anything breaking (CLAUDE.md — "when in
doubt, it's breaking"). Two ways to bump:

- **Preferred:** let `release-it` do it interactively (step 4) — it prompts for the new version
  and writes `package.json` itself.
- **Manual pre-check:** if you need to know the version ahead of time (e.g. for the changelog
  promotion in step 3), edit `package.json`'s `"version"` field directly; `release-it` will detect
  it's already bumped and skip re-prompting, or you can let it drive the whole thing in step 4
  instead of pre-editing.

**`otpless-headless-rn.podspec` needs NO manual edit** — `s.version = package["version"]` reads
`package.json`'s version at pod-install/pack time (verified by reading the podspec). Don't hand-
edit a version string into the podspec; it would just be overwritten by the derived value anyway
and could mislead a reviewer into thinking it's independently versioned.

## 3. Changelog promotion

Per the docs-sync skill: rename `## Unreleased` to `## <version> — <date> (#NN — PR title)`.
Unlike the Android SDKs, there is no AAR-size table to update here — record the current
`npm pack --dry-run` size (packed/unpacked bytes, file count) as a one-line note if it moved
meaningfully from the size-review skill's last recorded baseline; otherwise this step is just the
heading rename.

## 4. `release-it`

```bash
yarn release
```

This runs `release-it` (config in `package.json` → `"release-it"`): prompts for/confirms the
version, commits (`chore: release ${version}`), tags (`v${version}`), generates a GitHub Release
from Angular-preset conventional-changelog commit history (via
`@release-it/conventional-changelog`) — this is separate from and complementary to the hand-
curated `CHANGELOG.md` (see its preamble) — and publishes to npm (`npm.publish: true` in the
config). Needs npm publish credentials configured in the environment (`npm login` / `NPM_TOKEN`)
and push access to `main` for the tag — this step is not run by an agent without those credentials
present; if you don't have them, stop here and hand off the actual `yarn release` invocation to
someone who does, having completed steps 1-3.

## 5. Finalize

- Confirm the npm package published (`npm view otpless-headless-rn version`) matches the new
  version.
- Confirm the GitHub Release was created with the expected conventional-changelog body.
- After merge, the `atlas-docs` workflow's `sync-from-source` job regenerates this repo's
  mechanical Atlas pages; authored pages (including any version header) need an Atlas PR by hand.
- If the release included a public-TS-surface change, smoke-test a consuming app (or at least
  `example/`, bootstrapped) against the newly published version before announcing widely.
