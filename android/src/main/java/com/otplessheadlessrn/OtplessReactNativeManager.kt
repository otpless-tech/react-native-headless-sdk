package com.otplessheadlessrn

import java.lang.ref.WeakReference

object OtplessHeadlessRNManager {

  private var wModule: WeakReference<OtplessHeadlessRNModule>? = null

  internal fun registerOtplessModule(otplessModule: OtplessHeadlessRNModule) {
    wModule = WeakReference(otplessModule)
  }
}
