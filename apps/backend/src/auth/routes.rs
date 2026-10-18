use super::{core, pipeline::AuthBody};
use crate::{AppState, error::Result};
use axum::{
    extract::{OriginalUri, State},
    http::{HeaderMap, Method},
};
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};

#[utoipa::path(post,path="/api/auth/sign-in/social",operation_id="signInSocial",responses((status=200,body=serde_json::Value)))]
async fn sign_in_social_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "signInSocial",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(get,path="/api/auth/callback/{id}",operation_id="callbackOAuth",responses((status=200,body=serde_json::Value)))]
async fn callback_o_auth_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "callbackOAuth",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/callback/{id}",operation_id="callbackOAuthPost",responses((status=200,body=serde_json::Value)))]
async fn callback_o_auth_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "callbackOAuth",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(get,path="/api/auth/get-session",operation_id="getSession",responses((status=200,body=serde_json::Value)))]
async fn get_session_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch("getSession", &state, &headers, body.as_ref(), &uri, &method).await
}

#[utoipa::path(post,path="/api/auth/get-session",operation_id="getSessionPost",responses((status=200,body=serde_json::Value)))]
async fn get_session_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch("getSession", &state, &headers, body.as_ref(), &uri, &method).await
}

#[utoipa::path(post,path="/api/auth/sign-out",operation_id="signOut",responses((status=200,body=serde_json::Value)))]
async fn sign_out_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch("signOut", &state, &headers, body.as_ref(), &uri, &method).await
}

#[utoipa::path(post,path="/api/auth/sign-up/email",operation_id="signUpEmail",responses((status=200,body=serde_json::Value)))]
async fn sign_up_email_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "signUpEmail",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/sign-in/email",operation_id="signInEmail",responses((status=200,body=serde_json::Value)))]
async fn sign_in_email_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "signInEmail",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/reset-password",operation_id="resetPassword",responses((status=200,body=serde_json::Value)))]
async fn reset_password_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "resetPassword",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/verify-password",operation_id="verifyPassword",responses((status=200,body=serde_json::Value)))]
async fn verify_password_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "verifyPassword",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(get,path="/api/auth/verify-email",operation_id="verifyEmail",responses((status=200,body=serde_json::Value)))]
async fn verify_email_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "verifyEmail",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/send-verification-email",operation_id="sendVerificationEmail",responses((status=200,body=serde_json::Value)))]
async fn send_verification_email_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "sendVerificationEmail",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/change-email",operation_id="changeEmail",responses((status=200,body=serde_json::Value)))]
async fn change_email_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "changeEmail",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/change-password",operation_id="changePassword",responses((status=200,body=serde_json::Value)))]
async fn change_password_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "changePassword",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/update-session",operation_id="updateSession",responses((status=200,body=serde_json::Value)))]
async fn update_session_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "updateSession",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/update-user",operation_id="updateUser",responses((status=200,body=serde_json::Value)))]
async fn update_user_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch("updateUser", &state, &headers, body.as_ref(), &uri, &method).await
}

#[utoipa::path(post,path="/api/auth/delete-user",operation_id="deleteUser",responses((status=200,body=serde_json::Value)))]
async fn delete_user_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch("deleteUser", &state, &headers, body.as_ref(), &uri, &method).await
}

