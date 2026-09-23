import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import type {
  OtplessTruecallerRequest,
  OtplessAuthEvent,
  OtplessProviderType,
  OtplessRequestInput,
  OtplessBackgroundAuthConfig,
  OtplessInitOptions,
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

class OtplessHeadlessModule {
  private eventEmitter: NativeEventEmitter | null = null;

  constructor() {
    this.eventEmitter = null;
  }

  clearListener() {
    this.eventEmitter?.removeAllListeners('OTPlessEventResult');
  }

  initialize(
    appId: string,
    loginUri: string | null = null,
    options: OtplessInitOptions | null = null
  ) {
    if (this.eventEmitter == null) {
      this.eventEmitter = new NativeEventEmitter(OtplessHeadlessRN);
    }
    // call the native method; sslPinning is a plain string so an older
    // native module degrades to pinning disabled. buildPlatform is internal
    // wrapper attribution, not a merchant-facing parameter; the native bridges
    // fall back to a bare "react-native-<platform>" if it ever arrives blank.
    OtplessHeadlessRN.initialize(
      appId,
      loginUri,
      options?.sslPinning ?? 'disabled',
      BUILD_PLATFORM
    );
  }

  setResponseCallback(callback: OtplessResultCallback) {
    this.eventEmitter?.addListener('OTPlessEventResult', callback);
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
