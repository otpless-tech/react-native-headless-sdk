import { NativeModules, Platform, NativeEventEmitter } from 'react-native';


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
    this.eventEmitter!!.addListener('OTPlessEventResult', callback);
    // call the native method
    OtplessHeadlessRN.setResponseCallback()
  }

  start(input: any) {
    OtplessHeadlessRN.start(input);
  }

  commitResponse(response: any) {
    OtplessHeadlessRN.commitResponse(response);
  }

  performOneTap(data: any) {
    OtplessHeadlessRN.performOneTap(data);
  }

  // Checks if whatsapp is installed on android device
  isWhatsappInstalled(callback: (hasWhatsapp: boolean) => void) {
    if (Platform.OS === 'android') {
      OtplessHeadlessRN.isWhatsappInstalled((result: any) => {
        const hasWhatsapp = result.hasWhatsapp === true;
        callback(hasWhatsapp);
      });
      return
    }
  }
}

export { OtplessHeadlessModule };
