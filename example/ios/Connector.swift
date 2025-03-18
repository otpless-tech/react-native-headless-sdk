//
//  Connector.swift
//  OtplessHeadlessRNExample
//
//  Created by Digvijay Singh on 06/07/23.
//

import OtplessBM
import Foundation

class Connector: NSObject {
  @objc public static func loadUrl(_ url: NSURL) {
    Task(priority: .userInitiated) {
      await Otpless.shared.handleDeeplink(url as URL)
    }

  }
  @objc public static func isOtplessDeeplink(_ url: NSURL) -> Bool {
    return Otpless.shared.isOtplessDeeplink(url: url as URL)
  }
  
  @objc public static func registerFBApp(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {
//    Otpless.shared.registerFBApp(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  @objc public static func registerFBApp(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) {
//    Otpless.shared.registerFBApp(app, open: url, options: options)
  }
  
  @available(iOS 13.0, *)
  @objc public static func registerFBApp(
    openURLContexts URLContexts: Set<UIOpenURLContext>
  ) {
//    Otpless.shared.registerFBApp(openURLContexts: URLContexts)
  }
}
