---
name: docs-sync
description: Sync docs/SDK-GUIDE.md and CHANGELOG.md with bridge code changes. Use whenever code in src/, android/, or ios/ has changed and documentation must be refreshed, when running the docs-sync CI job, when asked to "update the docs/changelog", or after merging any PR that touches the bridge.
---

# Documentation sync protocol

`docs/SDK-GUIDE.md` must always describe the code at `main`'s HEAD. The file
`docs/.doc-sync-state` contains the **commit SHA the docs were last synced to**.

## 1. Determine what changed

```bash
LAST=$(git show origin/main:docs/.doc-sync-state 2>/dev/null || cat docs/.doc-sync-state)
git log --oneline "${LAST}..HEAD"
git diff "${LAST}..HEAD" --stat -- src/ android/ ios/ package.json otpless-headless-rn.podspec CHANGELOG.md
git diff "${LAST}..HEAD" -- src/ android/src/main/ ios/
```

- Read LAST from **origin/main's copy** of `docs/.doc-sync-state` when available, rather than the
  working tree's copy (the working tree may be ahead/behind origin/main). Fall back to the
  working-tree copy only if that `git show` fails.
- If the range is empty or touches only `example/`, docs are current — update only
  `docs/.doc-sync-state` and stop. Do not rewrite prose for no reason.
- If `docs/.doc-sync-state` is missing, **or** `git cat-file -e ${LAST}^{commit}` fails (LAST
  refers to a commit that no longer exists — rewritten/force-pushed history), treat the docs as
  stale and re-verify every section against current code before writing the file with the current
  HEAD SHA. Do not attempt a diff against an unreachable SHA.
- Read every changed source file **in full** (not just diff hunks) so edits reflect actual
  behavior — this bridge is small, full-file reads are cheap.

## 2. Update `docs/SDK-GUIDE.md`

Update **only the sections affected by the diff** — surgical edits, not rewrites. **Section
numbers are stable identifiers — NEVER renumber existing sections.** Add new content as point
subsections of an existing section (e.g. `§7.5`) or append new top-level sections at the end.
Source-file → section map:

| Changed file(s) | SDK-GUIDE sections to re-verify |
|---|---|
| `src/index.tsx` | §4 Public TS API surface, §7 Marshalling contract, §9 Example app usage |
| `src/models.tsx` | §4 Public TS API surface |
| `android/src/main/java/com/otplessheadlessrn/OtplessReactNativeModule.kt` | §5 Android bridge architecture, §7 Marshalling contract |
| `android/src/main/java/com/otplessheadlessrn/utils.kt` | §5 Android bridge architecture, §7 (TrueCaller/providerInfo transforms) |
| `android/src/main/java/com/otplessheadlessrn/OtplessReactNativePackage.kt` | §5 |
| `android/build.gradle` | §3 Build/toolchain (native pin, compileSdk/minSdk/targetSdk, minifyEnabled) |
| `ios/OtplessHeadlessRN.swift` | §6 iOS bridge architecture, §7 Marshalling contract |
| `ios/OtplessHeadlessRN.m` / `.h` | §6 (selector declarations — cross-check against `.swift` `@objc` implementations; an undead selector is a §10 quirk, not silently fine) |
| `otpless-headless-rn.podspec` | §3 (iOS native pin; remember `s.version` is derived from `package.json`, not hand-set) |
| `package.json` (`version`, `scripts`, `react-native-builder-bob`, `jest`, `release-it`) | §3, §4 |
| `.nvmrc`, `engines.node` | §3 (the Node-version contradiction is a known §10 quirk — don't silently "resolve" it as a docs-only edit) |

Non-negotiable invariants — always check these against the diff:

- **Public TS surface (§4):** every added/removed/changed exported method, param, or type from
  `src/index.tsx`/`src/models.tsx` must be reflected, AND `api/index.d.ts`/`api/models.d.ts`
  refreshed via `bash scripts/check-ts-surface.sh --update` in the same PR (reviewed, not blind).
- **Removed/deprecated public API — mark, never delete:** a deprecated or removed export must
  stay documented. On deprecation, keep its §4 entry prefixed **Deprecated in \<version\> (#PR)**
  with the reason and replacement. On removal, move the entry into a **"Removed & deprecated API
  history"** appendix at the end of `docs/SDK-GUIDE.md` (create it if absent) — this appendix only
  ever grows, never shrinks.
- **Marshalling contract (§7):** any new field forwarded verbatim vs. transformed, any new
  platform inconsistency (like the existing `deliveryChannel` casing gap) must be added to the
  table. This is consumed by `otpless-rn-lite` maintainers checking parity — flag breaking changes
  explicitly in the changelog.
- **Bridge method tables (§5/§6):** every `@ReactMethod` (Android) / `RCT_EXTERN_METHOD` + `@objc`
  pair (iOS) must have a row. A `.m`-declared selector with no matching `.swift` implementation
  (like the existing `setOneTapDataCallback`/`performOneTap` gap) is a §10 quirk entry, not a row
  you can mark "implemented."
  - **Channel coverage (§8):** if a change adds JS-reachability for a native-full-SDK capability
    that was previously unreached on one or both platforms (TrueCaller, WebAuthn/passkeys, session
    management, OneTap picker, phone hint), move it out of the "unreached" row into the "reached"
    column with evidence, in the same PR.
- **Quirks (§10):** if a diff *fixes* a listed quirk, delete the entry (and mention it prominently
  in the changelog — several existing quirks are real bugs a merchant could hit). If a diff
  introduces intentional-but-surprising behavior, add one.
- Update the version number in the guide's header note (`package version **X**`) when
  `package.json`'s `version` changes.

Accuracy rule: never invent behavior — every statement written into the docs must be verifiable
in code read during this run. If ambiguous, describe what the code does, not what it probably
intends.

## 3. Update `CHANGELOG.md`

- **Unreleased work:** accumulate entries under an `## Unreleased` heading at the top (create it
  if absent). One bullet per merged PR, phrased as user-visible behavior, with the PR number.
  Prefix internal-only work ("Repo & tooling").
- **On a version bump** (`package.json`'s `version` changed): rename `## Unreleased` to
  `## <version> — <date> (#NN — PR title)`.
- Never rewrite history for already-released versions; only append. (`.claude/settings.json` has
  a hook enforcing this mechanically for `CHANGELOG.md` edits.)
- **Breaking changes** get a bold `**BREAKING:**` prefix — `otpless-rn-lite` maintainers and
  merchants both read this file.

## 4. Stamp the sync state

Write the SHA the docs now describe (single line, full SHA) into `docs/.doc-sync-state`. In CI,
use the SHA of the commit that triggered the run.

## 5. Committing

- Commit message: `docs: sync SDK-GUIDE and CHANGELOG to <short-sha> [docs-sync]` with a body
  listing which sections changed and why.
- The commit contains **only**: `docs/SDK-GUIDE.md`, `docs/.doc-sync-state`, `CHANGELOG.md` (and
  `CLAUDE.md`/this skill if the protocol itself changed). Never mix code changes in.
- **In CI** (`.github/workflows/docs-sync.yml`): only edit the working tree — the workflow opens
  the PR itself. Never commit, push, or create branches from inside the CI agent.

## 6. Verify before finishing

Run `bash scripts/docs-verify.sh` — it **must pass** before this run is considered done. If it
reports any `FAIL`, that is real drift you missed — fix it (in the docs, or in code if the docs
are actually right and code is wrong) and rerun until it passes. Never edit the script to make a
genuine failure disappear.
