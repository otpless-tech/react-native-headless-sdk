
export interface OtplessTruecallerRequest {
    trueCallerRequest?: OtplessTruecallerConfig;
    scope: Array<OTScope>;
}


export interface OtplessTruecallerConfig {
  footerType?: OTFooterType;
  shape?: OTButtonShape;
  verifyOption?: OTVerifyOption;
  heading?: OTHeadingConsent;
  loginPrefixText?: OTLoginPrefixText;
  ctaText?: OTCtaText;
  locale?: string; // assuming this is a locale string like 'en-US'
  buttonColor?: number; // assuming Int maps to a numeric type (e.g. hex color)
  buttonTextColor?: number;
}

export type OTScope = "profile" | "phone" | "open_id" | "offline_access" | "email" | "address";

export type OTFooterType =
    | 'footer_type_skip'
    | 'footer_type_another_mobile_no'
    | 'footer_type_another_method'
    | 'footer_type_manually'
    | 'footer_type_later';

export type OTButtonShape =
    | 'button_shape_rounded'
    | 'button_shape_rectangle';


export type OTVerifyOption =
    | 'option_verify_only_tc_users'
    | 'option_verify_all_users';


export type OTHeadingConsent =
    | 'sdk_consent_heading_log_in_to'
    | 'sdk_consent_heading_sign_up_with'
    | 'sdk_consent_heading_sign_in_to'
    | 'sdk_consent_heading_verify_number_with'
    | 'sdk_consent_heading_register_with'
    | 'sdk_consent_heading_get_started_with'
    | 'sdk_consent_heading_proceed_with'
    | 'sdk_consent_heading_verify_with'
    | 'sdk_consent_heading_verify_profile_with'
    | 'sdk_consent_heading_verify_your_profile_with'
    | 'sdk_consent_heading_verify_phone_no_with'
    | 'sdk_consent_heading_verify_your_no_with'
    | 'sdk_consent_heading_continue_with'
    | 'sdk_consent_heading_complete_order_with'
    | 'sdk_consent_heading_place_order_with'
    | 'sdk_consent_heading_complete_booking_with'
    | 'sdk_consent_heading_checkout_with'
    | 'sdk_consent_heading_manage_details_with'
    | 'sdk_consent_heading_manage_your_details_with'
    | 'sdk_consent_heading_login_to_with_one_tap'
    | 'sdk_consent_heading_subscribe_to'
    | 'sdk_consent_heading_get_updates_from'
    | 'sdk_consent_heading_continue_reading_on'
    | 'sdk_consent_heading_get_new_updates_from'
    | 'sdk_consent_heading_login_signup_with';


export type OTLoginPrefixText =
    | 'login_text_prefix_to_get_started'
    | 'login_text_prefix_to_continue'
    | 'login_text_prefix_to_place_order'
    | 'login_text_prefix_to_complete_your_purchase'
    | 'login_text_prefix_to_checkout'
    | 'login_text_prefix_to_complete_your_booking'
    | 'login_text_prefix_to_proceed_with_your_booking'
    | 'login_text_prefix_to_continue_with_your_booking'
    | 'login_text_prefix_to_get_details'
    | 'login_text_prefix_to_view_more'
    | 'login_text_prefix_to_continue_reading'
    | 'login_text_prefix_to_proceed'
    | 'login_text_prefix_for_new_updates'
    | 'login_text_prefix_to_get_updates'
    | 'login_text_prefix_to_subscribe'
    | 'login_text_prefix_to_subscribe_and_get_updates';


export type OTCtaText =
    | 'cta_text_proceed'
    | 'cta_text_continue'
    | 'cta_text_accept'
    | 'cta_text_confirm';
