# OTPLESS React Native Headless SDK ("full") — Code Guide

> **Audience:** Any developer (human or AI) who needs to learn, navigate, modify, or extend this wrapper.
> **Scope:** The whole repository — this is a thin bridge, not a native SDK. `example/` is a demo app; it's covered only in §9 as a usage reference, never as "SDK code".
> **Source of truth:** Describes the code at commit `a77ac7e` (package version **2.2.0**, `package.json`). When code and doc disagree, the code wins — fix this doc.
> **Relationship to the native SDKs:** This package (npm `otpless-headless-rn`) is a **marshalling layer** over two independently-versioned native SDKs — `io.github.otpless-tech:otpless-headless-sdk` (Android "full") and `OtplessBM` (iOS, via CocoaPods) — pinned in `android/build.gradle` and `otpless-headless-rn.podspec` respectively (exact lines in §3). It is supposed to pass the response contract (`responseType`/`response`/`statusCode`) through **verbatim**; every place it does *not* do that for request/config payloads is called out explicitly in §7.

---

## Table of Contents

1. [What This Wrapper Is](#1-what-this-wrapper-is)
2. [Repository Layout & Source-File → Section Map](#2-repository-layout--source-file--section-map)
3. [Build, Toolchain & Release Mechanics](#3-build-toolchain--release-mechanics)
4. [Public TypeScript API Surface](#4-public-typescript-api-surface)
5. [Bridge Architecture — Android](#5-bridge-architecture--android)
6. [Bridge Architecture — iOS](#6-bridge-architecture--ios)
7. [Marshalling Contract: Verbatim vs. Transformed](#7-marshalling-contract-verbatim-vs-transformed)
8. [Channel Surfacing: Bridge vs. Native Full SDK](#8-channel-surfacing-bridge-vs-native-full-sdk)
9. [The Example App](#9-the-example-app)
10. [Known Quirks & Gotchas](#10-known-quirks--gotchas)

---

## 1. What This Wrapper Is

`otpless-headless-rn` is a **React Native bridge**, not an SDK implementation. It has no auth logic of its own: a TypeScript facade (`src/`) forwards calls into a Kotlin native module on Android and an Obj-C/Swift native module on iOS, each of which is a thin adapter over the real headless SDK for that platform (`OtplessSDK` on Android, `Otpless.shared` on iOS). "Headless" here means no OTPLESS-branded login UI — the merchant app builds its own screens and drives the flow through `start()`/`commitResponse()`, receiving results through a single event stream. The wrapper's entire job is: accept a loosely-typed JS request object, translate it into the native SDK's typed request object, and relay the native SDK's response back to JS — and, per the workspace's shared-spine rule, the response payload is supposed to survive that round trip unchanged.

## 2. Repository Layout & Source-File → Section Map

```
otpless-headless-rn/
├── package.json                    # npm metadata, scripts, bob/jest/release-it config — §3
├── otpless-headless-rn.podspec     # CocoaPods spec, iOS native SDK pin — §3
├── tsconfig.json / tsconfig.build.json  # TS compiler config (build config excludes example/)
├── .nvmrc, lefthook.yml            # toolchain/git-hook mechanics — §3
├── .github/
│   ├── workflows/ci.yml            # lint/typecheck, unit test, build jobs — §3
│   └── actions/setup/action.yml    # shared Node+yarn setup step — §3
├── src/                             # ★ THE ENTIRE PUBLIC TS SURFACE ★
│   ├── index.tsx                   # OtplessHeadlessModule class — §4
│   ├── models.tsx                  # TrueCaller request types + auth-event string unions — §4
│   └── __tests__/index.test.tsx    # one test file, covers userAuthEvent only — §4, §10
├── android/src/main/
│   ├── AndroidManifest.xml         # empty <manifest/> — contributes nothing to manifest merge
│   └── java/com/otplessheadlessrn/
│       ├── OtplessReactNativeModule.kt  # class OtplessHeadlessRNModule — §5
│       ├── OtplessReactNativePackage.kt # class OtplessHeadlessRNPackage (ReactPackage) — §5
│       └── utils.kt                     # JSON⇄RN map/array converters, TrueCaller parsing — §5, §7
├── ios/
│   ├── OtplessHeadlessRN.h         # bare RN framework imports, no declarations
│   ├── OtplessHeadlessRN.m         # RCT_EXTERN_METHOD selector declarations — §6
│   └── OtplessHeadlessRN.swift     # class OtplessHeadlessRN: RCTEventEmitter — §6
└── example/                         # demo app — §9 only, never "SDK code"
    └── src/{App.tsx, HeadlessScreen.tsx, components/Header.tsx}
```

**Naming note:** the Kotlin file is `OtplessReactNativeModule.kt` but the class inside is `OtplessHeadlessRNModule` (registered name `"OtplessHeadlessRN"`, `companion object NAME`). The equivalent iOS class is `OtplessHeadlessRN` (`@objc(OtplessHeadlessRN)`). Both are looked up by JS via `NativeModules.OtplessHeadlessRN`.

---

## 3. Build, Toolchain & Release Mechanics

| Item | Value | Source |
|---|---|---|
| Package version | `2.2.0` | `package.json:3` |
| Android native pin | `io.github.otpless-tech:otpless-headless-sdk:0.8.1` | `android/build.gradle:77` |
| iOS native pin | `s.dependency 'OtplessBM/Core', '2.0.9'` | `otpless-headless-rn.podspec:20` |
| Android compileSdk / minSdk / targetSdk | 35 / 21 / 35 | `android/build.gradle:40,43,44` |
| Android Gradle Plugin | 8.3.0 | `android/build.gradle:11` |
| Android release build | `minifyEnabled false` — bridge module is **not** shrunk | `android/build.gradle:49` |
| iOS deployment target | 13.0 | `otpless-headless-rn.podspec:14` |
| Node toolchain (CI) | `.nvmrc` → `16.18.1` | `.nvmrc:1` |
| Node toolchain (declared) | `package.json` `engines.node` → `>= 18.0.0` | `package.json:85-87` — **mismatch**, see §10 |

**Scripts** (`package.json` → `scripts`): `test` (jest), `typecheck` (`tsc --noEmit`), `lint` (eslint), `prepack` (`bob build` — react-native-builder-bob emits `lib/commonjs`, `lib/module`, `lib/typescript` from `src/`, configured under the `react-native-builder-bob` key), `release` (`release-it`, configured for conventional-changelog + npm publish + GitHub release), `bootstrap` (installs example deps + pods), `clean`.

**CI** (`.github/workflows/ci.yml`, triggered on push/PR to `main`): three independent jobs, all using the shared `.github/actions/setup` composite action (Node via `.nvmrc`, yarn install with cache keyed on `yarn.lock` hash, root + `example/`) — `lint` (`yarn lint` + `yarn typecheck`), `test` (`yarn test --maxWorkers=2 --coverage`), `build` (`yarn prepack`). No native (Android/iOS) build or bridge-contract test runs in CI today — nothing compiles the Kotlin or Swift/Obj-C sources or exercises the example app.

**Git hooks** (`lefthook.yml`): pre-commit runs `eslint` and `tsc --noEmit` on changed `*.{js,ts,jsx,tsx}` files (in parallel); commit-msg runs `commitlint` against `@commitlint/config-conventional`.

**Release**: `release-it` (config in `package.json`) bumps version, tags `v${version}`, publishes to npm, and creates a GitHub release from Angular-preset conventional-changelog commits — no separate CHANGELOG.md is maintained by hand.

---

## 4. Public TypeScript API Surface

Everything a consuming app can call is on one exported class, `OtplessHeadlessModule` (`src/index.tsx`), instantiated by the app (`new OtplessHeadlessModule()` — not a singleton). `src/index.tsx` also does `export * from './models'` (the TrueCaller request types and the `OtplessAuthEvent`/`OtplessProviderType` string unions, `src/models.tsx`).

| Method | Params | Returns | Platform(s) wired |
|---|---|---|---|
| `initialize` | `appId: String, loginUri: string \| null = null` | `void` | Both |
| `setResponseCallback` | `callback: OtplessResultCallback` (`(result: any) => void`) | `void` | Both — **JS-only**, no native call (§5/§6) |
| `clearListener` | — | `void` | Both — **JS-only**, no native call |
| `start` | `input: any` | `void` | Both |
| `commitResponse` | `response: any` | `void` | Both |
| `isWhatsappInstalledForAndroid` | — | `Promise<boolean>` | Android calls native; iOS resolves `false` without a native call |
| `cleanup` | — | `void` | Both |
| `decimateAll` | — | `void` | iOS only — guarded by `Platform.OS.toLowerCase() === 'ios'` inside the method; no-op (not called) on Android |
| `setDevLogging` | `enable: boolean` | `void` | Both |
| `isSdkReady` | — | `Promise<boolean>` | Both |
| `initTrueCaller` | `requestMap: OtplessTruecallerRequest` | `Promise<boolean>` | Android calls native; iOS resolves `false` without a native call (no iOS TrueCaller bridge exists at all) |
| `userAuthEvent` | `event: OtplessAuthEvent, providerType: OtplessProviderType, fallback: boolean = false, providerInfo: any = {}` | `void` | Android only — guarded by `Platform.OS === 'android'`; comment at `index.tsx:95` states "OtplessBM (iOS) has no equivalent" |

All method bodies are in `src/index.tsx:29-114`. Note `appId` is typed as the boxed `String` (not primitive `string`) — see §10.

---

## 5. Bridge Architecture — Android

`OtplessHeadlessRNModule` (`android/src/main/java/com/otplessheadlessrn/OtplessReactNativeModule.kt`) extends `ReactContextBaseJavaModule` and implements `ActivityEventListener`. `OtplessReactNativePackage.kt`'s `OtplessHeadlessRNPackage` registers it as the sole `NativeModule` (no view managers).

| JS call | Kotlin `@ReactMethod` | Native SDK call reached |
|---|---|---|
| `initialize` | `initialize(appId, loginUri)` | `OtplessSDK.initialize(appId, activity = currentActivity!!, loginUri, callback = ::sendHeadlessEventCallback)`, launched on `lifecycleScope`/`Dispatchers.IO` |
| `start` | `start(data: ReadableMap)` | Builds an `OtplessRequest` (phone/email/channelType branch) then `OtplessSDK.start(request, ::sendHeadlessEventCallback)` |
| `commitResponse` | `commitResponse(data: ReadableMap?)` | `OtplessSDK.commit(otplessResponse)` |
| `isWhatsappInstalledForAndroid` | `isWhatsappInstalled(promise)` | `OtplessUtils.isWhatsAppInstalled(reactContext)` |
| `cleanup` | `cleanup()` | cancels the tracked `otplessJob`, then `OtplessSDK.cleanup()` |
| `setDevLogging` | `setDevLogging(devLogging: Boolean)` | sets `OtplessSDK.devLogging` var |
| `isSdkReady` | `isSdkReady(promise)` | reads `OtplessSDK.isSdkReady` |
| `initTrueCaller` | `initTrueCaller(requestMap, promise)` | `OtplessSDK.initTrueCaller(currentActivity!!, request) { OTScopeRequest.ActivityRequest(currentActivity as FragmentActivity, scopes) }` |
| `userAuthEvent` | `userAuthEvent(event, fallback, providerType, providerInfo)` | `OtplessSDK.userAuthEvent(authEvent, fallback, provider, infoMap)` |
| — (not JS-callable; RN plumbing) | `onActivityResult` / `onNewIntent` overrides (`ActivityEventListener`) | `OtplessSDK.onActivityResult(...)` / `OtplessSDK.onNewIntent(...)` — forwarded automatically by RN whenever the host `Activity` receives them (needed for OAuth/magic-link/TrueCaller redirect resumption); never invoked directly from JS |

**Event relay:** the native SDK's callback is always `sendHeadlessEventCallback` (`OtplessReactNativeModule.kt:45-65`) — wired once at `initialize()` and re-passed on every `start()` call. It builds `{responseType, response, statusCode}` and emits it as the RN device event `"OTPlessEventResult"` via `RCTDeviceEventEmitter`. JS's `setResponseCallback`/`clearListener` never talk to the native module at all — they only add/remove a `NativeEventEmitter` listener for that event name on the JS side.

`utils.kt` holds the pure-JSON helper functions used by the module: `convertMapToJson`/`convertArrayToJson` (RN `ReadableMap`/`ReadableArray` → `org.json`), `convertJsonToMap`/`convertJsonToArray` (the reverse, used to build the emitted event), and the TrueCaller-specific parsers (`parseTrueCallerRequest`, `parseTrueCallerScope`, `fromHexStringToInt`, `parseLocale`) — see §7 for exactly what they transform.

## 6. Bridge Architecture — iOS

`ios/OtplessHeadlessRN.m` declares the RN-visible selectors via `RCT_EXTERN_MODULE`/`RCT_EXTERN_METHOD`; `ios/OtplessHeadlessRN.swift` implements `class OtplessHeadlessRN: RCTEventEmitter, OtplessResponseDelegate`. Cross-checking every `.m` declaration against a matching `@objc` implementation in `.swift`:

| Declared in `.m` | Implemented in `.swift`? | Native SDK call reached |
|---|---|---|
| `initialize(appId:loginUri:)` | Yes | `Otpless.shared.setResponseDelegate(self)` + `Otpless.shared.initialise(withAppId:vc:)` |
| `start(request:)` | Yes | builds an `OtplessRequest`, then `Otpless.shared.start(withRequest:)` inside a cancellable `Task` |
| `commitResponse(response:)` | Yes | `Otpless.shared.commitOtplessResponse(_:)` |
| `cleanup()` | Yes | `Otpless.shared.cleanup()` + cancels the tracked `Task` |
| `decimateAll()` | Yes | `Otpless.shared.clearAll()` |
| `setDevLogging(enable:)` | Yes | `Otpless.shared.setLoggerDelegate(self)` (only when `enable == true`) |
| `isSdkReady(resolve:reject:)` | Yes | `Otpless.shared.isSdkReady()` |
| `authorizeViaPasskey(request:)` | Yes | `Otpless.shared.authorizeViaPasskey(withRequest:windowScene:)` — **implemented but never called from `src/index.tsx`** (§8, §10) |
| `setOneTapDataCallback()` | **No** — no `@objc` implementation found anywhere in `OtplessHeadlessRN.swift` | — (see §10, real crash landmine) |
| `performOneTap(request:)` | **No** — same as above | — (see §10) |

Event relay mirrors Android: `onOtplessResponse(response:)` (the `OtplessResponseDelegate` callback, wired via `Otpless.shared.setResponseDelegate(self)` in `initialize`) packages `{response, statusCode, responseType.rawValue}` and calls `sendEvent(withName: "OTPlessEventResult", body: params)` (`RCTEventEmitter`'s emit). `supportedEvents()` declares only that one event name.

---

## 7. Marshalling Contract: Verbatim vs. Transformed

The response envelope's three keys — `responseType`, `response`, `statusCode` — pass through **unchanged**, same shape, in both directions, on both platforms:

- Android native→JS: `sendHeadlessEventCallback` (`OtplessReactNativeModule.kt:56-64`).
- Android JS→native: `commitResponse`/`getResponseType` (`OtplessReactNativeModule.kt:250-268`) — but with **no defensive validation** (§10).
- iOS native→JS: `onOtplessResponse` (`OtplessHeadlessRN.swift:24-33`).
- iOS JS→native: `commitResponse` (`OtplessHeadlessRN.swift:12-22`) — defends with defaults (`"FAILED"`, `-25000`) unlike Android.

The `start()` request body forwards `phone`/`countryCode`/`otp`/`email`/`channelType`/`expiry`/`otpLength`/`tid` essentially verbatim on both platforms — `channelType` is handed to `OtplessChannelType.fromString(...)` unchanged, as an opaque string. Everything else that touches request/config payloads performs a real transformation — every one found:

1. **`deliveryChannel` casing is platform-inconsistent.** Android uppercases it before forwarding (`otplessRequest.setDeliveryChannel(deliveryChannel.uppercase())`, `OtplessReactNativeModule.kt:187`); iOS forwards the raw string as-is (`otplessRequest.set(deliveryChannelForTransaction: deliveryChannel)`, `OtplessHeadlessRN.swift:48-51`). The same JS field is treated differently per platform.
2. **`userAuthEvent`'s `providerInfo` map (Android only)** — every value is coerced to `String`: strings pass through, numbers become `getDouble().toString()`, booleans become `getBoolean().toString()`, nested maps are JSON-stringified via `convertMapToJson(...).toString()`, arrays via `convertArrayToJson(...).toString()`, and `null` values are dropped entirely (`OtplessReactNativeModule.kt:120-141`).
3. **`userAuthEvent`'s argument order is reordered.** TS signature is `(event, providerType, fallback, providerInfo)`; the JS call reorders to `(event, fallback, providerType, providerInfo)` to match the Kotlin method's parameter order (`index.tsx:96-111`, explicit comment at line 103).
4. **TrueCaller request parsing (Android only, `utils.kt`)**:
   - `buttonColor`/`buttonTextColor` hex strings → `Int?` via `Color.parseColor`, silently `null` on a parse failure (`fromHexStringToInt`, `utils.kt:178-182`).
   - `locale` strings like `"en-US"` are parsed by a hand-rolled `parseLocale` that splits on `-`/`_` into exactly two parts and builds `Locale(lang, country)` — **not** `Locale.forLanguageTag`; anything that doesn't split into exactly two parts yields `null` (`utils.kt:161-167, 209-216`).
   - `footerType`, `shape`, `verifyOption`, `heading`, `loginPrefixText`, `ctaText`, and every `scope` array entry are matched **case-insensitively** against the native enum's `.name` (`.equals(str, ignoreCase = true)`), defaulting to `null` on no match — except `scope`, which defaults to the hardcoded list `[OPEN_ID, PHONE, PROFILE]` if the array is missing or empty (`utils.kt:134-197`).

---

## 8. Channel Surfacing: Bridge vs. Native Full SDK

The native Android "full" SDK exposes a materially larger channel surface than either mobile bridge reaches (cross-checked against `otpless-headless-android-sdk`'s own guide, §1, on its `feat/sdk-guide` branch):

| Native full-SDK capability | Reached from this bridge? | Evidence |
|---|---|---|
| OTP (SMS/WhatsApp/email/etc.) + magic links | **Yes, both platforms** | generic `start()` passthrough (`phone`/`email` + `otp`/`deliveryChannel`/`otpLength`/`expiry`/`tid`) |
| Silent Network Authentication (SNA) | **Yes, both platforms** (implicitly) | backend-driven — same `start()` call; the native SDK negotiates the `SILENT_AUTH` channel internally, no dedicated bridge method needed |
| Native Google / Facebook SSO | **Yes, both platforms** | `start()`'s `channelType` field forwarded verbatim to `OtplessChannelType.fromString(...)` on both sides |
| TrueCaller | **Android only** | dedicated `initTrueCaller()`; no declaration exists anywhere in `ios/OtplessHeadlessRN.m` or `.swift` |
| WebAuthn / passkeys | **No JS exposure on either platform.** iOS native bridge *implements* `authorizeViaPasskey` but `src/index.tsx` never calls it; the Android bridge has no passkey/Credential-Manager code at all | `ios/OtplessHeadlessRN.swift:69-79` implements it; `grep` of `src/` finds zero references to "passkey" |
| Standalone session-management feature | **No — unreached on both platforms** | no bridge code (Kotlin or Swift) references it |
| In-SDK OneTap verified-contact-picker UI | **No — unreached on both platforms**, and iOS declares but never implements its two selectors for it | `setOneTapDataCallback`/`performOneTap` declared in `.m`, absent from `.swift` (§6, §10) |
| Google Phone-Number-Hint wrapper (`OtplessPhoneHint`) | **No — unreached on both platforms** | no bridge code references it |

---

## 9. The Example App

`example/src/App.tsx` renders `HeadlessScreen` inside a platform-conditional `SafeAreaView`/`View` shell. `HeadlessScreen.tsx` is the real usage reference: it instantiates `new OtplessHeadlessModule()` once at module scope, calls `initialize(APP_ID)` + `setDevLogging(true)` + `setResponseCallback(onHeadlessResult)` in a `useEffect`, and builds a `headlessRequest` object from form fields (`phoneNumber`/`countryCode`/`otp`/`email`/`channelType`/`expiry`/`otpLength`/`deliveryChannel`/`tid`) before calling `start()`. It demonstrates: checking `isSdkReady()` before starting; calling `initTrueCaller()` once `SDK_READY` arrives; always calling `commitResponse(data)` inside the response handler; re-populating the OTP field from `OTP_AUTO_READ` responses; and firing `userAuthEvent('AUTH_INITIATED'/'AUTH_SUCCESS', 'OTPLESS', false, null)` around the flow. `components/Header.tsx` is a cosmetic title bar with no bridge relevance.

---

## 10. Known Quirks & Gotchas

1. **Passkey/WebAuthn gap.** `authorizeViaPasskey` is fully implemented in the iOS native bridge (`OtplessHeadlessRN.swift:69-79`, reaching `Otpless.shared.authorizeViaPasskey(withRequest:windowScene:)`) and declared in `.m`, but `src/index.tsx` never calls it — it is unreachable from JS today. The Android bridge has no passkey code at all, so even if a JS method were added, it could only ever be iOS-side.
2. **Unimplemented iOS selectors — a live crash landmine.** `ios/OtplessHeadlessRN.m` declares `RCT_EXTERN_METHOD(setOneTapDataCallback)` and `RCT_EXTERN_METHOD(performOneTap: (NSDictionary *)request)`; neither has a matching `@objc` implementation anywhere in `OtplessHeadlessRN.swift` (confirmed by a full read plus a targeted grep for "OneTap" — zero matches). Calling either from JS (e.g. via direct `NativeModules.OtplessHeadlessRN.performOneTap(...)` access, bypassing the TS facade, which never references either) would hit `-[OtplessHeadlessRN performOneTap:]: unrecognized selector` and crash the app. Not reachable through the current TS surface, but a landmine for any future direct-native-module access or copy-paste of the pattern.
3. **`deliveryChannel` casing is platform-inconsistent.** See §7 item 1 — Android uppercases, iOS doesn't.
4. **Android `commitResponse` has no defensive validation**, unlike `userAuthEvent`'s `runCatching`-wrapped enum parsing. `getResponseType` calls `ResponseTypes.valueOf(responseTypeString)` directly on a string that defaults to `""` when missing (`jsonResponse.optString("responseType", "")`); a missing or unrecognized `responseType` throws an uncaught `IllegalArgumentException` from the native-modules thread. iOS's equivalent defends with defaults (`"FAILED"`, `-25000`) instead of throwing.
5. **Android `initTrueCaller`'s promise can hang forever.** `if (currentActivity == null) return` exits the method without resolving or rejecting `promise` — a JS `await initTrueCaller(...)` in that state never settles.
6. **CI Node version contradicts the declared minimum.** `.nvmrc` pins `16.18.1` (used by `.github/actions/setup/action.yml`'s `node-version-file`), but `package.json`'s `engines.node` requires `>= 18.0.0`. CI is not actually exercising the declared minimum-supported Node version.
7. **Lockfile situation.** No root `yarn.lock` is committed — `.gitignore` has a bare `yarn.lock` line — while `example/yarn.lock` *is* tracked. `packageManager` is a caret range (`"^yarn@1.22.15"`) rather than an exact pin. Both loosen install reproducibility for contributors and CI.
8. **Loose TS typing mirrors the native bridges' own permissiveness.** `initialize(appId: String, ...)` uses the boxed `String` object type rather than primitive `string`; `OtplessResultCallback`, `start(input: any)`, and `commitResponse(response: any)` are all untyped `any` — the compiler cannot catch a malformed request/response shape before it reaches the equally permissive `ReadableMap`/`[String: Any]` parsing on the native side.
9. **`setResponseCallback`/`clearListener` are JS-only.** Neither calls into native code — they only add/remove a `NativeEventEmitter` listener for the `"OTPlessEventResult"` event name. The actual native response delegate/callback is wired exactly once per `initialize()` call (Android also re-passes it on every `start()`), always pointing at `sendHeadlessEventCallback`/`onOtplessResponse`.
10. **No CI coverage for the native bridges or the example app.** `.github/workflows/ci.yml` runs lint/typecheck/jest/`bob build` only — nothing compiles `android/` or `ios/`, and the example app is never built in CI, so a bridge-breaking change (like quirk #2) would pass CI green.
