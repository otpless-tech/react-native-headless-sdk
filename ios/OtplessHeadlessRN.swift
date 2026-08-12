import OtplessBM


@objc(OtplessHeadlessRN)
class OtplessHeadlessRN: RCTEventEmitter, OtplessResponseDelegate {
  private var currentTask: Task<Void, Never>?
  
  func onResponse(_ response: OtplessBM.OtplessResponse) {
    onOtplessResponse(response: response)
  }
  
  @objc(commitResponse:)
  func commitResponse(response: [String: Any]?) {
    guard let response = response else {
      return
    }
    let responseType = response["responseType"] as? String ?? "FAILED"
    let statusCode = response["statusCode"] as? Int ?? -25000
    let responseDict = response["response"] as? [String: Any]
    let otplessResponse = OtplessResponse(responseType: ResponseTypes(rawValue: responseType) ?? .FAILED, response: responseDict, statusCode: statusCode)
    Otpless.shared.commitOtplessResponse(otplessResponse)
  }
  
  func onOtplessResponse(response: OtplessResponse?) {
    if response == nil {
      return
    }
    var params = [String: Any]()
    params["response"] = response!.response
    params["statusCode"] = response!.statusCode
    params["responseType"] = response!.responseType.rawValue
    sendEvent(withName: "OTPlessEventResult", body: params)
  }
  
  private func createOtplessRequest(args: [String: Any]) -> OtplessRequest {
    let otplessRequest = OtplessRequest()
    if let phone = args["phone"] as? String,
       let countryCode = args["countryCode"] as? String {
      otplessRequest.set(phoneNumber: phone, withCountryCode: countryCode)
    } else if let email = args["email"] as? String {
      otplessRequest.set(email: email)
    } else if let channelType = args["channelType"] as? String {
      otplessRequest.set(channelType: OtplessChannelType.fromString(channelType))
    } else if let requestId = args["requestId"] as? String, !requestId.isEmpty {
      otplessRequest.set(fromBackend: requestId)
    }
    if let otp = args["otp"] as? String {
      otplessRequest.set(otp: otp)
    }
    if let deliveryChannel = args["deliveryChannel"] as? String,
       !deliveryChannel.isEmpty {
      otplessRequest.set(deliveryChannelForTransaction: deliveryChannel)
    }
    if let otpExpiry = args["expiry"] as? String,
       !otpExpiry.isEmpty {
      otplessRequest.set(otpExpiry: otpExpiry)
    }
    if let otpLength = args["otpLength"] as? String,
       !otpLength.isEmpty {
      otplessRequest.set(otpLength: otpLength)
    }

    if let tid = args["tid"] as? String,
       !tid.isEmpty {
      otplessRequest.set(tid: tid)
    }

    return otplessRequest
  }
  
  @objc(authorizeViaPasskey:)
  func authorizeViaPasskey(request: [String: Any]) {
    let requestId = request["requestId"] as? String ?? ""
    let request = OtplessRequest()
    request.set(requestIdForWebAuthn: requestId)
      if let windowScene = getWindowScene() {
        Task(priority: .userInitiated) {
          await Otpless.shared.authorizeViaPasskey(withRequest: request, windowScene: windowScene)
        }
      }
  }
  
  @objc(setDevLogging:)
  func setDevLogging(enable: Bool) {
    if enable {
      Otpless.shared.setLoggerDelegate(self)
    }
  }

  @objc(setMfaEnabled:)
  func setMfaEnabled(enabled: Bool) {
    Otpless.shared.setMfaEnabled(enabled)
  }

  private func fingerprintModeFromString(_ name: String) -> DeviceFingerprintMode? {
    switch name {
    case "NONE":  return .NONE
    case "ASYNC": return .ASYNC
    case "SYNC":  return .SYNC
    default:      return nil
    }
  }

  @objc(startBackgroundAuth:resolver:rejecter:)
  func startBackgroundAuth(config: [String: Any], resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let isForeground = (config["isForeground"] as? Bool) ?? true
    let otp = config["otp"] as? String
    let tid = config["tid"] as? String
    if let modeString = config["deviceFingerprintMode"] as? String,
       let mode = fingerprintModeFromString(modeString.uppercased()) {
      Otpless.shared.setDeviceFingerprintMode(mode)
    }
    let authConfig = OtplessAuthCofig(isForeground: isForeground, otp: otp, tid: tid)
    DispatchQueue.main.async {
      let rvc = UIApplication.shared.delegate?.window??.rootViewController
        ?? self.getRootViewControllerFromWindowScene()
      guard let vc = rvc else {
        resolve(false)
        return
      }
      Task(priority: .userInitiated) {
        let result = await Otpless.shared.startAuth(parent: vc, config: authConfig)
        resolve(result)
      }
    }
  }
  
