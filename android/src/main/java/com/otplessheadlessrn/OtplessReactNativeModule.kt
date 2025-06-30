package com.otplessheadlessrn

import android.app.Activity
import android.content.Context
import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.otpless.longclaw.tc.OTScopeRequest
import com.otpless.v2.android.sdk.dto.OtplessChannelType
import com.otpless.v2.android.sdk.dto.OtplessRequest
import com.otpless.v2.android.sdk.dto.OtplessResponse
import com.otpless.v2.android.sdk.dto.ResponseTypes
import com.otpless.v2.android.sdk.main.OtplessSDK
import com.otpless.v2.android.sdk.utils.OtplessUtils
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONException
import org.json.JSONObject

class OtplessHeadlessRNModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  private var otplessJob: Job? = null

  init {
    OtplessHeadlessRNManager.registerOtplessModule(this)
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
    currentActivity?.let {
      OtplessSDK.initialize(
        appId = appId,
        activity = it,
        loginUri = loginUri
      )
    }
  }

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

  @ReactMethod
  fun start(data: ReadableMap) {
    val otplessRequest = OtplessRequest()
    val phone = data.getString("phone") ?: ""
    var isOtpPresent = false

    // phone number authentication
    if (phone.isNotEmpty()) {
      val countryCode = data.getString("countryCode") ?: ""
      otplessRequest.setPhoneNumber(number = phone, countryCode = countryCode)
      data.getString("otp")?.let {
        otplessRequest.setOtp(it)
        isOtpPresent = true
      }
    } else {
      // email authentication
      val email = data.getString("email") ?: ""
      if (email.isNotEmpty()) {
        otplessRequest.setEmail(email)
        data.getString("otp")?.let {
          otplessRequest.setOtp(it)
          isOtpPresent = true
        }
      } else {
        // oauth case
        otplessRequest.setChannelType(
          OtplessChannelType.fromString(
            data.getString("channelType") ?: ""
          )
        )
      }
    }
    data.getString("expiry")?.takeIf { it.isNotBlank() }?.let {
      otplessRequest.setExpiry(it)
    }

    data.getString("otpLength")?.takeIf { it.isNotBlank() }?.let {
      otplessRequest.setOtpLength(it)
    }

    data.getString("deliveryChannel")?.takeIf { it.isNotBlank() }?.let { deliveryChannel ->
      otplessRequest.setDeliveryChannel(deliveryChannel.uppercase())
    }

    data.getString("tid")?.takeIf { it.isNotBlank() }?.let { templateId ->
      otplessRequest.setTemplateId(templateId)
    }

    if (isOtpPresent) {
        OtplessSDK.startAsync(request = otplessRequest, this@OtplessHeadlessRNModule::sendHeadlessEventCallback)
    } else {
      otplessJob?.cancel()
      currentActivity?.let {
        otplessJob = (it as AppCompatActivity).lifecycleScope.launch {
          OtplessSDK.start(request = otplessRequest, this@OtplessHeadlessRNModule::sendHeadlessEventCallback)
        }
      } ?: run {
        OtplessSDK.startAsync(request = otplessRequest, this@OtplessHeadlessRNModule::sendHeadlessEventCallback)
      }
    }
  }

  @ReactMethod
  fun setResponseCallback() {
    OtplessSDK.setResponseCallback(this::sendHeadlessEventCallback)
  }

  @ReactMethod
  fun cleanup() {
    otplessJob?.cancel()
    OtplessSDK.cleanup()
  }

  @ReactMethod
  fun setDevLogging(devLogging: Boolean) {
    debugLog("dev logging: $devLogging")
    OtplessSDK.devLogging = devLogging
  }

  companion object {
    const val NAME = "OtplessHeadlessRN"
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