#[utoipa::path(post,path="/api/auth/request-password-reset",operation_id="requestPasswordReset",responses((status=200,body=serde_json::Value)))]
async fn request_password_reset_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "requestPasswordReset",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(get,path="/api/auth/reset-password/{token}",operation_id="requestPasswordResetCallback",responses((status=200,body=serde_json::Value)))]
async fn request_password_reset_callback_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "requestPasswordResetCallback",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(get,path="/api/auth/list-sessions",operation_id="listSessions",responses((status=200,body=serde_json::Value)))]
async fn list_sessions_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "listSessions",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/revoke-session",operation_id="revokeSession",responses((status=200,body=serde_json::Value)))]
async fn revoke_session_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "revokeSession",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/revoke-sessions",operation_id="revokeSessions",responses((status=200,body=serde_json::Value)))]
async fn revoke_sessions_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "revokeSessions",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/revoke-other-sessions",operation_id="revokeOtherSessions",responses((status=200,body=serde_json::Value)))]
async fn revoke_other_sessions_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "revokeOtherSessions",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/link-social",operation_id="linkSocialAccount",responses((status=200,body=serde_json::Value)))]
async fn link_social_account_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "linkSocialAccount",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(get,path="/api/auth/list-accounts",operation_id="listUserAccounts",responses((status=200,body=serde_json::Value)))]
async fn list_user_accounts_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "listUserAccounts",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(get,path="/api/auth/delete-user/callback",operation_id="deleteUserCallback",responses((status=200,body=serde_json::Value)))]
async fn delete_user_callback_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "deleteUserCallback",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/unlink-account",operation_id="unlinkAccount",responses((status=200,body=serde_json::Value)))]
async fn unlink_account_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "unlinkAccount",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/refresh-token",operation_id="refreshToken",responses((status=200,body=serde_json::Value)))]
async fn refresh_token_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "refreshToken",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/get-access-token",operation_id="getAccessToken",responses((status=200,body=serde_json::Value)))]
async fn get_access_token_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "getAccessToken",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(get,path="/api/auth/account-info",operation_id="accountInfo",responses((status=200,body=serde_json::Value)))]
async fn account_info_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "accountInfo",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(get,path="/api/auth/expo-authorization-proxy",operation_id="expoAuthorizationProxy",responses((status=200,body=serde_json::Value)))]
async fn expo_authorization_proxy_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "expoAuthorizationProxy",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/email-otp/send-verification-otp",operation_id="sendVerificationOTP",responses((status=200,body=serde_json::Value)))]
async fn send_verification_o_t_p_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "sendVerificationOTP",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/email-otp/check-verification-otp",operation_id="checkVerificationOTP",responses((status=200,body=serde_json::Value)))]
async fn check_verification_o_t_p_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "checkVerificationOTP",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/email-otp/verify-email",operation_id="verifyEmailOTP",responses((status=200,body=serde_json::Value)))]
async fn verify_email_o_t_p_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "verifyEmailOTP",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/sign-in/email-otp",operation_id="signInEmailOTP",responses((status=200,body=serde_json::Value)))]
async fn sign_in_email_o_t_p_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "signInEmailOTP",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/email-otp/request-password-reset",operation_id="requestPasswordResetEmailOTP",responses((status=200,body=serde_json::Value)))]
async fn request_password_reset_email_o_t_p_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "requestPasswordResetEmailOTP",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/forget-password/email-otp",operation_id="forgetPasswordEmailOTP",responses((status=200,body=serde_json::Value)))]
async fn forget_password_email_o_t_p_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "forgetPasswordEmailOTP",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/email-otp/reset-password",operation_id="resetPasswordEmailOTP",responses((status=200,body=serde_json::Value)))]
async fn reset_password_email_o_t_p_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "resetPasswordEmailOTP",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/email-otp/request-email-change",operation_id="requestEmailChangeEmailOTP",responses((status=200,body=serde_json::Value)))]
async fn request_email_change_email_o_t_p_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "requestEmailChangeEmailOTP",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(post,path="/api/auth/email-otp/change-email",operation_id="changeEmailEmailOTP",responses((status=200,body=serde_json::Value)))]
async fn change_email_email_o_t_p_post(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch(
        "changeEmailEmailOTP",
        &state,
        &headers,
        body.as_ref(),
        &uri,
        &method,
    )
    .await
}

#[utoipa::path(get,path="/api/auth/ok",operation_id="ok",responses((status=200,body=serde_json::Value)))]
async fn ok_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch("ok", &state, &headers, body.as_ref(), &uri, &method).await
}

#[utoipa::path(get,path="/api/auth/error",operation_id="error",responses((status=200,body=serde_json::Value)))]
async fn error_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    AuthBody(body): AuthBody,
    OriginalUri(uri): OriginalUri,
    method: Method,
) -> Result<core::Reply> {
    core::dispatch("error", &state, &headers, body.as_ref(), &uri, &method).await
}

pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(sign_in_social_post))
        .routes(routes!(callback_o_auth_get))
        .routes(routes!(callback_o_auth_post))
        .routes(routes!(get_session_get))
        .routes(routes!(get_session_post))
        .routes(routes!(sign_out_post))
        .routes(routes!(sign_up_email_post))
        .routes(routes!(sign_in_email_post))
        .routes(routes!(reset_password_post))
        .routes(routes!(verify_password_post))
        .routes(routes!(verify_email_get))
        .routes(routes!(send_verification_email_post))
        .routes(routes!(change_email_post))
        .routes(routes!(change_password_post))
        .routes(routes!(update_session_post))
        .routes(routes!(update_user_post))
        .routes(routes!(delete_user_post))
        .routes(routes!(request_password_reset_post))
        .routes(routes!(request_password_reset_callback_get))
        .routes(routes!(list_sessions_get))
        .routes(routes!(revoke_session_post))
        .routes(routes!(revoke_sessions_post))
        .routes(routes!(revoke_other_sessions_post))
        .routes(routes!(link_social_account_post))
        .routes(routes!(list_user_accounts_get))
        .routes(routes!(delete_user_callback_get))
        .routes(routes!(unlink_account_post))
        .routes(routes!(refresh_token_post))
        .routes(routes!(get_access_token_post))
        .routes(routes!(account_info_get))
        .routes(routes!(expo_authorization_proxy_get))
        .routes(routes!(send_verification_o_t_p_post))
        .routes(routes!(check_verification_o_t_p_post))
        .routes(routes!(verify_email_o_t_p_post))
        .routes(routes!(sign_in_email_o_t_p_post))
        .routes(routes!(request_password_reset_email_o_t_p_post))
        .routes(routes!(forget_password_email_o_t_p_post))
        .routes(routes!(reset_password_email_o_t_p_post))
        .routes(routes!(request_email_change_email_o_t_p_post))
        .routes(routes!(change_email_email_o_t_p_post))
        .routes(routes!(ok_get))
        .routes(routes!(error_get))
}
