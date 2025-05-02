#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(OtplessHeadlessRN, RCTEventEmitter<RCTBridgeModule>)

RCT_EXTERN_METHOD(initialize:(NSString *)appId
                  loginUri: (nullable NSString *) loginUri
                  )

RCT_EXTERN_METHOD(setResponseCallback)

RCT_EXTERN_METHOD(start:(NSDictionary *)request)

RCT_EXTERN_METHOD(enableDebugLogging:(BOOL)enable)

RCT_EXTERN_METHOD(commitResponse: (nullable NSDictionary *) response)

RCT_EXTERN_METHOD(cleanup)

RCT_EXTERN_METHOD(decimateAll)

RCT_EXTERN_METHOD(setOneTapDataCallback)

RCT_EXTERN_METHOD(performOneTap: (NSDictionary *)request)

RCT_EXTERN_METHOD(authorizeViaPasskey: (NSDictionary *)request)

@end

