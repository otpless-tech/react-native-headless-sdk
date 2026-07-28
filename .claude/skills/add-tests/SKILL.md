---
name: add-tests
description: Recipe for adding or updating Jest tests in the otpless-headless-rn bridge. Use when adding/updating tests, after changing src/index.tsx logic, or when asked to write a test — covers the NativeModules mock pattern, the response-envelope contract fixture, and the honest limits of what a JS test can prove about this bridge.
---

# Adding Jest tests to otpless-headless-rn

## 0. The honest limit — read this first

**100% of this bridge's actual marshalling logic lives in Kotlin
(`android/src/main/java/com/otplessheadlessrn/`) and Swift (`ios/OtplessHeadlessRN.swift`).**
Jest cannot execute either. Every test in this repo either (a) exercises the thin JS-side wrapper
in `src/index.tsx` against a fully mocked `NativeModules.OtplessHeadlessRN`, or (b) checks that a
committed fixture's shape agrees with what the guide documents. Neither proves the native bridge
still marshals correctly — only a native build/run (guide's **verify** skill, Rung 2/3) does that.
Don't oversell test coverage in a PR description; state this scope explicitly if you add a test
implying otherwise.

## 1. Where tests live

`src/__tests__/` — one file per concern so far:

| File | Owns |
|---|---|
| `index.test.tsx` | `OtplessHeadlessModule.userAuthEvent` — the one method with real per-platform branching logic worth a decision table (Android calls native with reordered args, iOS never calls native at all) |
| `contract.test.tsx` | Asserts `__fixtures__/contract/envelope_shape.json`'s key set matches the verbatim envelope documented on this repo's Atlas page — doc/fixture drift guard only, see `__fixtures__/contract/README.md` |

Extend the matching existing file before creating a new one, unless you're covering a genuinely
new method (create `<methodName>.test.tsx` or add a `describe` block to `index.test.tsx`).

## 2. The `NativeModules` mock recipe (the only pattern this repo uses)

Every test that touches `OtplessHeadlessModule` mocks the whole `react-native` module at the top
of the file, before importing anything else:

```ts
jest.mock('react-native', () => ({
  NativeModules: {
    OtplessHeadlessRN: {
      initialize: jest.fn(),
      start: jest.fn(),
      commitResponse: jest.fn(),
      cleanup: jest.fn(),
      isSdkReady: jest.fn(),
      setDevLogging: jest.fn(),
      isWhatsappInstalled: jest.fn(),
      initTrueCaller: jest.fn(),
      decimateAll: jest.fn(),
      userAuthEvent: jest.fn(),
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
  Platform: {
    OS: 'android',
    select: jest.fn((spec: any) => spec.android ?? spec.default),
  },
}));

import { NativeModules, Platform } from 'react-native';
import { OtplessHeadlessModule } from '../index';

const mockNativeModule = NativeModules.OtplessHeadlessRN as any;
```

To add a case for a **new** bridge method:

1. Add the method's stub to the `OtplessHeadlessRN` mock object above (every method the module
   calls must exist on the mock, even if the new test doesn't touch it — other tests in the same
   file share this mock).
2. `beforeEach(() => { jest.clearAllMocks(); module = new OtplessHeadlessModule(); })` — a fresh
   instance and cleared mock call history per test.
3. To test a platform branch, set `Platform.OS = 'ios'` (or `'android'`) inside the test, and
   restore it in `afterEach` (`Platform.OS = 'android'`) — `Platform.OS` is a plain mutable
   property on the mock object, not a real RN platform switch.
4. Assert on `mockNativeModule.<method>` — `toHaveBeenCalledTimes`, `toHaveBeenCalledWith`, or
   `not.toHaveBeenCalled()` for the "shouldn't reach native on this platform" cases (several
   methods, like `userAuthEvent`, are Android-only or iOS-only by design — test both branches).

This mock only proves the **JS wrapper** calls (or doesn't call) the right native method with the
right (possibly reordered/coerced) arguments — it says nothing about what the native side does
with them.

## 3. Contract fixtures are GOLDEN

`src/__tests__/__fixtures__/contract/*.json` mirror the response envelope contract (see
`README.md` in that directory for the full honest-scope statement).

- **Changing the envelope shape (new/removed/renamed key) is a breaking contract change.** Update
  the fixture + `contract.test.tsx` in the same PR, and follow CLAUDE.md constitution article 1:
  `**BREAKING:**` changelog entry, an update to the marshalling section of this repo's Atlas page,
  and a `react-native-headless-lite` parity check.
  Never edit the fixture just to make a test pass.
- A `.claude/settings.json` hook blocks hand-edits to this directory in favor of updating both the
  fixture and its test deliberately together — the warning is the point, not an obstacle.

## 4. Style

- Prefer an exhaustive small decision table over one happy-path test when a method branches on
  `Platform.OS` or has multiple optional parameters with defaults — see
  `index.test.tsx`'s five `it()` blocks for `userAuthEvent` (all-args, default fallback, default
  providerInfo, non-string providerInfo passthrough, iOS no-op) as the reference shape.
- Coverage ratchet: `package.json`'s `jest.coverageThreshold.global` is pinned at the measured
  baseline (statements 24%, branches 33.33%, functions 14.28%, lines 24%, `src/index.tsx` only —
  `src/models.tsx` is pure type declarations, 0% there is not a real gap). Any PR that adds
  reachable logic to `src/index.tsx` without a test that exercises it will fail this ratchet —
  that's the intended enforcement, not a false positive to raise the threshold around.

## 5. Run

```bash
make test        # yarn jest --coverage
# or the full gate:
make gate
```
