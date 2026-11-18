# Changelog

## 3.1.0 (18th November 2026)
### Features
- **Option to disable OTP auto-read (Android).** `initialize` options take a new optional `config`. Passing `{ config: { disableOtpAutoRead: 'true' } }` stops the Android SDK from registering the SMS / WhatsApp zero-tap OTP auto-read receivers for that `initialize` call, for SNA-only integrations. Auto-read stays on when the key is absent or its value is anything other than exactly `'true'`, so existing integrations are unchanged. Unknown keys and non-string values are dropped. iOS ignores it. The native `initialize` now takes a fifth `config` argument on both platforms.
- **SIM binding monitor (Android).** New `registerSimBindingMonitor(): Promise<boolean>`, `unregisterSimBindingMonitor()` and `setSimBindingCallback(callback | null)`, bridging the native SDK's `registerSimBindingMonitor` / `unregisterSimBindingMonitor` / `setSimBindingMonitorCallback`. The callback receives `{ state }`, where `state` is a `SimBindingState` (`'ENABLED'` | `'DISABLED'`, exported from the package). Same API and event name (`OTPlessSimBindingEvent`) as `otpless-headless-rn-lite`. All three are no-ops on iOS; `registerSimBindingMonitor` resolves `false`.
- New exported types: `OtplessConfig`, `OtplessConfigKey`, `SimBindingState`, `SimBindingCallback`.

### Changes
- Android: bump `io.github.otpless-tech:otpless-headless-sdk` `2.0.1` → `2.4.0`. The bridge compiles against it; the new APIs it uses are listed under Features. What changes for your app:
  - **Play Integrity:** setup now runs in the background, so `SDK_READY` no longer waits for it. An expired token provider (`INTEGRITY_TOKEN_PROVIDER_INVALID`) or a dead Play Store integrity service is recovered with one retry. When Play Integrity is not mandatory for your app, the SDK waits up to **5 seconds** (was 2) for the token before sending the intent, and with backend opt-in it can be made a hard prerequisite.
  - **Initialization:** fixes an ANR and a `NullPointerException` (when `cleanup()` runs during `initialize`). Merchant config now recovers from error `7005` (stale state). If `initialize` fails before the SDK can report its result, your response callback now receives `FAILED` / `5003` instead of nothing or a crash.
  - **SNA fast-path (backend opt-in):** an `INITIATE` response can now arrive before `ONETAP`.
  - **Google / Facebook SDK sign-in:** all sign-in parameters on the intent URI are now read, and `permissions` is passed through.
- iOS: bump `OtplessBM/Core` `3.0.1` → `3.1.1`. No public API change. What changes for your app:
  - **App Attest (iOS 14+):** when OTPLESS enables it for your app through the merchant config, the SDK registers an App Attest key in the background after `SDK_READY` and attaches an assertion to the intent request. It never delays or fails an authentication. For App Store / TestFlight builds, add the `com.apple.developer.devicecheck.appattest-environment` entitlement set to `production`; without it Apple issues development keys.
  - **State refresh:** error `7005` on the intent or merchant config call now refreshes the state and retries once, and stale Keychain state left by a previous install is cleared on first launch.
  - **Cellular / telemetry fixes** from 3.0.2, and the backend `requestId` (auto intent) flow fix from 3.1.1.
- The wrapper-attribution token follows the bump: telemetry now reports `react-native-android-3.1.0` / `react-native-ios-3.1.0`.

No breaking JavaScript API changes: `config` is optional and the SIM binding monitor APIs are additive. Not exposed yet: the native `removeDeviceBoundIdentity`.

## 3.0.0
- Opt-in SSL pinning (`initialize(appId, loginUri, { sslPinning })`) and wrapper attribution. Android `otpless-headless-sdk` 2.0.1, iOS `OtplessBM/Core` 3.0.0.
