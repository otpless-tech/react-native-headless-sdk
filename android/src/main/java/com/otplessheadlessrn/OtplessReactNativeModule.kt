package com.otplessheadlessrn

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.otpless.v2.android.sdk.dto.OtplessChannelType
import com.otpless.v2.android.sdk.dto.OtplessRequest
import com.otpless.v2.android.sdk.dto.OtplessResponse
import com.otpless.v2.android.sdk.dto.ResponseTypes
import com.otpless.v2.android.sdk.main.OtplessPhoneHint
import com.otpless.v2.android.sdk.main.OtplessSDK
import com.otpless.v2.android.sdk.utils.OtplessUtils
import org.json.JSONException
import org.json.JSONObject

class OtplessHeadlessRNModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  init {
    OtplessHeadlessRNManager.registerOtplessModule(this)
    reactContext.addActivityEventListener(this)
  }

  private val phoneHintApi by lazy { OtplessPhoneHint() }

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
  fun isWhatsappInstalled(callback: Callback) {
    val hasWhatsapp = OtplessUtils.isWhatsAppInstalled(reactContext)
    val json = JSONObject().also {
      it.put("hasWhatsapp", hasWhatsapp)
    }
    callback.invoke(convertJsonToMap(json))
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
  fun start(data: ReadableMap) {
    val otplessRequest = OtplessRequest()
    val phone = data.getString("phone") ?: ""
    // phone number authentication
    if (phone.isNotEmpty()) {
      val countryCode = data.getString("countryCode") ?: ""
      otplessRequest.setPhoneNumber(number = phone, countryCode = countryCode)
      data.getString("otp")?.let {
        otplessRequest.setOtp(it)
      }
    } else {
      // email authentication
      val email = data.getString("email") ?: ""
      if (email.isNotEmpty()) {
        otplessRequest.setEmail(email)
        data.getString("otp")?.let {
          otplessRequest.setOtp(it)
        }
      } else {
        // oauth case
        otplessRequest.setChannelType(OtplessChannelType.fromString(data.getString("channelType") ?: ""))
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

    OtplessSDK.startAsync(request = otplessRequest, this::sendHeadlessEventCallback)
  }

  @ReactMethod
  fun setResponseCallback() {
    OtplessSDK.setResponseCallback(this::sendHeadlessEventCallback)
  }

  @ReactMethod
  fun cleanup() {
    OtplessSDK.cleanup()
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
      responseType = getResponseType(responseTypeString = jsonResponse.optString("responseType", "")),
      jsonResponse.optJSONObject("response"),
      jsonResponse.optInt("statusCode", 0),
    )
    OtplessSDK.commit(otplessResponse)
  }

  private fun getResponseType(responseTypeString: String) : ResponseTypes {
    return ResponseTypes.valueOf(responseTypeString)
  }
}






