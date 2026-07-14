---
name: size-review
description: npm package size measurement for otpless-headless-rn. Use on every PR review touching src/, android/, ios/, or package.json's files/dependencies, when asked about package size or size regressions, or before adding a dependency.
---

# npm package size review protocol

The published artifact is a thin bridge consumed by every merchant's React Native bundle — every
byte here ships everywhere. Run this on every change that touches `src/`, `android/`, `ios/`, or
`package.json`'s `dependencies`/`files` list.

## 1. Measure, never estimate

```bash
npm pack --dry-run
```

This runs the `prepack` script (`bob build`) first, then prints the exact tarball contents, packed
size, unpacked size, and file count — no need to actually publish or even write the `.tgz` to
measure it.

**Baseline (measured 2026-07-14, v2.2.0, on `feat/ai-agent-ready` before any size-relevant
change): 20.1 kB packed / 74.6 kB unpacked, 28 files.** Revalidate this note whenever you cite it
— don't assume it's still current on a stale read of this skill; re-run the command.

Build the **base** commit and the **head** commit and report the delta. Any PR adding
**> 2 kB packed** should be justified explicitly (what changed, why it can't be smaller); a new
`dependencies` entry should be challenged regardless of its own size, per constitution article 5
("default answer is no").

To attribute growth: `npm pack --dry-run` already lists every file's individual size in the
tarball-contents output above — diff that list between base and head rather than guessing.

## 2. What actually ships (per `package.json`'s `"files"` list)

`src`, `lib` (bob's build output — commonjs/module/typescript), `android`, `ios`, `cpp`, any
`*.podspec`, minus `lib/typescript/example`, `ios/build`, `android/build`, `android/gradle*`,
`android/local.properties`, and any `__tests__`/`__fixtures__`/`__mocks__`/dotfile anywhere. This
means:

- **`example/` is never packed** — changes there cannot affect package size; don't spend size-
  review effort on it.
- **`src/__tests__/**` (including the contract fixtures) is never packed** — same reasoning.
- **Both `src/` (TS source) and `lib/` (compiled output) ship** — a change to `src/index.tsx`
  typically costs size roughly twice over (once as source, once compiled three ways into `lib/`)
  because `bob` emits `commonjs` + `module` + `typescript` targets. A larger-than-expected delta
  from a small source change is not automatically suspicious — check whether it's this multiplier
  before flagging it as bloat.
- **`android/` and `ios/` ship as source** (Kotlin/Swift/Obj-C/Gradle files, `.xcodeproj`) — there
  is no shrinking step for the bridge itself (Android's own `minifyEnabled false`, per
  `docs/SDK-GUIDE.md` §3); the bridge module is not R8-minified. Size discipline here means "don't
  add unnecessary native files," not "shrink the build output."

## 3. New dependency checklist

- **Default answer is no** (constitution article 5) — a thin bridge should not need runtime JS
  dependencies beyond `react`/`react-native` peers.
- If unavoidable: stable release only (never alpha/beta/RC), justify in the PR, add to
  `package.json` (not a lockfile-only pin — there is no committed root lockfile), record in
  `CHANGELOG.md`.
- A new **devDependency** (build/lint/test tooling) doesn't affect the shipped package size at
  all (it's not in `"files"`) — still worth a sanity check against `.github/dependabot.yml`'s
  scope, but not a size-review blocker.

## 4. Native SDK pin bumps

A pin bump in `android/build.gradle` or `otpless-headless-rn.podspec` doesn't change *this*
package's tarball size (native SDKs are pulled by Gradle/CocoaPods at merchant build time, not
bundled into the npm tarball) — but it does change the merchant's own app size downstream. That
tradeoff belongs to the **bump-native-sdk** skill, not this one; don't conflate the two budgets.

## 5. Reporting

Report a size table (base/head/delta in both packed and unpacked bytes, file count), a one-line
note on which multiplier (source-only vs. source+lib) explains the delta, and a "Suggestions"
section only if the delta is unexplained or exceeds the 2 kB packed guideline above.
