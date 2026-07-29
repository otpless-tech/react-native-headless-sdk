---
name: docs-sync
description: Keep CHANGELOG.md and this repo's Atlas page in sync with bridge code changes. Use whenever code in src/, android/, or ios/ has changed and documentation must be refreshed, when the atlas-docs PR job reports a stale page, when asked to "update the docs/changelog", or after merging any PR that touches the bridge.
---

# Documentation sync protocol

**There is no `docs/` directory in this repo, and none may be added.** Platform documentation lives
in `otpless-tech/atlas` — page `/repos/react-native-headless-sdk`, source path
`repos/react-native-headless-sdk/` in that repo. Atlas is the only home; this repo owns only
`CHANGELOG.md`.

> Atlas's `.atlas/manifest.yml` has **no rule for `react-native-headless-sdk` yet**. Until it does,
> §2 below has nothing to act on and the `atlas-docs` jobs find no page to check — do §1 and §3, and
> say plainly in the PR that the Atlas page does not exist yet rather than implying docs were
> updated.

## 1. Determine what changed

```bash
git log --oneline origin/main..HEAD
git diff origin/main..HEAD --stat -- src/ android/ ios/ package.json otpless-headless-rn.podspec CHANGELOG.md
git diff origin/main..HEAD -- src/ android/src/main/ ios/
```

- If the range is empty or touches only `example/`, there is nothing to sync — stop. Do not rewrite
  prose for no reason.
- Read every changed source file **in full** (not just diff hunks) so edits reflect actual behavior
  — this bridge is small, full-file reads are cheap.

## 2. Update the Atlas page (in Atlas, not here)

Atlas pages are of two kinds, and which one you are looking at decides how you change it:

- **`generated: true` frontmatter** — mechanical, extracted deterministically by Atlas's
  `scripts/atlas_sync.py` from the `source` file named in the frontmatter. **Never hand-edit it.**
  Fix the source artifact in *this* repo (for this bridge that means `api/index.d.ts` /
  `api/models.d.ts`, regenerated with `bash scripts/check-ts-surface.sh --update`); the page follows
  on the next `sync-from-source` run. Editing a generated page in Atlas fails Atlas's CI and would
  be overwritten anyway.
- **No `generated` field** — authored prose. Edit it in Atlas via a PR to `otpless-tech/atlas`,
  following that repo's `CLAUDE.md` (branch, never push `main`).

Source-file → what to re-verify on the page:

| Changed file(s) | Re-verify |
|---|---|
| `src/index.tsx` | Public TS API surface, marshalling contract, example-app usage |
| `src/models.tsx` | Public TS API surface |
| `android/src/main/java/com/otplessheadlessrn/OtplessReactNativeModule.kt` | Android bridge method table, marshalling contract |
| `android/src/main/java/com/otplessheadlessrn/utils.kt` | Android bridge, marshalling (TrueCaller/providerInfo transforms) |
| `android/src/main/java/com/otplessheadlessrn/OtplessReactNativePackage.kt` | Android bridge |
| `android/build.gradle` | Build/toolchain (native pin, compileSdk/minSdk/targetSdk, minifyEnabled) |
| `ios/OtplessHeadlessRN.swift` | iOS bridge method table, marshalling contract |
| `ios/OtplessHeadlessRN.m` / `.h` | iOS bridge (selector declarations — cross-check against `.swift` `@objc` implementations; an undead selector is a known-quirk entry, not silently fine) |
| `otpless-headless-rn.podspec` | Build/toolchain (iOS native pin; `s.version` is derived from `package.json`, not hand-set) |
| `package.json` (`version`, `scripts`, `react-native-builder-bob`, `jest`, `release-it`) | Build/toolchain, public TS surface |
| `.nvmrc`, `engines.node` | Build/toolchain (the Node-version contradiction is a known quirk — don't silently "resolve" it as a docs-only edit) |

Non-negotiable invariants — always check these against the diff:

- **Public TS surface:** every added/removed/changed exported method, param, or type from
  `src/index.tsx`/`src/models.tsx` must be reflected, AND `api/index.d.ts`/`api/models.d.ts`
  refreshed via `bash scripts/check-ts-surface.sh --update` in the same PR (reviewed, not blind).
- **Removed/deprecated public API — mark, never delete:** a deprecated or removed export must stay
  documented. On deprecation, keep its entry prefixed **Deprecated in \<version\> (#PR)** with the
  reason and replacement. On removal, move the entry into a **"Removed & deprecated API history"**
  appendix at the end of the Atlas page (create it if absent) — this appendix only ever grows.
- **Marshalling contract:** any new field forwarded verbatim vs. transformed, any new platform
  inconsistency (like the existing `deliveryChannel` casing gap) must be added to the table. This is
  read by `react-native-headless-lite` maintainers checking parity — flag breaking changes
  explicitly in the changelog.
- **Bridge method tables:** every `@ReactMethod` (Android) / `RCT_EXTERN_METHOD` + `@objc` pair
  (iOS) must have a row. A `.m`-declared selector with no matching `.swift` implementation (like the
  existing `setOneTapDataCallback`/`performOneTap` gap) is a known-quirk entry, not a row you can
  mark "implemented."
- **Channel coverage:** if a change adds JS-reachability for a native-full-SDK capability that was
  previously unreached on one or both platforms (TrueCaller, WebAuthn/passkeys, session management,
  OneTap picker, phone hint), move it out of the "unreached" row into the "reached" column with
  evidence, in the same PR.
- **Quirks:** if a diff *fixes* a listed quirk, delete the entry (and mention it prominently in the
  changelog — several existing quirks are real bugs a merchant could hit). If a diff introduces
  intentional-but-surprising behavior, add one.
- Update the page's declared package version when `package.json`'s `version` changes.

Accuracy rule: never invent behavior — every statement written into the docs must be verifiable in
code read during this run. If ambiguous, describe what the code does, not what it probably intends.

## 3. Update `CHANGELOG.md` (this repo)

- **Unreleased work:** accumulate entries under an `## Unreleased` heading at the top (create it if
  absent). One bullet per merged PR, phrased as user-visible behavior, with the PR number. Prefix
  internal-only work ("Repo & tooling").
- **On a version bump** (`package.json`'s `version` changed): rename `## Unreleased` to
  `## <version> — <date> (#NN — PR title)`.
- Never rewrite history for already-released versions; only append. (`.claude/settings.json` has a
  hook enforcing this mechanically for `CHANGELOG.md` edits.)
- **Breaking changes** get a bold `**BREAKING:**` prefix — `react-native-headless-lite` maintainers
  and merchants both read this file.

## 4. Committing

- Commit message: `docs: update changelog for <short-sha> [docs-sync]`.
- The commit in *this* repo contains **only** `CHANGELOG.md` (and `CLAUDE.md`/this skill if the
  protocol itself changed). Never mix code changes in. Atlas-side edits are a separate PR in Atlas.

## 5. Verify before finishing

There is no local doc fact-check script any more — the check that matters is Atlas's, and it runs in
CI: `.github/workflows/atlas-docs.yml` calls `otpless-tech/atlas/.github/workflows/verify-docs.yml`
on every PR and fails the PR if a page this repo owns is stale. Locally:

```bash
make gate   # source-side only: install, typecheck, lint, test + coverage ratchet, TS surface golden
```

If the `atlas-docs` job reports a stale page, that is real drift — fix the source artifact here (or
the authored page in Atlas), never weaken the check.
