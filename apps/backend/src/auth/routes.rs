use super::{core, pipeline::AuthBody};
use crate::{AppState, error::Result};
use axum::{
    extract::{OriginalUri, State},
    http::{HeaderMap, Method},
};
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};

macro_rules! auth_routes {
    ($($handler:ident $method:ident $path:literal $operation:literal $name:literal;)*) => {
        $(
            #[utoipa::path($method, path = $path, operation_id = $operation, responses((status = 200, body = serde_json::Value)))]
            async fn $handler(
                State(state): State<Arc<AppState>>,
                headers: HeaderMap,
                AuthBody(body): AuthBody,
                OriginalUri(uri): OriginalUri,
                method: Method,
            ) -> Result<core::Reply> {
                core::dispatch($name, &state, &headers, body.as_ref(), &uri, &method).await
            }
        )*
        pub fn router() -> OpenApiRouter<Arc<AppState>> {
            OpenApiRouter::new()$(.routes(routes!($handler)))*
        }
    };
}

auth_routes! {
    sign_in_social_post post "/api/auth/sign-in/social" "signInSocial" "signInSocial";
    callback_o_auth_get get "/api/auth/callback/{id}" "callbackOAuth" "callbackOAuth";
    callback_o_auth_post post "/api/auth/callback/{id}" "callbackOAuthPost" "callbackOAuth";
    get_session_get get "/api/auth/get-session" "getSession" "getSession";
    get_session_post post "/api/auth/get-session" "getSessionPost" "getSession";
    sign_out_post post "/api/auth/sign-out" "signOut" "signOut";
    sign_up_email_post post "/api/auth/sign-up/email" "signUpEmail" "signUpEmail";
    sign_in_email_post post "/api/auth/sign-in/email" "signInEmail" "signInEmail";
    reset_password_post post "/api/auth/reset-password" "resetPassword" "resetPassword";
    verify_password_post post "/api/auth/verify-password" "verifyPassword" "verifyPassword";
    send_verification_email_post post "/api/auth/send-verification-email" "sendVerificationEmail" "sendVerificationEmail";
    change_email_post post "/api/auth/change-email" "changeEmail" "changeEmail";
    change_password_post post "/api/auth/change-password" "changePassword" "changePassword";
    update_session_post post "/api/auth/update-session" "updateSession" "updateSession";
    update_user_post post "/api/auth/update-user" "updateUser" "updateUser";
    delete_user_post post "/api/auth/delete-user" "deleteUser" "deleteUser";
    request_password_reset_post post "/api/auth/request-password-reset" "requestPasswordReset" "requestPasswordReset";
    request_password_reset_callback_get get "/api/auth/reset-password/{token}" "requestPasswordResetCallback" "requestPasswordResetCallback";
    list_sessions_get get "/api/auth/list-sessions" "listSessions" "listSessions";
    revoke_session_post post "/api/auth/revoke-session" "revokeSession" "revokeSession";
    revoke_sessions_post post "/api/auth/revoke-sessions" "revokeSessions" "revokeSessions";
    revoke_other_sessions_post post "/api/auth/revoke-other-sessions" "revokeOtherSessions" "revokeOtherSessions";
    link_social_account_post post "/api/auth/link-social" "linkSocialAccount" "linkSocialAccount";
    list_user_accounts_get get "/api/auth/list-accounts" "listUserAccounts" "listUserAccounts";
    delete_user_callback_get get "/api/auth/delete-user/callback" "deleteUserCallback" "deleteUserCallback";
    unlink_account_post post "/api/auth/unlink-account" "unlinkAccount" "unlinkAccount";
    refresh_token_post post "/api/auth/refresh-token" "refreshToken" "refreshToken";
    get_access_token_post post "/api/auth/get-access-token" "getAccessToken" "getAccessToken";
    account_info_get get "/api/auth/account-info" "accountInfo" "accountInfo";
    expo_authorization_proxy_get get "/api/auth/expo-authorization-proxy" "expoAuthorizationProxy" "expoAuthorizationProxy";
    send_verification_o_t_p_post post "/api/auth/email-otp/send-verification-otp" "sendVerificationOTP" "sendVerificationOTP";
    check_verification_o_t_p_post post "/api/auth/email-otp/check-verification-otp" "checkVerificationOTP" "checkVerificationOTP";
    verify_email_o_t_p_post post "/api/auth/email-otp/verify-email" "verifyEmailOTP" "verifyEmailOTP";
    request_email_change_email_o_t_p_post post "/api/auth/email-otp/request-email-change" "requestEmailChangeEmailOTP" "requestEmailChangeEmailOTP";
    change_email_email_o_t_p_post post "/api/auth/email-otp/change-email" "changeEmailEmailOTP" "changeEmailEmailOTP";
    ok_get get "/api/auth/ok" "ok" "ok";
    error_get get "/api/auth/error" "error" "error";
}
