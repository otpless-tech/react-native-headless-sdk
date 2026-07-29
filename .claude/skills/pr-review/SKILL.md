---
name: pr-review
description: Review any PR or diff that touches src/, android/, or ios/ against the wrapper development constitution in CLAUDE.md. Use when asked to review a pull request, review a diff, or check a change against the constitution before merge.
---

# Constitution-based PR review

This bridge runs inside enterprise merchants' React Native apps — the constitution in `CLAUDE.md`
exists because their crash rate, app size, and security audit all include us. Review every diff
against the six articles below, in order. Skip an article only if the diff genuinely has nothing
relevant to it (say so, don't stay silent).

## Article 1 — Public API is a contract

- Any exported symbol change in `src/index.tsx`/`src/models.tsx`: was `api/index.d.ts` /
  `api/models.d.ts` refreshed via `bash scripts/check-ts-surface.sh --update` and reviewed in this
  PR? A drifted golden with no refresh is a blocking finding (CI's `ts-surface` gate step would
  fail anyway — check whether the PR ran it).
- Any change to the response envelope (Android `sendHeadlessEventCallback`/`commitResponse`, iOS
  `onOtplessResponse`/`commitResponse`) — new/removed/renamed key in `{responseType, response,
  statusCode}` is breaking. Confirm the contract fixture + test were updated in the same PR.
- Any renamed/reordered method parameter, or a method moved between platforms (e.g. something
  Android-only becoming cross-platform) — check it against the parity rule (below) and the
  changelog for a `**BREAKING:**` flag if applicable.
- Is `"OTPlessEventResult"` or the registered module name (`OtplessHeadlessRN` — Android
  companion `NAME`, iOS `@objc(OtplessHeadlessRN)`, JS `NativeModules.OtplessHeadlessRN`) touched?
  All three must move together or not at all.
- A drive-by tightening of a loose `any`/`String` type (constitution article 1's "not a bug to fix
  as a drive-by" rule) outside the PR's stated purpose is a flag — ask whether it was deliberate
  and changelog-worthy.
- A removed public export must not be deleted cold — check it went through a `@deprecated` TSDoc
  first (docs-sync skill's "mark, never delete" rule), or flag it as a violation.

## Article 2 — Never harm the host app

- Every new/changed `@ReactMethod` (Android) or `RCT_EXTERN_METHOD`+`@objc` pair (iOS) that takes
  a `Promise`: does every code path either `resolve` or `reject` it? An early `return` that leaves
  the promise unsettled is a blocking finding — it's the exact shape of the existing
  `initTrueCaller` known bug (guide §10 quirk #5); don't let a new method repeat it.
- Any enum/string parsed from a JS argument or from the native SDK's own response, on either
  platform: is it defensively parsed (`runCatching`/`try?` + a logged fallback), or does it use a
  direct `valueOf`/force-unwrap that can throw across the bridge boundary? The latter is the exact
  shape of the existing `commitResponse` known bug (guide §10 quirk #4) — a blocking finding in
  new code.
- Any new process-global registration (activity/event listener, tracked `Job`/`Task`) — confirm
  `cleanup()` (or the platform equivalent) tears it down on every exit path and is idempotent.
- `AndroidManifest.xml`/iOS capability diff: any new permission, `<queries>` entry, or component
  is a blocking finding unless the PR states product sign-off.
- Is a native SDK call still off the JS/native-main thread (`Dispatchers.IO`/`lifecycleScope` on
  Android, `Task` on iOS)? A newly-added synchronous call on the UI thread is a blocking finding.

## Article 3 — Privacy & auditability

- Does the diff add ANY logging, network call, or field collection at the **bridge layer itself**
  (not just forwarding a merchant-supplied field into the native SDK's own request object)? If so:
  is it documented in `CLAUDE.md` article 3 and on this repo's Atlas page in this same PR? No doc update
  = blocking finding, not a nit — this repo's constitution currently states the bridge collects
  nothing of its own, and that claim must stay true or be corrected loudly.
- Any new/changed log statement (`debugLog`, the iOS `OtplessLoggerDelegate` print, or a raw
  `Log.*`/`print`): gated behind dev-logging, and does it avoid phone numbers/OTPs/tokens even
  when dev logging is on?

## Article 4 — Naming conventions

- No OTPLESS-internal codenames leaking into `src/` — public API stays merchant-legible.
- New TS types/members: `PascalCase`/`camelCase`, using an existing prefix (`Otpless*`, `OT*`) —
  flag a new ad-hoc prefix.
- New JSON payload keys: `lowerCamelCase` matching the native SDK's field name exactly — flag a
  key that's a synonym for an existing concept (e.g. a second name for `deliveryChannel`).

## Article 5 — Dependencies & size

- Any new `dependencies`/`devDependencies` entry: challenged in the PR description? This is a
  thin bridge — every dependency ships in every merchant's bundle.
- Any native SDK pin bump (`android/build.gradle`, `otpless-headless-rn.podspec`): did it go
  through the **bump-native-sdk** skill, not just a version-string edit?
- If a `npm pack --dry-run` size measurement is present in the PR (size-check CI, once added),
  confirm growth is justified against the size-review skill's baseline (20.1 kB packed / 74.6 kB
  unpacked at time of writing).

## Article 6 — Verification before merge

- Was `make gate` run? Ask for actual output, not "should pass."
- Does the diff touch `android/**` or `ios/**`? If so, does the PR state plainly that `make gate`
  does NOT compile or test native code, and either state a hand-verification against the example
  app or explicitly flag that none was possible in this environment? Silence here (implying CI
  proved a native change) is a blocking finding.
- Was the Jest coverage ratchet respected (no unexplained lowering of
  `jest.coverageThreshold.global` to make a gate pass)?
- If the response envelope or public TS surface moved: does the PR note a `react-native-headless-lite`
  parity check (`Parity: ported in <repo>#NN` / `Parity: N/A — <reason>` / `Parity: port ticket
  <link>`)? Absence is a blocking finding for any breaking change.

## Also check: does this PR silently reintroduce a known quirk?

Cross-check the diff against the Known Quirks section of this repo's Atlas page before approving — e.g. a new
`ResponseTypes.valueOf(...)`-style direct parse (quirk #4's pattern), a new promise with an
early-return-without-settling path (quirk #5's pattern), a new `.m` selector declaration with no
corresponding `.swift` implementation (quirk #2's pattern), or a re-widened `packageManager`
range (the toolchain fix this repo's scaffolding PR landed). Fixing a listed quirk is good and
should be called out and removed from the Atlas page's quirks list in the same PR (docs-sync skill); *reintroducing* one is
a blocking finding.

## Report format

```
### Blocking
- android/src/main/java/com/otplessheadlessrn/OtplessReactNativeModule.kt:142 — new promise-based
  method has an early return that never resolves/rejects; repeats the initTrueCaller known bug.

### Should-fix
- src/index.tsx:60 — new method not yet on the Atlas page's public-API table.

### Nit
- CHANGELOG.md — Unreleased entry missing for this PR.
```

If an article has no relevant diff content, state "Article N — not applicable (no matching
changes)" rather than omitting it silently.
