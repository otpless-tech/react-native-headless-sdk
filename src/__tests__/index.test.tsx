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
      registerSimBindingMonitor: jest.fn(() => Promise.resolve(true)),
      unregisterSimBindingMonitor: jest.fn(),
      setSimBindingCallback: jest.fn(),
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

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { OtplessHeadlessModule } from '../index';
import type { SimBindingState, OtplessConfig } from '../index';
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
      `react-native-android-${otplessRnVersion}`,
      {}
    );
  });

  it('keeps the token alongside an explicit sslPinning option', () => {
    const module = new OtplessHeadlessModule();
    module.initialize('APP_ID', null, { sslPinning: 'enabled' });

    expect(mockNativeModule.initialize).toHaveBeenCalledWith(
      'APP_ID',
      null,
      'enabled',
      `react-native-android-${otplessRnVersion}`,
      {}
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
      `react-native-ios-${otplessRnVersion}`,
      {}
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

describe('OtplessHeadlessModule.initialize config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards disableOtpAutoRead as the fifth argument', () => {
    new OtplessHeadlessModule().initialize('APP_ID', null, {
      config: { disableOtpAutoRead: 'true' },
    });

    expect(mockNativeModule.initialize).toHaveBeenCalledWith(
      'APP_ID',
      null,
      'disabled',
      `react-native-android-${otplessRnVersion}`,
      { disableOtpAutoRead: 'true' }
    );
  });

  it('sends an empty config when none is given', () => {
    new OtplessHeadlessModule().initialize('APP_ID', null, {
      sslPinning: 'enabled',
    });

    expect(mockNativeModule.initialize.mock.calls[0][4]).toEqual({});
  });

  it('drops unknown keys and non-string values', () => {
    new OtplessHeadlessModule().initialize('APP_ID', null, {
      config: { disableOtpAutoRead: true, unknownKey: 'x' } as any,
    });

    expect(mockNativeModule.initialize.mock.calls[0][4]).toEqual({});
  });
});

describe('OtplessHeadlessModule SIM binding monitor', () => {
  let module: OtplessHeadlessModule;

  // The emitter created by initialize(); NativeEventEmitter is mocked to
  // return a fresh object per construction.
  const lastEmitter = () => {
    const results = (NativeEventEmitter as unknown as jest.Mock).mock.results;
    return results[results.length - 1]!.value;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    module = new OtplessHeadlessModule();
    module.initialize('APP_ID');
  });

  afterEach(() => {
    Platform.OS = 'android';
  });

  it('registerSimBindingMonitor resolves the native result on Android', async () => {
    await expect(module.registerSimBindingMonitor()).resolves.toBe(true);
    expect(mockNativeModule.registerSimBindingMonitor).toHaveBeenCalledTimes(1);
  });

  it('unregisterSimBindingMonitor calls native on Android', () => {
    module.unregisterSimBindingMonitor();
    expect(mockNativeModule.unregisterSimBindingMonitor).toHaveBeenCalledTimes(
      1
    );
  });

  it('setSimBindingCallback attaches one listener and enables native', () => {
    const callback = jest.fn();
    module.setSimBindingCallback(callback);

    const emitter = lastEmitter();
    expect(emitter.removeAllListeners).toHaveBeenCalledWith(
      'OTPlessSimBindingEvent'
    );
    expect(emitter.addListener).toHaveBeenCalledWith(
      'OTPlessSimBindingEvent',
      callback
    );
    expect(mockNativeModule.setSimBindingCallback).toHaveBeenCalledWith(true);
  });

  it('setSimBindingCallback(null) removes the listener and disables native', () => {
    module.setSimBindingCallback(null);

    const emitter = lastEmitter();
    expect(emitter.removeAllListeners).toHaveBeenCalledWith(
      'OTPlessSimBindingEvent'
    );
    expect(emitter.addListener).not.toHaveBeenCalled();
    expect(mockNativeModule.setSimBindingCallback).toHaveBeenCalledWith(false);
  });

  it('is a no-op on iOS, and register resolves false', async () => {
    Platform.OS = 'ios';

    await expect(module.registerSimBindingMonitor()).resolves.toBe(false);
    module.unregisterSimBindingMonitor();
    module.setSimBindingCallback(jest.fn());

    expect(mockNativeModule.registerSimBindingMonitor).not.toHaveBeenCalled();
    expect(mockNativeModule.unregisterSimBindingMonitor).not.toHaveBeenCalled();
    expect(mockNativeModule.setSimBindingCallback).not.toHaveBeenCalled();
  });
});

describe('package type exports', () => {
  it('exports SimBindingState and OtplessConfig', () => {
    const states: SimBindingState[] = ['ENABLED', 'DISABLED'];
    const config: OtplessConfig = { disableOtpAutoRead: 'true' };
    expect(states).toHaveLength(2);
    expect(config.disableOtpAutoRead).toBe('true');
  });
});

// Cold start: the user is already logged in, so the app never calls
// initialize() or setResponseCallback() but still watches the SIM binding.
describe('OtplessHeadlessModule callbacks without initialize()', () => {
  const emitters = () =>
    (NativeEventEmitter as unknown as jest.Mock).mock.results.map(
      (r) => r.value
    );

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  it('setSimBindingCallback attaches the listener on a fresh module', () => {
    const module = new OtplessHeadlessModule();
    const callback = jest.fn();
    module.setSimBindingCallback(callback);

    expect(emitters()).toHaveLength(1);
    expect(emitters()[0].addListener).toHaveBeenCalledWith(
      'OTPlessSimBindingEvent',
      callback
    );
    expect(mockNativeModule.setSimBindingCallback).toHaveBeenCalledWith(true);
  });

  it('setSimBindingCallback(null) on a fresh module still clears native', () => {
    new OtplessHeadlessModule().setSimBindingCallback(null);
    expect(mockNativeModule.setSimBindingCallback).toHaveBeenCalledWith(false);
  });

  it('setResponseCallback attaches the listener before initialize()', () => {
    const module = new OtplessHeadlessModule();
    const callback = jest.fn();
    module.setResponseCallback(callback);

    expect(emitters()[0].addListener).toHaveBeenCalledWith(
      'OTPlessEventResult',
      callback
    );
  });

  it('reuses one emitter across setSimBindingCallback and initialize()', () => {
    const module = new OtplessHeadlessModule();
    module.setSimBindingCallback(jest.fn());
    module.initialize('APP_ID');
    module.setResponseCallback(jest.fn());

    expect(emitters()).toHaveLength(1);
  });
});
