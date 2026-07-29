# CLAUDE.md — otpless-headless-rn (react-native-headless-sdk)

Instructions for Claude Code (and any AI agent) working in this repository. Human developers: the
same rules apply to you.

## What this repo is

`otpless-headless-rn` (GitHub `otpless-tech/react-native-headless-sdk`, npm `otpless-headless-rn`)
is a **thin React Native bridge** — it has no auth logic of its own. It wraps two independently
versioned native SDKs: OTPLESS's Android "full" SDK (`io.github.otpless-tech:otpless-headless-sdk`,
pinned in `android/build.gradle:77`) and the iOS `OtplessBM` SDK (CocoaPods `OtplessBM/Core`,
pinned in `otpless-headless-rn.podspec:20`). The public surface is a TypeScript facade (`src/`)
over a Kotlin native module (`android/src/main/java/com/otplessheadlessrn/`) and a Swift/Obj-C
native module (`ios/`). **`example/` is a demo app — never document it, never treat its changes
as SDK/bridge changes**, exactly like the Android SDKs' `app/`.

### The guide lives in Atlas, not in this repo

**`otpless-tech/atlas` is the only home for this repo's platform documentation.** There is no
`docs/` directory here and one must not be reintroduced — a second copy of the guide is a second
thing to keep true, and the one that drifts is always the one nobody is gating.

This repo's Atlas page: **`/repos/react-native-headless-sdk`** in
[otpless-tech/atlas](https://github.com/otpless-tech/atlas) (source path
`repos/react-native-headless-sdk/`). Start every non-trivial task by reading it — it is the
canonical, exhaustive description of this bridge (layout, build/toolchain, the public TS surface,
both native bridges method-by-method, the marshalling contract, channel-coverage gaps vs. the
native full SDK, the example app, known quirks). Do not re-derive the architecture from scratch;
trust the page, verify against code where it matters, and fix the page in Atlas if they disagree.

Freshness is gated, not trusted: `.github/workflows/atlas-docs.yml` calls Atlas's `verify-docs`
reusable workflow on **every PR** and fails it if an Atlas page this repo owns has fallen behind
the PR's source, and calls `sync-from-source` on every push to `main` to regenerate the mechanical
pages. `make gate` deliberately does not check docs — it has no Atlas checkout.

