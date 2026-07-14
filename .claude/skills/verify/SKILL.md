---
name: verify
description: Verification ladder for changes to the otpless-headless-rn React Native bridge. Use before claiming any change works, after modifying src/, android/, or ios/, or when asked to verify/prove a change — make gate covers the TS surface only; native (Kotlin/Swift) changes are not compiled or tested by it.
---

# Verification ladder

Claims of "this works" are only as good as what was actually run. Climb the ladder below to the
rung the change requires, run the commands, and report actual output — not intent.

## Rung 1 — `make gate` (the canonical TS-surface gate)

```bash
make gate
```

Runs, in order: `install` (`yarn install --frozen-lockfile`) → `typecheck` (`tsc --noEmit`) →
`lint` (`eslint "**/*.{js,ts,tsx}"`) → `test` (`jest --coverage`, ratchet enforced via
`package.json`'s `jest.coverageThreshold`) → `ts-surface`
(`bash scripts/check-ts-surface.sh`) → `docs-verify` (`bash scripts/docs-verify.sh`).

- **Corepack trap:** if your `yarn` is Corepack-shimmed (the modern Node default) and
  `package.json`'s `packageManager` field is ever a range again instead of an exact pin, every
  `yarn`/`make gate` invocation fails immediately with `Unsupported package manager
  specification`. If you hit this, fix the field, don't work around it with `npx --yes
  yarn@1.22.15 <command>` as a permanent habit — that's a diagnostic workaround, not the fix.
- `make gate` is mandatory for **any** change to `src/`, `android/`, or `ios/` — even though it
  does not compile or test the native (`android/`, `ios/`) files (see Rung 2). It's the floor,
  not the ceiling.
- This is CI-enforced: `.github/workflows/build-test.yml` runs `make gate` (plus `actionlint`) on
  every PR to `main`.

## Rung 2 — native bridge changes (CI does NOT cover this — say so explicitly)

Nothing in `make gate` or CI compiles `android/` (Kotlin) or `ios/` (Swift/Obj-C), and nothing
builds or runs the `example/` app. This is a real, documented gap (`docs/SDK-GUIDE.md` §10 quirk
#10), not an oversight to silently work around.

If you changed a file under `android/src/main/java/com/otplessheadlessrn/` or `ios/`:

- State plainly in the PR which native files changed.
- If you have an Android/iOS toolchain available locally, hand-build the example app
  (`yarn bootstrap` then a native run) against your change and say so; if you don't have the
  toolchain available, say that too — do not claim it was verified when it wasn't.
- Cross-check the change against `docs/SDK-GUIDE.md` §5 (Android bridge method table) or §6 (iOS
  bridge method table) — a method rename/removal there is a public-API change even though `tsc`
  can't see it (the JS side calls native methods by string name, untyped).
- If the change touches the response envelope (`sendHeadlessEventCallback` on Android,
  `onOtplessResponse`/`commitResponse` on iOS), update the contract fixture and rerun `make gate`
  — see the **add-tests** skill for what that test does and doesn't prove.

## Rung 3 — example-app manual smoke (human-only, or CI-only if a future workflow adds it)

For behavioral changes reachable from JS, exercise the real flow end-to-end in `example/`
(`initialize` → `start` → response) on a real device or simulator/emulator with valid
`APP_ID`/native SDK credentials. This requires the Android/iOS native toolchains
(`yarn bootstrap` + `pod install` for iOS) and is not something an agent without those toolchains
installed can run — state plainly if this rung wasn't exercised rather than claiming it was.

## Which rungs are mandatory

| Change type | Mandatory rungs |
|---|---|
| Any change to `src/**` | 1 |
| Any change to `android/**` or `ios/**` | 1 + 2 |
| Change to the response envelope shape (either platform) | 1 + 2, contract fixture updated |
| Behavioral change reachable from JS (`initialize`/`start`/`commitResponse`/etc.) | 1 + 2, plus note rung 3 for a human/CI-with-toolchain to run |
| Docs-only / `example/`-only change | None of the above — see the `docs-sync` skill instead |

Report which rungs you actually ran and their real output. If a rung couldn't be run in the
current environment (no Android/iOS toolchain, no device), say so explicitly instead of skipping
it silently or claiming it passed.
