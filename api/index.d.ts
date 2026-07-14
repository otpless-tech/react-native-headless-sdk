import type { OtplessTruecallerRequest, OtplessAuthEvent, OtplessProviderType } from './models';
interface OtplessResultCallback {
    (result: any): void;
}
declare class OtplessHeadlessModule {
    private eventEmitter;
    constructor();
    clearListener(): void;
    initialize(appId: String, loginUri?: string | null): void;
    setResponseCallback(callback: OtplessResultCallback): void;
    start(input: any): void;
    commitResponse(response: any): void;
    isWhatsappInstalledForAndroid(): Promise<boolean>;
    cleanup(): void;
    decimateAll(): void;
    setDevLogging(enable: boolean): void;
    isSdkReady(): Promise<boolean>;
    initTrueCaller(requestMap: OtplessTruecallerRequest): Promise<boolean>;
    userAuthEvent(event: OtplessAuthEvent, providerType: OtplessProviderType, fallback?: boolean, providerInfo?: any): void;
}
export { OtplessHeadlessModule };
export * from './models';
