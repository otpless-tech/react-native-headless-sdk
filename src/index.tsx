import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import type {
  OtplessTruecallerRequest,
  OtplessAuthEvent,
  OtplessProviderType,
  OtplessRequestInput,
  OtplessBackgroundAuthConfig,
  OtplessInitOptions,
  OtplessConfig,
  OtplessConfigKey,
  SimBindingCallback,
} from './models';
import { otplessRnVersion } from './version';

const LINKING_ERROR =
  `The package 'otpless-headless-rn' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const OtplessHeadlessRN = NativeModules.OtplessHeadlessRN
  ? NativeModules.OtplessHeadlessRN
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

/**
 * Wrapper-attribution token sent to the native SDKs at `initialize`.
 *
 * Computed here, in JS, so `otplessRnVersion` is the single source of truth:
 * the Kotlin and Swift bridges only forward whatever arrives over the bridge,
 * instead of each hardcoding a version that would drift on every release.
 *
 * Emitted by the native device-telemetry event as:
 * - Android - `otpless-headless-sdk(react-native-android-<version>)`
 * - iOS - `otpless-headless(react-native-ios-<version>)`
 *
 * The `react-native-` prefix distinguishes this package from the sibling
 * wrappers (`react-native-lite-*`, `react-native-turbo-*`), which share the
 * same iOS telemetry prefix.
 */
const BUILD_PLATFORM = `react-native-${Platform.OS}-${otplessRnVersion}`;

interface OtplessResultCallback {
  (result: any): void;
}

const SIM_BINDING_EVENT = 'OTPlessSimBindingEvent';

const CONFIG_KEYS: readonly OtplessConfigKey[] = ['disableOtpAutoRead'];

/**
 * Keeps only known keys with string values, so the native side never sees
 * anything it cannot map to `OtplessConfigKey`.
 */
function sanitizeConfig(config: OtplessConfig | undefined): OtplessConfig {
  const result: OtplessConfig = {};
  if (config == null || typeof config !== 'object') {
    return result;
  }
  for (const key of CONFIG_KEYS) {
    const value = (config as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}

class OtplessHeadlessModule {
  private eventEmitter: NativeEventEmitter | null = null;

  constructor() {
    this.eventEmitter = null;
  }

  // Created on first use, not in initialize(): on a cold start where the user
  // is already logged in, apps call setSimBindingCallback() without ever
  // calling initialize(), and the listener must still attach.
  private getEventEmitter(): NativeEventEmitter {
    if (this.eventEmitter == null) {
      this.eventEmitter = new NativeEventEmitter(OtplessHeadlessRN);
    }
    return this.eventEmitter;
  }

  clearListener() {
    this.eventEmitter?.removeAllListeners('OTPlessEventResult');
  }

  initialize(
    appId: string,
    loginUri: string | null = null,
    options: OtplessInitOptions | null = null
  ) {
    this.getEventEmitter();
    // call the native method; sslPinning is a plain string so an older
    // native module degrades to pinning disabled. buildPlatform is internal
    // wrapper attribution, not a merchant-facing parameter; the native bridges
    // fall back to a bare "react-native-<platform>" if it ever arrives blank.
    // config is forwarded as a map; iOS accepts and ignores it.
    OtplessHeadlessRN.initialize(
      appId,
      loginUri,
      options?.sslPinning ?? 'disabled',
      BUILD_PLATFORM,
      sanitizeConfig(options?.config)
    );
  }

  setResponseCallback(callback: OtplessResultCallback) {
    this.getEventEmitter().addListener('OTPlessEventResult', callback);
  }

  start(input: OtplessRequestInput) {
    OtplessHeadlessRN.start(input);
  }

  commitResponse(response: any) {
    OtplessHeadlessRN.commitResponse(response);
  }

  // Checks if whatsapp is installed on android device
  async isWhatsappInstalledForAndroid(): Promise<boolean> {
    if (Platform.OS === 'android') {
      // Android-specific code
      return await OtplessHeadlessRN.isWhatsappInstalled();
    } else {
      return false;
    }
  }

  cleanup() {
    OtplessHeadlessRN.cleanup();
  }

  decimateAll() {
    if (Platform.OS.toLowerCase() === 'ios') {
      OtplessHeadlessRN.decimateAll();
    }
  }

  setDevLogging(enable: boolean) {
    OtplessHeadlessRN.setDevLogging(enable);
  }

  setMfaEnabled(enabled: boolean) {
    OtplessHeadlessRN.setMfaEnabled(enabled);
  }

  async startBackgroundAuth(
    config: OtplessBackgroundAuthConfig
  ): Promise<boolean> {
    return await OtplessHeadlessRN.startBackgroundAuth(config);
  }

  startInBackground(input: OtplessRequestInput) {
    if (Platform.OS === 'android') {
      OtplessHeadlessRN.startInBackground(input);
    }
  }

  setSimBindingEnabled(enabled: boolean) {
    if (Platform.OS === 'android') {
      OtplessHeadlessRN.setSimBindingEnabled(enabled);
    }
  }

  async checkSimBindingStatus(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return await OtplessHeadlessRN.checkSimBindingStatus();
    }
    return false;
  }

  async clearSimBinding(): Promise<void> {
    if (Platform.OS === 'android') {
      await OtplessHeadlessRN.clearSimBinding();
    }
  }

  /**
   * Start observing SIM state changes on Android, so the callback set via
   * `setSimBindingCallback` fires with `state: 'DISABLED'` when the bound SIM
   * is removed. Idempotent: repeat calls are no-ops until
   * `unregisterSimBindingMonitor()`. Resolves `true` once the monitor is
   * registered.
   *
   * Android-only; resolves `false` on iOS (the iOS SDK has no SIM binding
   * monitor).
   */
  registerSimBindingMonitor(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return OtplessHeadlessRN.registerSimBindingMonitor();
    }
    return Promise.resolve(false);
  }

  /**
   * Stop observing SIM state changes on Android. Does not clear the callback
   * set via `setSimBindingCallback`, which keeps receiving save/clear events.
   *
   * Android-only; no-op on iOS.
   */
  unregisterSimBindingMonitor() {
    if (Platform.OS === 'android') {
      OtplessHeadlessRN.unregisterSimBindingMonitor();
    }
  }

  /**
   * Set (or clear with `null`) the callback that fires on every SIM binding
   * state change: `ENABLED` after a binding is saved, `DISABLED` on any clear
   * or on SIM removal while `registerSimBindingMonitor()` is active.
   *
   * Overwrite semantics, matching Android's `setSimBindingMonitorCallback`:
   * any earlier listener is removed first, so one state change never fires
   * the callback twice. Does not require `initialize()`, so it can be set on
   * an app start where no login happens. Passing `null` removes the listener
   * and the native callback.
   *
   * Android-only; no-op on iOS.
   */
  setSimBindingCallback(callback: SimBindingCallback | null) {
    if (Platform.OS !== 'android') {
      return;
    }
    // Always clear first so repeated calls overwrite, not stack.
    const emitter = this.getEventEmitter();
    emitter.removeAllListeners(SIM_BINDING_EVENT);
    if (callback == null) {
      OtplessHeadlessRN.setSimBindingCallback(false);
      return;
    }
    emitter.addListener(SIM_BINDING_EVENT, callback);
    OtplessHeadlessRN.setSimBindingCallback(true);
  }

  async isSdkReady(): Promise<boolean> {
    return await OtplessHeadlessRN.isSdkReady();
  }

  async initTrueCaller(requestMap: OtplessTruecallerRequest): Promise<boolean> {
    if (Platform.OS === 'android') {
      return await OtplessHeadlessRN.initTrueCaller(requestMap);
    }
    return false;
  }

  userAuthEvent(
    event: OtplessAuthEvent,
    providerType: OtplessProviderType,
    fallback: boolean = false,
    providerInfo: any = {}
  ) {
    OtplessHeadlessRN.userAuthEvent(
      event,
      fallback,
      providerType,
      providerInfo
    );
  }
}

export { OtplessHeadlessModule };
export * from './models';
