# Response contract fixture — scope honestly

`envelope_shape.json` mirrors the three-key response envelope (`responseType`, `response`,
`statusCode`) that this bridge is supposed to pass through **verbatim** in both directions, on
both platforms (documented on this repo's page in `otpless-tech/atlas`). It is adapted from
`otpless-headless-android-lite/LongClaw/src/test/resources/contract/envelope_shape.json` — same
three keys, because the backend-driven envelope is the shared spine across every OTPLESS SDK and
wrapper (native-sdks hub `CLAUDE.md` rule 4).

**What this fixture does NOT do:** 100% of this bridge's actual marshalling logic lives in Kotlin
(`android/src/main/java/com/otplessheadlessrn/`) and Swift
(`ios/OtplessHeadlessRN.swift`) — Jest cannot execute either, so no test in this repository can
exercise the real marshalling boundary the way `LongClaw`'s JVM tests exercise its use-cases. The
corresponding test (`src/__tests__/contract.test.tsx`) only asserts that this fixture's key set
matches what the Atlas page documents as the verbatim envelope — it guards against the
**doc and the fixture drifting apart**, not against a native marshalling regression. Treat any
green run of that test as exactly that: a documentation/fixture consistency check, not proof the
Android or iOS bridge still marshals correctly.

If you intentionally change the envelope shape (new key, removed key, renamed key on either
platform), update this fixture and `src/__tests__/contract.test.tsx` in the same PR, and follow
the constitution in the root `CLAUDE.md`: this is a response-contract change — document it in
the marshalling section of this repo's Atlas page, flag `**BREAKING:**` in `CHANGELOG.md` if
applicable, and check `react-native-headless-lite` (and the native Android/iOS SDKs feeding this
bridge) for the same shape. Do
not edit this fixture just to make a test pass.
