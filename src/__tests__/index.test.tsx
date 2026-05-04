import { NativeModules, Platform } from 'react-native';
import { OtplessHeadlessModule } from '../index';

// Mock the native module
const mockNativeModule = {
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
};

jest.mock('react-native', () => ({
  NativeModules: {
    OtplessHeadlessRN: mockNativeModule,
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

  it('does not call native userAuthEvent on iOS', () => {
    Platform.OS = 'ios';

    module.userAuthEvent('AUTH_SUCCESS', 'CLIENT');

    expect(mockNativeModule.userAuthEvent).not.toHaveBeenCalled();
  });
});
