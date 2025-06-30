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
  
  override func supportedEvents() -> [String]! {
    return ["OTPlessEventResult"]
  }
  
  @objc(initialize:loginUri:)
  func initialize(appId: String, loginUri: String?) {
    DispatchQueue.main.async {
      let rootViewController = UIApplication.shared.delegate?.window??.rootViewController
      if rootViewController != nil {
        Otpless.shared.initialise(withAppId: appId, vc: rootViewController!)
        return
      }
      
      // Could not get an instance of RootViewController. Try to get RootViewController from `windowScene`.
      if #available(iOS 13.0, *) {
        let windowSceneVC = self.getRootViewControllerFromWindowScene()
        if windowSceneVC != nil {
          Otpless.shared.initialise(withAppId: appId, vc: rootViewController!)
          return
        }
      }
    }
  }
  
  @objc(setResponseCallback)
  func setResponseCallback() {
    Otpless.shared.setResponseDelegate(self)
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
