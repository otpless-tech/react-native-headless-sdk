package com.otplessheadlessrn

import android.app.Activity
import android.content.Intent
import android.util.Log
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.otpless.longclaw.tc.OTScopeRequest
import com.otpless.v2.android.sdk.dto.OtplessResponse
import com.otpless.v2.android.sdk.main.OtplessSDK
import com.otpless.v2.android.sdk.utils.OtplessUtils
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONException
import org.json.JSONObject

class OtplessHeadlessRNModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  private var otplessJob: Job? = null
  private val lifecycleMutex = Mutex()
  private val ioScope = CoroutineScope(Dispatchers.IO + SupervisorJob() + CoroutineExceptionHandler { context, throwable ->
    Log.d("OTPLESS", "Error in coroutine", throwable)
  })

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String {
    return NAME
  }

  private fun sendHeadlessEventCallback(result: OtplessResponse) {
    fun sendResultEvent(result: JSONObject) {
      try {
        val map = convertJsonToMap(result)
        this.reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("OTPlessEventResult", map)
      } catch (_: JSONException) {

      }
    }

    val jsonObject = JSONObject()
    try {
      jsonObject.put("responseType", result.responseType)
      jsonObject.put("response", result.response)
      jsonObject.put("statusCode", result.statusCode)
    } catch (_: JSONException) {

    }
    sendResultEvent(jsonObject)
  }

  @ReactMethod
  fun isWhatsappInstalled(promise: Promise) {
    val hasWhatsapp = OtplessUtils.isWhatsAppInstalled(reactContext)
    promise.resolve(hasWhatsapp)
  }

  @ReactMethod
  fun initialize(appId: String, loginUri: String? = null) {
    val activity = currentActivity ?: return
    ioScope.launch {
      lifecycleMutex.withLock {
        OtplessSDK.initialize(
          appId = appId, activity = activity,
          loginUri = loginUri, callback = this@OtplessHeadlessRNModule::sendHeadlessEventCallback
        )
      }
    }
  }

  @ReactMethod
  fun initTrueCaller(requestMap: ReadableMap, promise: Promise) {
    val activity = currentActivity ?: return
    val request = parseTrueCallerRequest(requestMap)
    val scopes = parseTrueCallerScope(requestMap)
    val result = OtplessSDK.initTrueCaller(activity, request) {
      OTScopeRequest.ActivityRequest(activity as FragmentActivity, scopes)
    }
    debugLog("init truecaller result: $result")
    promise.resolve(result)
  }

  @ReactMethod
  fun userAuthEvent(event: String, fallback: Boolean, providerType: String, providerInfo: ReadableMap?) {
    val authEvent = parseAuthEvent(event) ?: run {
      debugLog("userAuthEvent: unknown AuthEvent '$event', ignoring call")
      return
    }
    val provider = parseProviderType(providerType) ?: run {
      debugLog("userAuthEvent: unknown ProviderType '$providerType', ignoring call")
      return
    }
    val infoMap = parseProviderInfo(providerInfo)
    debugLog("pushing the user auth event\nauthEvent: $authEvent, providerType: $providerType")
    OtplessSDK.userAuthEvent(authEvent, fallback, provider, infoMap)
  }

  @ReactMethod
  fun start(data: ReadableMap) {
    val otplessRequest = parseOtplessRequest(data)
    val isOtpVerification = !data.getString("otp").isNullOrEmpty()

    if (isOtpVerification) {
      // OTP submit — slot into the current auth flow; don't cancel, don't track
      ioScope.launch {
        OtplessSDK.start(request = otplessRequest, this@OtplessHeadlessRNModule::sendHeadlessEventCallback)
      }
    } else {
      otplessJob?.cancel()
      otplessJob = ioScope.launch {
        OtplessSDK.start(request = otplessRequest, this@OtplessHeadlessRNModule::sendHeadlessEventCallback)
      }
    }
  }

  @ReactMethod
  fun isSdkReady(promise: Promise) {
    promise.resolve(OtplessSDK.isSdkReady)
  }

  @ReactMethod
  fun cleanup() {
    otplessJob?.cancel()
    ioScope.launch {
      lifecycleMutex.withLock {
        OtplessSDK.cleanup()
      }
    }
  }

  @ReactMethod
  fun setDevLogging(devLogging: Boolean) {
    debugLog("dev logging: $devLogging")
    OtplessSDK.devLogging = devLogging
  }

  @ReactMethod
  fun setMfaEnabled(enabled: Boolean) {
    OtplessSDK.isMfaEnabled = enabled
  }

  @ReactMethod
  fun setSimBindingEnabled(enabled: Boolean) {
    OtplessSDK.isSimBindingEnabled = enabled
  }

  @ReactMethod
  fun checkSimBindingStatus(promise: Promise) {
    ioScope.launch {
      try {
        val bound = OtplessSDK.checkSimBindingStatus(reactContext.applicationContext)
        promise.resolve(bound)
      } catch (_: Throwable) {
        promise.resolve(false)
      }
    }
  }

  @ReactMethod
  fun clearSimBinding(promise: Promise) {
    ioScope.launch {
      try {
        OtplessSDK.clearSimBinding(reactContext.applicationContext)
        promise.resolve(null)
      } catch (_: Throwable) {
        promise.resolve(null)
      }
    }
  }

  @ReactMethod
  fun startInBackground(data: ReadableMap) {
    val otplessRequest = parseOtplessRequest(data)
    otplessJob?.cancel()
    otplessJob = ioScope.launch(Dispatchers.IO) {
      OtplessSDK.startInBackground(otplessRequest, this@OtplessHeadlessRNModule::sendHeadlessEventCallback)
    }
  }

  @ReactMethod
  fun startBackgroundAuth(config: ReadableMap, promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    val authConfig = parseOtplessAuthConfig(config)
    ioScope.launch {
      val result = OtplessSDK.start(authConfig)
      promise.resolve(result)
    }
  }

  override fun onActivityResult(
    activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?
  ) {
    OtplessSDK.onActivityResult(requestCode, resultCode, data)
  }

  override fun onNewIntent(intent: Intent?) {
    intent ?: return
    ioScope.launch { OtplessSDK.onNewIntent(intent) }
  }

  @ReactMethod
  fun commitResponse(data: ReadableMap?) {
    val otplessResponse = parseOtplessResponse(data) ?: return
    OtplessSDK.commit(otplessResponse)
  }

  companion object {
    const val NAME = "OtplessHeadlessRN"
  }
}






