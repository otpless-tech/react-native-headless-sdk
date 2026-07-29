---
name: bump-native-sdk
description: Review and land a native SDK pin bump — the Android "full" SDK pin in android/build.gradle, or the iOS OtplessBM pin in otpless-headless-rn.podspec. Use before approving or merging any PR that changes either pin.
disable-model-invocation: true
---

# Native SDK pin bump protocol

A native SDK bump is a code change for this bridge even though it touches zero JS/Kotlin/Swift
logic here: it changes what `OtplessSDK`/`Otpless.shared` methods exist and how they behave
underneath every bridge method. A green `make gate` does NOT cover this — `make gate` never
compiles `android/` or `ios/` (guide §10 quirk #10), so it can't even confirm the pin still
resolves against the bridge's Kotlin/Swift call sites. Never rubber-stamp a pin bump on gate-green
alone.

## A. Android (`android/build.gradle:77`, `io.github.otpless-tech:otpless-headless-sdk`)

The upstream repo (`otpless-headless-android-sdk`) commits mechanical API goldens per its own
agentic-readiness setup — use them to enumerate the surface delta instead of guessing:

- `LongClaw/api/LongClaw.api`
- `LongClaw/api/shipped-surface.txt`
- `longclaw-truecaller/api/longclaw-truecaller.api`
- `longclaw-truecaller-impl/api/longclaw-truecaller-impl.api`

Process:

1. Identify the old and new version tags/commits in `otpless-headless-android-sdk`.
2. Diff each golden file between the two versions:
   ```bash
   git -C <path-to-otpless-headless-android-sdk-checkout> diff <old-ref> <new-ref> -- \
     LongClaw/api/LongClaw.api LongClaw/api/shipped-surface.txt \
     longclaw-truecaller/api/longclaw-truecaller.api \
     longclaw-truecaller-impl/api/longclaw-truecaller-impl.api
   ```
   (If you don't have that repo checked out locally, `git show <ref>:<path>` twice and diff the
   two outputs, or read them via the repo's remote if the environment allows.)
3. For every symbol removed/changed in the diff, grep this bridge's Kotlin for a call site:
   ```bash
   grep -rn "OtplessSDK\.\|com\.otpless\.v2\.android\.sdk\.\|com\.otpless\.longclaw\.tc\." \
     android/src/main/java/com/otplessheadlessrn/
   ```
   The Android bridge method table on this repo's Atlas page is the authoritative list of exactly
   which native calls this bridge makes — cross-check every row against the diff.
4. For every symbol **added**, check whether it's a new capability worth exposing at the JS layer
   (see the channel-coverage gap table on the Atlas page). Adding JS reachability for a previously
   unreached capability is a separate, deliberate decision (new bridge method + TS export), not an
   automatic side effect of the pin bump — don't bundle the two unless the PR says so explicitly.
5. Update `android/build.gradle:77`'s version string.
6. Run `make gate` (proves the TS side didn't regress; proves nothing about the native side).
7. **Hand-verify or state you couldn't:** if an Android toolchain is available, build/run the
   example app against the new pin; if not, say so plainly in the PR rather than implying it was
   checked.
8. Update this repo's Atlas page: the native-pin table, plus the Android bridge method table and
   channel-coverage table if the surface changed them (a PR to `otpless-tech/atlas`, unless the page
   is generated — see **docs-sync**).

## B. iOS (`otpless-headless-rn.podspec:20`, `OtplessBM/Core`)

**No committed API golden exists upstream today** for `OtplessBM` (its own agentic-readiness work
is in progress separately) — do not invent a diffing mechanism that doesn't exist. The honest
current process:

1. Read `OtplessBM`'s release notes/CHANGELOG (its CocoaPods trunk page or GitHub repo, whichever
   is available) between the old and new version.
2. Manually re-check every `.m`-declared / `.swift`-implemented selector this bridge calls (guide
   §6's table: `initialise(withAppId:vc:)`, `start(withRequest:)`, `commitOtplessResponse(_:)`,
   `cleanup()`, `clearAll()`, `setLoggerDelegate(_:)`, `isSdkReady()`,
   `authorizeViaPasskey(withRequest:windowScene:)`, `setResponseDelegate(_:)`) against the new
   pod version's public headers/Swift interface — by hand, since there's no mechanical diff.
3. Update `otpless-headless-rn.podspec:20`'s version string.
4. Run `make gate` (again: proves nothing about the native side).
5. **Hand-verify or state you couldn't:** if a macOS/Xcode toolchain is available, `pod install` +
   build the example app against the new pin; if not, say so plainly.
6. Update this repo's Atlas page: the native-pin table, plus the iOS bridge method table and
   channel-coverage table if the surface changed them (a PR to `otpless-tech/atlas`, unless the page
   is generated — see **docs-sync**).

## C. Symbol-level risk enumeration (both platforms)

Every bridge method in guide §5 (Android) / §6 (iOS) is a point of symbol-level risk on any native
bump — a rename, removed method, or changed parameter list on the native side breaks that bridge
method silently (no compile-time signal reaches JS; `make gate` cannot see it because it doesn't
compile Kotlin/Swift). List, in the PR, which of these rows you positively re-verified against the
new pin vs. which you're relying on release-notes-says-nothing-changed:

- Android: `initialize`, `start`, `commitResponse`, `isWhatsappInstalled`, `cleanup`,
  `setDevLogging`, `isSdkReady`, `initTrueCaller`, `userAuthEvent`, `onActivityResult`,
  `onNewIntent`.
- iOS: `initialize`, `start`, `commitResponse`, `cleanup`, `decimateAll`, `setDevLogging`,
  `isSdkReady`, `authorizeViaPasskey` (unreached from JS today, but still a live selector — a
  break here is silent until someone wires it up), plus the two already-undead selectors
  (`setOneTapDataCallback`, `performOneTap` — a known quirk on the Atlas page) which cannot regress further
  since nothing implements them today, but confirm the new pod version doesn't add a real
  implementation expectation that changes that story.

## D. Merge rules

- Merge only when: `make gate` green + size-review skill's native-pin note (§4 there) + the
  hand-verification step done or explicitly flagged as not-possible-in-this-environment + docs
  updated in the same PR.
- Never merge a native SDK bump on green `make gate` alone — it proves the TS surface compiles,
  nothing about the native call sites underneath it.