Atlas is a **private** repo, so both jobs need an `ATLAS_PAT` repo secret (in a reusable workflow
the caller's `github.token` is scoped to the caller and cannot read Atlas). Both Atlas workflows
preflight the secret and fail with an actionable message if it is absent.

> **Current state, stated plainly:** Atlas's `.atlas/manifest.yml` has **no rule for
> `react-native-headless-sdk` yet**, so the Atlas page does not exist and the `atlas-docs` jobs
> find nothing to check. Until that manifest entry lands, treat the code as the only source of
> truth for this repo and read the target files directly. Adding the manifest entry (and migrating
> the guide content) is tracked outside this repo.

### Making code changes: use the guide first, read code narrowly

When asked for a change, do **not** start by reading the codebase broadly — the Atlas page exists
precisely so you don't have to. Work in this order:

1. **Locate via the Atlas page:** its layout tree names the exact file for anything you're
   touching; it carries the public TS surface method table, the Android/iOS bridge method tables
   (JS call → native method → native SDK call reached), what's forwarded verbatim vs. transformed,
   the channel-coverage gap table, and the known-quirks list — check that last one before assuming
   something is a bug you should fix incidentally. If the page does not exist yet (see above), fall
   back to reading the target files directly.
2. **Read only the target file(s)** — this bridge is small; read a file in full, plus its one or
   two immediate collaborators (e.g. `OtplessReactNativeModule.kt` + `utils.kt`). Do not sweep
   `android/`, `ios/`, and `src/` with broad searches unless the Atlas page has no answer.
3. **Verify before editing:** the page describes intent and structure, but the code is the
   source of truth — confirm the relevant snippet matches the page before changing it. If they
   disagree, the page is stale: fix the code task first, then correct the page in Atlas.
4. **Make the change**, respecting the invariants below (response envelope, no bridge-level data
   collection, TS-surface golden, testbed boundary).

## Build & test

```bash
make gate
```

`gate` = `install` (`yarn install --frozen-lockfile`) → `typecheck` (`tsc --noEmit`) → `lint`
(`eslint "**/*.{js,ts,tsx}"`) → `test` (`jest --coverage`, ratchet enforced via
`package.json`'s `jest.coverageThreshold`, the response-envelope contract-fixture test runs
inside this step too) → `ts-surface` (`scripts/check-ts-surface.sh`). This is the single source of
truth for verification — CLAUDE.md, the **verify** skill, and
`.github/workflows/build-test.yml` all restate this same command list.

The gate is **source-side only**. Doc freshness is a separate, CI-only check
(`.github/workflows/atlas-docs.yml` → Atlas `verify-docs`), because the pages it checks are not in
this repo.

- **Corepack trap:** `package.json`'s `packageManager` field must stay an **exact** pin
  (`"yarn@1.22.15"`, no `^`/`~` range) — Corepack requires an exact version and fails immediately
  with `Unsupported package manager specification` on a range. This bit a real session (fixed on
  `feat/ai-agent-ready`); don't reintroduce a range. Classic Yarn ignores the field entirely, so
  this only affects Corepack-managed `yarn` shims (the modern Node default) — CI is unaffected
  (`actions/setup-node` without Corepack).
- No root `yarn.lock` is committed (`.gitignore` has a bare `yarn.lock` line, intentional) — only
  `example/yarn.lock` is tracked. `yarn install --frozen-lockfile` at the root works fine anyway;
  do not try to commit a root lockfile as a drive-by in an unrelated PR.
- **Version is single-sourced in `package.json`'s `"version"` field.** `otpless-headless-rn.podspec`
  does **not** need a manual bump: `s.version = package["version"]` reads it from `package.json`
  directly (verified by reading the podspec). Bumping the native SDK pins (Android/iOS) is a
  separate decision from bumping this package's own version — see the **bump-native-sdk** skill.
- npm package size is a first-class constraint for this artifact — measured baseline (this
  session, v2.2.0, `npm pack --dry-run`): **20.1 kB packed / 74.6 kB unpacked, 28 files**. See the
  **size-review** skill for how to re-measure and what counts as a regression worth challenging.
- No Android/iOS toolchain step runs in CI today — `make gate` never compiles `android/` or
  `ios/`, and the example app is never built in CI (a known quirk recorded on the Atlas page). A
  change to the native
  bridge files is **not proven by a green gate** — say so explicitly in the PR (see the **verify**
  skill's native-bridge rung).

---

## Repo protocols — invoke the skill, don't improvise

Detailed procedures live as skills in `.claude/skills/`. These are MANDATORY when their trigger
applies:

| Skill | When it applies |
|---|---|
| **docs-sync** | Any time `src/`, `android/`, or `ios/` changed and `CHANGELOG.md` / this repo's Atlas page must catch up (every PR merge; Atlas's `sync-from-source` handles the mechanical pages automatically). Owns the changelog rules. |
| **verify** | Before claiming any change works, after modifying `src/`/`android/`/`ios/`, or when asked to verify/prove a change. The rung ladder from `make gate` up through the CI-only native-build/example-app smoke. |
| **add-tests** | Writing or updating Jest tests — the `NativeModules` mock recipe, the response-envelope contract-fixture rules, and the honest scope of what a JS test can and can't prove about this bridge. |
| **pr-review** | Reviewing any PR or diff against the constitution below, in order, before merge — also checks new PRs don't silently reintroduce a known bug listed on the Atlas page. |
| **release** | Cutting a release: version bump → `make gate` → changelog promotion → `release-it` (tag, npm publish, GitHub release). |
| **size-review** | Every PR: `npm pack --dry-run` measurement against the baseline above. |
| **bump-native-sdk** | Bumping the Android (`android/build.gradle`) or iOS (`otpless-headless-rn.podspec`) native SDK pin — the Android BCV-diff process (goldens exist upstream) and the honestly-scoped iOS process (no committed API golden exists upstream yet). |

Doc-sync state is **not** tracked in this repo. Atlas owns it: each generated page carries
`generated: true` frontmatter naming the source it was extracted from, and `atlas_sync.py --check`
(run by the `atlas-docs` PR job) is what decides whether a page is current. There is no
`docs/.doc-sync-state` here any more. Changelog-only commits still use the `[docs-sync]` marker and
contain only `CHANGELOG.md`.

---

## Wrapper development constitution (MANDATORY for every code change)

This bridge runs inside enterprise merchants' React Native apps. We are a guest in their process
and their bundle: their crash rate, their app size, and their security audit all include us.
Every change is held to these rules — they outrank convenience, and exceptions require an
explicit decision recorded in the PR and the changelog.

### 1. Public API is a contract

The public API is **two things together**: the exported TS surface (`api/index.d.ts` +
`api/models.d.ts` — the `OtplessHeadlessModule` class and everything re-exported from
`src/models.tsx`), and the **response envelope shape** (`{responseType, response, statusCode}`,
documented on the Atlas page) that must survive round-trip unchanged in both directions, on both
platforms.

- **Semver discipline.** Breaking anything a merchant can observe — exported method
  signature/name, parameter order, the envelope's keys, the `"OTPlessEventResult"` event name,
  default behavior — requires a major-version decision, a `**BREAKING:**` changelog entry, and a
  `react-native-headless-lite` parity check (see below). When in doubt, it's breaking.
- **Deprecate, then remove — never remove cold.** Mark with a `@deprecated` TSDoc tag pointing at
  the replacement, keep it working for at least one minor release, then remove — and move its
  entry into a "Removed & deprecated API history" appendix on this repo's Atlas page (create it if
  absent) rather than deleting it, mirroring the android-lite exemplar's "mark, never delete" rule.
