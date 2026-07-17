import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import type {
  OtplessTruecallerRequest,
  OtplessAuthEvent,
  OtplessProviderType,
  OtplessRequestInput,
  OtplessDeviceFingerprintMode,
} from './models';

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

  initialize(appId: String, loginUri: string | null = null) {
    if (this.eventEmitter == null) {
      this.eventEmitter = new NativeEventEmitter(OtplessHeadlessRN);
    }
    // call the native method
    OtplessHeadlessRN.initialize(appId, loginUri);
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

  setDeviceFingerprintMode(mode: OtplessDeviceFingerprintMode) {
    OtplessHeadlessRN.setDeviceFingerprintMode(mode);
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
    OtplessHeadlessRN.userAuthEvent(event, fallback, providerType, providerInfo);
  }
}

export { OtplessHeadlessModule };
export * from './models';
