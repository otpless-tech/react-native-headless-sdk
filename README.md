<p align="center">
  <img src="https://github.com/otpless-tech/Otpless-iOS-SDK/blob/main/otpless.svg" height="80"/>
</p>


# OTPLESS react native headless SDK

The new Authentication SDK offers significantly improved speed, reliability, and security, ensuring a seamless authentication and integration experience. We strongly recommend upgrading by removing the old SDK and following the steps below.

## Install OTPLESS SDK Dependency

[![npm version](https://badge.fury.io/js/otpless-headless-rn.svg)](https://badge.fury.io/js/otpless-headless-rn)
[![npm downloads](https://img.shields.io/npm/dm/otpless-headless-rn.svg)](https://www.npmjs.com/package/otpless-headless-rn)


## Installation
Install the OTPLESS SDK dependency by running the following command in your terminal at the root of your React Native project:

```
npm i otpless-headless-rn
```

# Configure Sign up/Sign in

### Import

```javascript
import { OtplessHeadlessModule } from 'otpless-headless-rn';
```


```javascript
const headlessModule = new OtplessHeadlessModule();
```

```javascript
useEffect(() => {
      headlessModule.initialize("YOUR_APPID")
      headlessModule.setResponseCallback(onHeadlessResult);
      return () => {
          headlessModule.clearListener();
          headlessModule.cleanup();
      };
  }, []);
```

### SSL pinning (optional)

SSL pinning is **off by default**; the two-argument `initialize` call above behaves exactly as before. To opt in, pass a third `options` argument:

```javascript
headlessModule.initialize("YOUR_APPID", null, { sslPinning: 'enabled' });
```

```ts
type OtplessSslPinning = 'enabled' | 'disabled';
interface OtplessInitOptions { sslPinning?: OtplessSslPinning }
initialize(appId: string, loginUri?: string | null, options?: OtplessInitOptions): void
```

When enabled, the native SDK pins the TLS certificate of `sigma.otpless.app` on both Android and iOS. If the pin does not match (for example behind an intercepting proxy such as Charles or Proxyman), the SDK **fails closed**: no request leaves the device and you receive `FAILED` with `statusCode` `5004` (see [Response Handling](#response-handling)). If your organisation runs a corporate proxy or a network allowlist, make sure `sigma.otpless.app` is reachable directly with its original certificate.

Requires `io.github.otpless-tech:otpless-headless-sdk` >= 2.0.1 on Android and `OtplessBM/Core` >= 3.0.1 on iOS (both pulled in automatically by this package).

# Initiate Authentication

## Phone Auth

### Request 
```javascript 
const startPhoneAuth = (phoneNumber: string, countryCode: string) => {
  const request = {
      phone: phoneNumber,
      countryCode
  };
  headlessModule.start(request);
};
```

### Verify 

```javascript
const verifyPhoneOtp = (phoneNumber: string, countryCode: string, otp: string) => {
  const request = {
      phone: phoneNumber,
      countryCode,
      otp
  };
  headlessModule.start(request);
};
```

# Response Handling

```javascript
const onHeadlessResult = (result: any) => {
  headlessModule.commitResponse(result);
  const responseType = result.responseType;

  switch (responseType) {
    case "SDK_READY": {
      // Notify that SDK is ready
      console.log("SDK is ready");
      break;
    }
    case "FAILED": {
      if (result.statusCode == 5003) {
        // SDK initialization failed (e.g. invalid appId or network unavailable)
        console.log("SDK initialization failed");
      } else if (result.statusCode == 5004) {
        // SSL pin validation failed. Only emitted when `initialize` was called
        // with `{ sslPinning: 'enabled' }`. The SDK sent nothing to the server;
        // the connection to sigma.otpless.app is being intercepted or its
        // certificate does not match the expected pin.
        // result.response = { errorCode: "5004", errorMessage: "SSL pin validation failed" }
        console.log("SSL pin validation failed");
      } else {
        console.log("SDK failed", result.statusCode);
      }
      break;
    }
    case "INITIATE": {
      // Notify that headless authentication has been initiated
      if (result.statusCode == 200) {
        console.log("Headless authentication initiated");
        const authType = result.response.authType; // This is the authentication type
        if (authType === "OTP") {
          // Take user to OTP verification screen
        } else if (authType === "SILENT_AUTH") {
          // Handle Silent Authentication initiation by showing 
          // loading status for SNA flow.
        }
      } else {
        // Handle initiation error. 
        // To handle initiation error response, please refer to the error handling section.
        if (Platform.OS === 'ios') {
            handleInitiateErrorIOS(result.response);
        } else if (Platform.OS === 'android') {
            handleInitiateErrorAndroid(result.response);
        }
      }
      break;
    }
    case "OTP_AUTO_READ": {
        // OTP_AUTO_READ is triggered only in Android devices for WhatsApp and SMS.
      if (Platform.OS === "android") {
        const otp = result.response.otp;
        console.log(`OTP Received: ${otp}`);
      }
      break;
    }
    case "VERIFY": {
        // notify that verification has failed.
        if (result.response.authType == "SILENT_AUTH") {
            if (result.statusCode == 9106) {
                // Silent Authentication and all fallback authentication methods in SmartAuth have failed.
                //  The transaction cannot proceed further. 
                // Handle the scenario to gracefully exit the authentication flow 
            }  else {
                // Silent Authentication failed. 
                // If SmartAuth is enabled, the INITIATE response 
                // will include the next available authentication method configured in the dashboard.
            }
        } else {
            // To handle verification failed response, please refer to the error handling section.
            if (Platform.OS === 'ios') {
                handleVerifyErrorIOS(result.response);
            } else if (Platform.OS === 'android') {
                handleVerifyErrorAndroid(result.response);
            }
        }

      break;
    }
    case "DELIVERY_STATUS": {
        // This function is called when delivery is successful for your authType.
        const authType = result.response.authType;
        // It is the authentication type (OTP, MAGICLINK, OTP_LINK) for which the delivery status is being sent
        const deliveryChannel = result.response.deliveryChannel;
        // It is the delivery channel (SMS, WHATSAPP, etc) on which the authType has been delivered
    }

    case "ONETAP": {
      const token = result.response.token;
      if (token != null) {
        console.log(`OneTap Data: ${token}`);
      // Process token and proceed. 
      }
      break;
    }
    case "FALLBACK_TRIGGERED": {
    // A fallback occurs when an OTP delivery attempt on one channel fails,  
    // and the system automatically retries via the subsequent channel selected on Otpless Dashboard.  
    // For example, if a merchant opts for SmartAuth with primary channal as WhatsApp and secondary channel as SMS,
    // in that case, if OTP delivery on WhatsApp fails, the system will automatically retry via SMS.
    // The response will contain the deliveryChannel to which the OTP has been sent.
      if (response.response.deliveryChannel != null) {
          const newDeliveryChannel = response.response.deliveryChannel 
          // This is the deliveryChannel to which the OTP has been sent
      }
      break;
    }
    default: {
      console.warn(`Unknown response type: ${responseType}`);
      break;
    }
  }

};
```

## Android manifest update
Add Network Security Config inside your android/app/src/main/AndroidManifest.xml file into your <application> code block (Only required if you are using the SNA feature):

```xml
android:networkSecurityConfig="@xml/otpless_network_security_config"
```

## Ios info.plist update

Add the following block to your info.plist file (Only required if you are using the SNA feature):

```xml
<dict>
	<key>NSAllowsArbitraryLoads</key>
	<true/>
	<key>NSExceptionDomains</key>
	<dict>
		<key>80.in.safr.sekuramobile.com</key>
		<dict>
			<key>NSIncludesSubdomains</key>
			<true/>
			<key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
			<true/>
			<key>NSTemporaryExceptionMinimumTLSVersion</key>
			<string>TLSv1.1</string>
		</dict>
		<key>partnerapi.jio.com</key>
		<dict>
			<key>NSIncludesSubdomains</key>
			<true/>
			<key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
			<true/>
			<key>NSTemporaryExceptionMinimumTLSVersion</key>
			<string>TLSv1.1</string>
		</dict>
	</dict>
</dict>
```

</br></br></br>
# Note 

For complete documentation and other login feature explore, follow the following guide here:  [installation guide here](https://otpless.com/docs/frontend-sdks/app-sdks/react-native/new/headless/headless)

## Author

[OTPLESS](https://otpless.com), developer@otpless.com