- **Additive evolution only.** New optional parameters with defaults, new methods, new response
  fields are safe. Renaming or retyping an existing parameter, field, or the envelope's keys is
  breaking, full stop.
- **`api/index.d.ts` + `api/models.d.ts` are the mechanical contract** — any TS-surface change
  requires a reviewed `bash scripts/check-ts-surface.sh --update` in the same PR (the `ts-surface`
  gate step enforces this).
- **Loose `any` typing is intentional-for-now, not a bug to fix as a drive-by.** `initialize`'s
  `appId: String` (boxed, not primitive), `OtplessResultCallback`, `start(input: any)`, and
  `commitResponse(response: any)` are all deliberately loose (a known quirk on the Atlas page) — tightening
  them is itself a public-API-shape decision (can break structurally-typed callers) and needs its
  own PR with its own changelog entry, not an incidental "improvement" inside an unrelated change.
- **Never leak native platform types across the JS boundary.** Request/response payloads stay
  JSON-shaped plain objects — never a wrapped native type from either platform's SDK.

### 2. Never harm the host app

- **No unhandled promise rejection or native crash may reach merchant code.** The two known bugs
  below (also recorded in the Atlas page's known-quirks section) are exactly the class this article
  exists to prevent — read them before writing a bridge method:
  - **#4 — Android `commitResponse` has no defensive validation.** `getResponseType` calls
    `ResponseTypes.valueOf(responseTypeString)` directly on a string that defaults to `""` when
    missing; a missing/unrecognized `responseType` throws an uncaught `IllegalArgumentException`
    from the native-modules thread. iOS's equivalent defends with fallback defaults instead.
  - **#5 — Android `initTrueCaller`'s promise can hang forever.** `if (currentActivity == null)
    return` exits without resolving or rejecting `promise` — a JS `await initTrueCaller(...)` in
    that state never settles.
  - **Both are known, out-of-scope-for-a-scaffolding-PR bugs** (do not silently "fix" them as a
    side effect of unrelated work — that's a real behavior change needing its own PR/changelog
    entry) — but any **new** bridge method must not repeat either pattern: every `Promise` gets a
    `resolve`/`reject` on every code path, and every enum/string parsed from JS or from the native
    SDK is defensively parsed (`runCatching`/`try?` + a logged fallback), never a direct
    `valueOf`/force-unwrap that can throw across the bridge boundary.
- **Never block the JS thread or the native main thread.** Native SDK calls already run on
  `lifecycleScope`/`Dispatchers.IO` (Android) or inside a cancellable `Task` (iOS) — preserve that
  when adding new bridge methods; don't add a synchronous native call on the UI thread.
- **Release every process-global side effect.** The registered `ActivityEventListener`
  (`reactContext.addActivityEventListener(this)`), the tracked coroutine `Job`/`Task`, and the
  `NativeEventEmitter` listener must all be safely cancelable — `cleanup()`/`decimateAll()` must
  be idempotent and reachable on every exit path (success, failure, and repeated calls).
- **No surprises in the manifest/Info.plist merge.** `android/src/main/AndroidManifest.xml` is
  currently empty and contributes nothing to the manifest merge — any new permission, `<queries>`
  entry, or iOS capability requires explicit product sign-off, same as the native SDKs' own rule.

### 3. Privacy & auditability

- **Verified this session by reading the code: this bridge collects and transmits nothing of its
  own.** `utils.kt`, `OtplessReactNativeModule.kt`, and `OtplessHeadlessRN.swift` were read in
  full — every function either (a) forwards merchant-supplied fields, lightly type-coerced, into
  the native SDK's own request object, or (b) relays the native SDK's own callback/delegate
  payload back to JS unchanged. There is no bridge-level telemetry call, no bridge-level network
  call, and no bridge-level device/PII collection anywhere in `android/` or `ios/`. Any actual data
  collection happens inside the native SDKs (`otpless-headless-sdk` / `OtplessBM`), which own their
  own privacy inventory. **If a future change adds any field collection, logging, or network call
  at the bridge layer itself, that is a new privacy-relevant fact — document it here and on this
  repo's Atlas page in the same PR, before merging, not after.**
- **No PII in logs.** `debugLog` (Android) and the `OtplessLoggerDelegate` print (iOS) are gated
  behind `setDevLogging(true)` — verify any new log statement can't leak a phone number/OTP/token
  even with dev logging enabled, since a merchant could ship a build with it on by mistake.

### 4. Naming conventions

- **Public API speaks merchant language.** No internal OTPLESS codenames belong in `src/`. If a
  native-SDK-internal package name (e.g. `com.otpless.longclaw.tc`) ever needs surfacing at the TS
  layer, re-export it under an `Otpless*`/`OT*`-prefixed name — never the raw internal identifier.
- **TS:** `camelCase` members, `PascalCase` types/interfaces; keep using whichever existing prefix
  a concept already has (`Otpless*` for the module/request/event types, `OT*` for the TrueCaller
  config unions) — don't invent a third prefix for something that already has one.
- **The registered module name is one contract across three files** — Android's companion `NAME`
  (`"OtplessHeadlessRN"`), iOS's `@objc(OtplessHeadlessRN)` class name, and JS's
  `NativeModules.OtplessHeadlessRN` lookup must always agree; they are not independently
  renameable.
- **The `"OTPlessEventResult"` event name is part of the contract** — both platforms emit it and
  `setResponseCallback`/`clearListener` listen for exactly that string. Renaming it requires
  updating all three call sites plus the bridge method tables on this repo's Atlas page in the
  same PR.
- **JSON payload keys:** `lowerCamelCase`, matching the native SDKs' field names exactly — never
  invent a second name for a concept that already has one (e.g. a synonym for `deliveryChannel`).

### 5. Dependencies & size

- **Default answer to a new JS dependency is no.** This is a thin bridge — every dependency now
  ships inside every merchant's `node_modules` and app bundle. `peerDependencies` (`react`,
  `react-native`) stay wide (`"*"`) on purpose; don't narrow them without checking the example
  app's pinned versions and the parity rule below.
- **Native SDK pins are conservative on purpose.** Bump only via the **bump-native-sdk** skill,
  never as an incidental part of an unrelated change.
- **Package size baseline: 20.1 kB packed / 74.6 kB unpacked** (measured this session via
  `npm pack --dry-run`, v2.2.0) — see the **size-review** skill for re-measurement and what counts
  as a regression worth challenging.

### 6. Verification before merge

- **Run `make gate`, not a subset** — see the **verify** skill for the complete rung ladder,
  including which rungs are CI-only or human-only (native builds, the example app).
- **The Jest coverage ratchet must hold** (`package.json` → `jest.coverageThreshold`) — a change
  that lowers coverage below the ratchet without adding tests is a blocking finding, not a nit.
- **A response-envelope shape change needs the contract fixture + test updated in the same PR** —
  see the **add-tests** skill for the honest scope of what that test does and doesn't prove.
- **Native (`android/`, `ios/`) changes are not compiled or tested by `make gate`.** State plainly
  in the PR which native files changed and whether they were hand-verified against the example
  app — do not claim CI proved a native-side change; it didn't (a known quirk on the Atlas page).
- **Parity check.** If the response envelope or public TS surface moved, note a
  `react-native-headless-lite` parity check in the PR per the rule below.

---

## Parity rule (standing rule — not a report of current parity status)

This wrapper's TS ergonomics for concepts it shares with `react-native-headless-lite` (the
phone-number-auth-focused sibling wrapper over the Android "lite" SDK + the same iOS SDK) — the
`start()` request shape, the `"OTPlessEventResult"` event name and envelope, method names like
`initialize`/`commitResponse`/`cleanup` — should stay consistent with
`react-native-headless-lite`'s equivalent surface, so a merchant reading or migrating between the
two doesn't hit gratuitous inconsistency. **This has not been diffed against
`react-native-headless-lite` this session** — treat this as
a standing rule to apply whenever touching shared-concept surface, not a claim about current
parity. Follow the native-sdks hub `CLAUDE.md`'s parity-statement convention in PR descriptions
for changes touching shared concepts: `Parity: ported in <repo>#NN` / `Parity: N/A — <reason>` /
`Parity: port ticket <link>`.

## Worktree-driven development

This repo's primary checkout belongs to whoever is actively working in it interactively — never
switch its branch out from under them. Every independent agentic task gets its own git worktree,
which also lets multiple agents work this repo in parallel without trampling each other:

```bash
git -C <repo> worktree add /tmp/<repo>-<task> <branch>   # work + commit + push from there
git -C <repo> worktree remove /tmp/<repo>-<task>          # always clean up
```

Harness-native isolation (worktree-isolated subagents) counts. Editing directly in the primary
checkout is acceptable only for work a human asked to land on the currently-checked-out branch.

## General working rules

- **Git workflow:** `main` is protected — never push it directly (a `.claude/settings.json` rule
  also denies this locally). Work on a feature branch, open a PR, fill the PR template's
  constitution checklist. CI on every PR: `build-test` (`make gate` + `actionlint`) and
  `atlas-docs`, which calls Atlas's `verify-docs` reusable workflow and fails the PR if an Atlas
  page this repo owns is stale. Merging to `main` additionally triggers `atlas-docs`'s
  `sync-from-source` job, which regenerates this repo's Atlas pages in `otpless-tech/atlas`.
- **Never document or refactor `example/`** unless explicitly asked; it is a testbed, exactly like
  the Android SDKs' `app/`.
- `src/index.tsx` does `export * from './models'` — `src/index.tsx` and `src/models.tsx` together
  are the entire public TS surface; touching either is a contract-adjacent change.
- Response payloads stay loosely-typed `any` by design (see article 1) — don't add runtime
  validation/parsing at the bridge layer without a deliberate, separately-reviewed decision; the
  native SDKs already own response-shape correctness.
- Two independently-versioned native SDKs sit behind this bridge — a native SDK release does not
  by itself require a wrapper version bump, but it does require the **bump-native-sdk** skill's
  compatibility check before the pin in `android/build.gradle` or `otpless-headless-rn.podspec`
  moves.