  private func authEventFromString(_ name: String) -> AuthEvent? {
    switch name {
    case "AUTH_INITIATED": return .AUTH_INITIATED
    case "AUTH_SUCCESS":   return .AUTH_SUCCESS
    case "AUTH_FAILED":    return .AUTH_FAILED
    default:               return nil
    }
  }

  private func providerTypeFromString(_ name: String) -> ProviderType? {
    switch name {
    case "CLIENT":  return .CLIENT
    case "OTPLESS": return .OTPLESS
    default:        return nil
    }
  }

  @objc(userAuthEvent:fallback:providerType:providerInfo:)
  func userAuthEvent(event: String, fallback: Bool, providerType: String, providerInfo: [String: Any]?) {
    guard let authEvent = authEventFromString(event) else { return }
    guard let provider = providerTypeFromString(providerType) else { return }
    var info: [String: String] = [:]
    if let raw = providerInfo {
      for (key, value) in raw {
        if let s = value as? String {
          info[key] = s
        } else if let n = value as? NSNumber {
          info[key] = n.stringValue
        } else if let arr = value as? [Any],
                  let data = try? JSONSerialization.data(withJSONObject: arr),
                  let s = String(data: data, encoding: .utf8) {
          info[key] = s
        } else if let dict = value as? [String: Any],
                  let data = try? JSONSerialization.data(withJSONObject: dict),
                  let s = String(data: data, encoding: .utf8) {
          info[key] = s
        }
      }
    }
    Otpless.shared.userAuthEvent(event: authEvent, fallback: fallback, providerType: provider, providerInfo: info)
  }

  override func supportedEvents() -> [String]! {
    return ["OTPlessEventResult"]
  }
  
  @objc(isSdkReady:reject:)
  func isSdkReady(resolve:RCTPromiseResolveBlock, reject:RCTPromiseRejectBlock) {
    resolve(Otpless.shared.isSdkReady())
  }
  
  @objc(initialize:loginUri:)
  func initialize(appId: String, loginUri: String?) {
    DispatchQueue.main.async {
      let rootViewController = UIApplication.shared.delegate?.window??.rootViewController
      if let rvc = rootViewController {
        Otpless.shared.setResponseDelegate(self)
        Otpless.shared.initialise(withAppId: appId, loginUri: loginUri, vc: rvc)
        return
      }

      if #available(iOS 13.0, *) {
        if let windowSceneVC = self.getRootViewControllerFromWindowScene() {
          Otpless.shared.setResponseDelegate(self)
          Otpless.shared.initialise(withAppId: appId, loginUri: loginUri, vc: windowSceneVC)
        }
      }
    }
  }
  
  @objc(start:)
  func start(request: [String: Any]) {
      let otplessRequest = createOtplessRequest(args: request)

      let isOtpVerification = (request["otp"] as? String)?.isEmpty == false

      if !isOtpVerification {
          // Cancel the existing task if it's not an OTP verification request
          currentTask?.cancel()
      }

      let newTask = Task(priority: .userInitiated) {
          await Otpless.shared.start(withRequest: otplessRequest)
      }

      if !isOtpVerification {
          currentTask = newTask
      }
  }
  
  @objc(cleanup)
  func cleanup() {
    Otpless.shared.cleanup()
    currentTask?.cancel()
    currentTask = nil
  }

  @objc(decimateAll)
  func decimateAll() {
    Otpless.shared.clearAll()
  }
  
  @MainActor @available(iOS 13.0, *)
  private func getRootViewControllerFromWindowScene() -> UIViewController? {
    guard let windowScene = UIApplication.shared.connectedScenes
      .filter({ $0.activationState == .foregroundActive })
      .first as? UIWindowScene else {
      return nil
    }
    
    if #available(iOS 15.0, *) {
      let keyWindowVC = windowScene.windows.first?.windowScene?.keyWindow?.rootViewController
      if keyWindowVC != nil {
        return keyWindowVC
      }
    }
    
    return windowScene.windows.first?.rootViewController
  }
  
  @MainActor @available(iOS 13.0, *)
  private func getWindowScene() -> UIWindowScene? {
    guard let windowScene = UIApplication.shared.connectedScenes
      .filter({ $0.activationState == .foregroundActive })
      .first as? UIWindowScene else {
      return nil
    }
    return windowScene
  }
}

extension OtplessHeadlessRN: OtplessLoggerDelegate {
  func log(message: String, type: OtplessBM.LogType) {
    print("OtplessHeadlessRN: \(type)\n \(message)")
  }

}
