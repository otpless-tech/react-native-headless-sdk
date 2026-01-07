package com.otplessheadlessrn

import android.app.Activity
import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.otpless.longclaw.tc.OTScopeRequest
import com.otpless.v2.android.sdk.dto.OtplessResponse
import com.otpless.v2.android.sdk.dto.ResponseTypes
import com.otpless.v2.android.sdk.intelligence.IntelligenceInfoData
import com.otpless.v2.android.sdk.main.OtplessSDK
import com.otpless.v2.android.sdk.utils.OtplessUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONException
import org.json.JSONObject

class OtplessHeadlessRNModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  private var otplessJob: Job? = null
  private var initJob: Job? = null

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

  @Suppress("unused")
  @ReactMethod
  fun isWhatsappInstalled(promise: Promise) {
    val hasWhatsapp = OtplessUtils.isWhatsAppInstalled(reactContext)
    promise.resolve(hasWhatsapp)
  }

  @Suppress("unused")
  @ReactMethod
  fun initialize(appId: String, loginUri: String? = null) {
    initJob?.cancel()
    initJob = (currentActivity as? FragmentActivity)?.lifecycleScope?.launch(Dispatchers.IO) {
      OtplessSDK.initialize(
        appId = appId, activity = currentActivity!!, loginUri = loginUri,
        callback = this@OtplessHeadlessRNModule::sendHeadlessEventCallback
      )
    }
  }

  @Suppress("unused")
  @ReactMethod
  fun initTrueCaller(requestMap: ReadableMap, promise: Promise) {
    val request = parseTrueCallerRequest(requestMap)
    val scopes = parseTrueCallerScope(requestMap)
    val result = OtplessSDK.initTrueCaller(currentActivity!!, request) {
      OTScopeRequest.ActivityRequest(currentActivity as FragmentActivity, scopes)
    }
    debugLog("init truecaller result: $result")
    promise.resolve(result)
  }

  @Suppress("unused")
  @ReactMethod
  fun start(data: ReadableMap) {
    val otplessRequest = parseToOtplessRequest(data)
    otplessJob?.cancel()
    otplessJob = (currentActivity as? AppCompatActivity)?.lifecycleScope?.launch(Dispatchers.IO) {
      OtplessSDK.start(request = otplessRequest, this@OtplessHeadlessRNModule::sendHeadlessEventCallback)
    }
  }

  @Suppress("unused")
  @ReactMethod
  fun startAuth(data: ReadableMap, promise: Promise) {
    val authRequest = parseToOtplessAuthRequest(data)
    otplessJob?.cancel()
    (currentActivity as? AppCompatActivity)?.let {
      otplessJob = it.lifecycleScope.launch(Dispatchers.IO) {
        val result = OtplessSDK.start(authRequest)
        promise.resolve(result)
      }
    } ?: promise.resolve(false)
  }

  @Suppress("unused")
  @ReactMethod
  fun isSdkReady(promise: Promise) {
    promise.resolve(OtplessSDK.isSdkReady)
  }

  @Suppress("unused")
  @ReactMethod
  fun setResponseCallback() {
    OtplessSDK.setResponseCallback(this::sendHeadlessEventCallback)
  }

  @Suppress("unused")
  @ReactMethod
  fun cleanup() {
    otplessJob?.cancel()
    OtplessSDK.cleanup()
  }

  @Suppress("unused")
  @ReactMethod
  fun setDevLogging(devLogging: Boolean) {
    debugLog("dev logging: $devLogging")
    OtplessSDK.devLogging = devLogging
  }

  @Suppress("unused")
  @ReactMethod
  fun initIntelligence(credReadableMap: ReadableMap) {
    val cred = readableMapToKotlinMap(credReadableMap)
    OtplessSDK.initIntelligence(reactContext, cred as Map<String, String>)
    OtplessSDK.setIntelligenceCallback(this::onIntelligenceResponse)
  }

  @Suppress("unused")
  @ReactMethod
  fun fetchIntelligence() {
    OtplessSDK.fetchIntelligence()
  }

  private fun onIntelligenceResponse(result: Result<IntelligenceInfoData>) {
    val writeableMap = convertIntoWritableMap(result)
    runCatching {
      this.reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(INTELLIGENCE_RESULT_EVENT_EMITTER, writeableMap)
    }
  }

  companion object {
    const val NAME = "OtplessHeadlessRN"
    private const val INTELLIGENCE_RESULT_EVENT_EMITTER = "OTPlessIntelligenceResult"
  }

  override fun onActivityResult(
    activity: Activity?,
    requestCode: Int,
    resultCode: Int,
    data: Intent?
  ) {
    OtplessSDK.onActivityResult(requestCode, resultCode, data)
  }

  override fun onNewIntent(intent: Intent?) {
    intent ?: return
    OtplessSDK.onNewIntentAsync(intent)
  }

  @Suppress("unused")
  @ReactMethod
  fun commitResponse(data: ReadableMap?) {
    val dataMap = data?.toHashMap() ?: return
    val jsonResponse = JSONObject(dataMap)
    val otplessResponse = OtplessResponse(
      responseType = getResponseType(
        responseTypeString = jsonResponse.optString(
          "responseType",
          ""
        )
      ),
      jsonResponse.optJSONObject("response"),
      jsonResponse.optInt("statusCode", 0),
    )
    OtplessSDK.commit(otplessResponse)
  }

  private fun getResponseType(responseTypeString: String): ResponseTypes {
    return ResponseTypes.valueOf(responseTypeString)
  }
}






