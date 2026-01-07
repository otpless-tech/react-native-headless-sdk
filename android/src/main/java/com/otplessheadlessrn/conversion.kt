package com.otplessheadlessrn

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.otpless.v2.android.sdk.dto.OtplessChannelType
import com.otpless.v2.android.sdk.dto.OtplessRequest
import com.otpless.v2.android.sdk.intelligence.IntelligenceInfoData
import com.otpless.v2.android.sdk.view.models.OtplessAuthConfig
import org.json.JSONObject

internal fun parseToOtplessRequest(data: ReadableMap): OtplessRequest {
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
  return otplessRequest
}

internal fun parseToOtplessAuthRequest(data: ReadableMap): OtplessAuthConfig {
  val isForeground = if (data.hasKey("isForeground")) data.getBoolean("isForeground") else true
  val tid = data.getString("tid") ?: ""
  val otp = data.getString("otp") ?: ""
  return OtplessAuthConfig(isForeground, otp, tid)
}

internal fun convertIntoIntelligenceCred(data: ReadableMap): Map<String, Any> {
  val map = mutableMapOf<String, String>()
  val keySet = data.keySetIterator()
  while (keySet.hasNextKey()) {
    val key = keySet.nextKey()
    if (data.getType(key) != ReadableType.String) continue
    val value = data.getString(key)?.takeIf { it.isNotEmpty() } ?: continue
    map[key] = value
  }
  return map
}

internal fun convertIntoWritableMap(result: Result<IntelligenceInfoData>): WritableMap {
  if (result.isSuccess) {
    val data = result.getOrNull()!!
    val gson = Gson()
    val typeToken = object: TypeToken<IntelligenceInfoData>(){}.type
    val successJson = JSONObject(gson.toJson(data, typeToken))
    return convertJsonToMap(JSONObject().also {
      it.put("status", "success")
      it.put("data", successJson)
    })
  } else {
    return convertJsonToMap(JSONObject().also {
      it.put("status", "failure")
    })
  }
}
