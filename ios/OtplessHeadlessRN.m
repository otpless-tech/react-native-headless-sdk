#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(OtplessHeadlessRN, RCTEventEmitter<RCTBridgeModule>)

RCT_EXTERN_METHOD(initialize:(NSString *)appId
                  loginUri: (nullable NSString *) loginUri
                  )

RCT_EXTERN_METHOD(start:(NSDictionary *)request)

RCT_EXTERN_METHOD(commitResponse: (nullable NSDictionary *) response)

RCT_EXTERN_METHOD(cleanup)

RCT_EXTERN_METHOD(decimateAll)

RCT_EXTERN_METHOD(setOneTapDataCallback)

RCT_EXTERN_METHOD(performOneTap: (NSDictionary *)request)

RCT_EXTERN_METHOD(authorizeViaPasskey: (NSDictionary *)request)

RCT_EXTERN_METHOD(setDevLogging:(BOOL)enable)

RCT_EXTERN_METHOD(userAuthEvent:(NSString *)event
                  fallback:(BOOL)fallback
                  providerType:(NSString *)providerType
                  providerInfo:(nullable NSDictionary *)providerInfo)

RCT_EXTERN_METHOD(isSdkReady: (RCTPromiseResolveBlock*)resolve reject: (RCTPromiseRejectBlock*)reject)

RCT_EXTERN_METHOD(setMfaEnabled:(BOOL)enabled)

RCT_EXTERN_METHOD(setDeviceFingerprintMode:(NSString *)mode)

RCT_EXTERN_METHOD(startOneTap:(NSDictionary *)config
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

