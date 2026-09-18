jest.mock('react-native', () => ({
  NativeModules: {
    OtplessHeadlessRN: {
      initialize: jest.fn(),
      start: jest.fn(),
      commitResponse: jest.fn(),
      cleanup: jest.fn(),
      isSdkReady: jest.fn(),
      setDevLogging: jest.fn(),
      isWhatsappInstalled: jest.fn(),
      initTrueCaller: jest.fn(),
      decimateAll: jest.fn(),
      userAuthEvent: jest.fn(),
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
  Platform: {
    OS: 'android',
    select: jest.fn((spec: any) => spec.android ?? spec.default),
  },
}));

import { NativeModules, Platform } from 'react-native';
import { OtplessHeadlessModule } from '../index';
import { otplessRnVersion } from '../version';

// Get reference to mock for assertions
const mockNativeModule = NativeModules.OtplessHeadlessRN as any;

describe('OtplessHeadlessModule.initialize build-platform token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Platform.OS = 'android';
  });

  // The token is computed once at module load, so the Platform.OS mock above
  // ('android') is what index.tsx captured. The iOS shape is covered by the
  // isolated re-import below.
  it('passes react-native-android-<version> as the fourth argument', () => {
    const module = new OtplessHeadlessModule();
    module.initialize('APP_ID', 'https://otpless.com');

    expect(mockNativeModule.initialize).toHaveBeenCalledTimes(1);
    expect(mockNativeModule.initialize).toHaveBeenCalledWith(
      'APP_ID',
      'https://otpless.com',
      'disabled',
      `react-native-android-${otplessRnVersion}`
    );
  });

  it('keeps the token alongside an explicit sslPinning option', () => {
    const module = new OtplessHeadlessModule();
    module.initialize('APP_ID', null, { sslPinning: 'enabled' });

    expect(mockNativeModule.initialize).toHaveBeenCalledWith(
      'APP_ID',
      null,
      'enabled',
      `react-native-android-${otplessRnVersion}`
    );
  });

  it('passes react-native-ios-<version> when loaded on iOS', () => {
    Platform.OS = 'ios';
    jest.isolateModules(() => {
      // Re-import so the module-level token is recomputed with Platform.OS
      // set to 'ios'.
      const { OtplessHeadlessModule: IosModule } = require('../index');
      new IosModule().initialize('APP_ID', null);
    });

    expect(mockNativeModule.initialize).toHaveBeenCalledWith(
      'APP_ID',
      null,
      'disabled',
      `react-native-ios-${otplessRnVersion}`
    );
  });
});

describe('OtplessHeadlessModule.userAuthEvent', () => {
  let module: OtplessHeadlessModule;

  beforeEach(() => {
    jest.clearAllMocks();
    module = new OtplessHeadlessModule();
  });

  afterEach(() => {
    Platform.OS = 'android';
  });

  it('calls native userAuthEvent on Android with all arguments', () => {
    module.userAuthEvent('AUTH_SUCCESS', 'OTPLESS', true, { userId: 'abc123' });

    expect(mockNativeModule.userAuthEvent).toHaveBeenCalledTimes(1);
    expect(mockNativeModule.userAuthEvent).toHaveBeenCalledWith(
      'AUTH_SUCCESS',
      true,
      'OTPLESS',
      { userId: 'abc123' }
    );
  });

  it('uses false as default value for fallback', () => {
    module.userAuthEvent('AUTH_INITIATED', 'CLIENT');

    expect(mockNativeModule.userAuthEvent).toHaveBeenCalledWith(
      'AUTH_INITIATED',
      false,
      'CLIENT',
      {}
    );
  });

  it('uses empty object as default value for providerInfo', () => {
    module.userAuthEvent('AUTH_FAILED', 'OTPLESS', true);

    expect(mockNativeModule.userAuthEvent).toHaveBeenCalledWith(
      'AUTH_FAILED',
      true,
      'OTPLESS',
      {}
    );
  });

  it('passes non-string providerInfo through as-is (any type)', () => {
    const providerInfo = { score: 42, active: true, meta: { nested: 'value' } };
    module.userAuthEvent('AUTH_SUCCESS', 'CLIENT', false, providerInfo);

    expect(mockNativeModule.userAuthEvent).toHaveBeenCalledWith(
      'AUTH_SUCCESS',
      false,
      'CLIENT',
      providerInfo
    );
  });

  it('calls native userAuthEvent on iOS (bridge added in OtplessBM 2.3.2)', () => {
    Platform.OS = 'ios';

    module.userAuthEvent('AUTH_SUCCESS', 'CLIENT');

    expect(mockNativeModule.userAuthEvent).toHaveBeenCalledTimes(1);
    expect(mockNativeModule.userAuthEvent).toHaveBeenCalledWith(
      'AUTH_SUCCESS',
      false,
      'CLIENT',
      {}
    );
  });
});
