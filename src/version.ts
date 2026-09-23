/**
 * This package's own version, kept in lock-step with `version` in
 * `package.json`.
 *
 * Internal only: this module is deliberately **not** re-exported from
 * `src/index.tsx` (which exports `OtplessHeadlessModule` and `./models`), so it
 * never becomes merchant-facing API. It exists so the wrapper-attribution token
 * sent to the native SDKs at `initialize`
 * (`react-native-android-<version>` / `react-native-ios-<version>`) has a
 * single source of truth in TypeScript instead of being duplicated in Kotlin
 * and Swift, where it would silently drift on every release.
 *
 * `src/__tests__/version.test.ts` reads `package.json` and fails if this
 * constant falls out of sync, so a forgotten bump breaks CI rather than
 * shipping a wrong token.
 */
export const otplessRnVersion = '3.0.0';
