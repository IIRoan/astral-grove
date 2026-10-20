use super::{cookies, email, error, otp, password, pipeline, service};
use crate::{
    AppState, db,
    error::{AppError, Result},
};
use axum::{
    Json,
    http::{HeaderMap, Method, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use sea_orm::TransactionTrait;
use serde_json::{Value, json};

pub struct Reply {
    pub status: StatusCode,
    pub headers: HeaderMap,
    pub body: Value,
    pub text: Option<String>,
}
impl Reply {
    pub fn json(body: Value) -> Self {
        Self {
            status: StatusCode::OK,
            headers: HeaderMap::new(),
            body,
            text: None,
        }
    }
    pub fn redirect(target: &str) -> Result<Self> {
        let mut reply = Self::json(Value::Null);
        reply.status = StatusCode::FOUND;
        reply.text = Some(String::new());
        reply.headers.insert(
            "location",
            target.parse().map_err(|_| AppError::internal())?,
        );
        Ok(reply)
    }
    pub fn html(text: String) -> Self {
        let mut reply = Self::json(Value::Null);
        reply.text = Some(text);
        reply.headers.insert(
            "content-type",
            axum::http::HeaderValue::from_static("text/html; charset=utf-8"),
        );
        reply
    }
}
impl IntoResponse for Reply {
    fn into_response(self) -> Response {
        if let Some(text) = self.text {
            (self.status, self.headers, text).into_response()
        } else {
            (self.status, self.headers, Json(self.body)).into_response()
        }
    }
}
fn field<'a>(value: &'a Value, name: &str) -> &'a str {
    value[name].as_str().unwrap_or("")
}
// Anonymous resends hide issuance limits because only existing unverified accounts reach them.
fn quiet_limit<T>(result: Result<T>) -> Result<()> {
    match result {
        Err(err) if err.status != StatusCode::TOO_MANY_REQUESTS => Err(err),
        _ => Ok(()),
    }
}
fn success() -> Value {
    json!({"status":true})
}
fn with_query(target: &str, name: &str, value: &str, state: &AppState) -> Result<String> {
    let mut parsed = url::Url::parse(target)
        .or_else(|_| state.config.auth_url.join(target))
        .map_err(|_| error(400, "INVALID_CALLBACK_URL", "Invalid callbackURL"))?;
    parsed.query_pairs_mut().append_pair(name, value);
    Ok(parsed.into())
}
fn cleared(state: &AppState) -> Result<HeaderMap> {
    let mut headers = HeaderMap::new();
    for kind in ["session_token", "session_data", "dont_remember"] {
        let cookie = cookies::cookie_kind(&state.config, kind, "", Some(0));
        headers.append(
            "set-cookie",
            cookie.parse().map_err(|_| AppError::internal())?,
        );
    }
    Ok(headers)
}
async fn token_reply(
    state: &AppState,
    user: astral_grove_api_types::auth::User,
    headers: &HeaderMap,
    remember: bool,
    signup: bool,
    callback: Option<&str>,
    verified_hash: Option<&str>,
) -> Result<Reply> {
    let token = if let Some(hash) = verified_hash {
        service::password_session(state, &user.id, hash, headers, remember).await?
    } else {
        service::create_session(state, &user.id, headers, remember).await?
    };
    let mut body = json!({"token":token,"user":user});
    if !signup {
        body["redirect"] = json!(callback.is_some());
        if let Some(callback) = callback {
            body["url"] = json!(callback)
        }
    }
    let mut reply = Reply::json(body);
    reply.headers = service::signed_headers(state, &token, remember)?;
    if let Some(callback) = callback.filter(|_| !signup) {
        reply.headers.insert(
            "location",
            callback.parse().map_err(|_| AppError::internal())?,
        );
    }
    Ok(reply)
}
pub async fn set_password(
    state: &AppState,
    user_id: &str,
    plain: &str,
    revoke: bool,
    current: Option<(&str, &str, &HeaderMap)>,
) -> Result<Option<String>> {
    let hash = password::hash(plain)
        .await
        .map_err(|_| AppError::internal())?;
    let tx = state.db.begin().await?;
    otp::lock(&tx, &format!("credential:{user_id}")).await?;
    // A change verified against an old hash or a revoked session must not override a concurrent reset.
    if let Some((verified, token, _)) = current
        && db::rows(&tx,"SELECT 1 FROM account a JOIN session s ON s.user_id=a.user_id WHERE a.user_id=$1 AND a.provider_id='credential' AND a.password=$2 AND s.token=$3 AND s.expires_at>now()",vec![user_id.into(),verified.into(),token.into()]).await?.is_empty()
    {
        return Err(error(400, "INVALID_PASSWORD", "Invalid password"));
    }
    let rows = db::rows(
        &tx,
        "SELECT id FROM account WHERE user_id=$1 AND provider_id='credential'",
        vec![user_id.into()],
    )
    .await?;
    if rows.is_empty() {
        db::execute(&tx,"INSERT INTO account(id,user_id,account_id,provider_id,password) VALUES($1,$2,$2,'credential',$3)",vec![service::id().into(),user_id.into(),hash.into()]).await?;
    } else {
        db::execute(&tx,"UPDATE account SET password=$2,updated_at=date_trunc('milliseconds',now()) WHERE user_id=$1 AND provider_id='credential'",vec![user_id.into(),hash.into()]).await?;
    }
    let mut renewed = None;
    if revoke {
        db::execute(
            &tx,
            "DELETE FROM session WHERE user_id=$1",
            vec![user_id.into()],
        )
        .await?;
        if let Some((_, _, headers)) = current {
            renewed = Some(service::create_session_on(&tx, user_id, headers, true).await?);
        }
    }
    tx.commit().await?;
    Ok(renewed)
}
async fn verify_password(
    state: &AppState,
    user_id: &str,
    plain: &str,
    required: bool,
) -> Result<String> {
    let accounts = db::rows(
        &state.db,
        "SELECT password FROM account WHERE user_id=$1 AND provider_id='credential'",
        vec![user_id.into()],
    )
    .await?;
    let hash = accounts.first().and_then(|r| r["password"].as_str());
    if required && hash.is_none() {
        return Err(error(
            400,
            "CREDENTIAL_ACCOUNT_NOT_FOUND",
            "Credential account not found",
        ));
    }
    if !password::verify(hash.unwrap_or(""), plain)
        .await
        .map_err(|_| AppError::internal())?
    {
        return Err(error(400, "INVALID_PASSWORD", "Invalid password"));
    }
    Ok(hash.unwrap_or("").to_owned())
}
pub async fn dispatch(
    name: &str,
    state: &AppState,
    headers: &HeaderMap,
    body: Option<&Value>,
    uri: &Uri,
    method: &Method,
) -> Result<Reply> {
    let mut query = crate::http::query(uri.query());
    // Better Auth uses coerce.boolean for these query parameters.
    if name == "getSession" {
        for key in ["disableCookieCache", "disableRefresh"] {
            if let Some(value) = query.get_mut(key) {
                *value = json!(pipeline::truthy(value));
            }
        }
    }
    let optional = ["signOut", "callbackOAuth"].contains(&name);
    let default = json!({});
    let input = body.unwrap_or(&default);
    pipeline::validate(name, if optional { Some(input) } else { body }, &query)?;
    let result = match name {
        "signUpEmail" => {
            pipeline::form_csrf(state, headers)?;
            let (user, created) = service::sign_up(
                state,
                field(input, "name"),
                field(input, "email"),
                field(input, "password"),
                input["image"].as_str(),
            )
            .await?;
            if state.config.email_enabled() {
                if created {
                    otp::send(state, &user.email, "email-verification").await?;
                }
                Reply::json(json!({"token":null,"user":user}))
            } else {
                token_reply(
                    state,
                    user,
                    headers,
                    input["rememberMe"] != false,
                    true,
                    None,
                    None,
                )
                .await?
            }
        }
        "signInEmail" => {
            pipeline::form_csrf(state, headers)?;
            let (user, hash) = match service::sign_in(
                state,
                field(input, "email"),
                field(input, "password"),
            )
            .await
            {
                Ok(user) => user,
                Err(err) => {
                    if err.body["code"] == "EMAIL_NOT_VERIFIED" {
                        quiet_limit(
                            otp::send(state, field(input, "email"), "email-verification").await,
                        )?;
                    }
                    return Err(err);
                }
            };
            token_reply(
                state,
                user,
                headers,
                input["rememberMe"] != false,
                false,
                input["callbackURL"].as_str(),
                Some(&hash),
            )
            .await?
        }
        "getSession" => {
            if method == Method::POST {
                return Err(error(
                    405,
                    "METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED",
                    "POST method requires deferSessionRefresh to be enabled in session config",
                ));
            }
            let (session, renewed) =
                service::session_with_refresh(state, headers, query["disableRefresh"] != true)
                    .await?;
            let mut response_headers = HeaderMap::new();
            response_headers.insert(
                "cache-control",
                axum::http::HeaderValue::from_static("no-store"),
            );
            response_headers.insert("pragma", axum::http::HeaderValue::from_static("no-cache"));
            if let Some(current) = &session {
                if renewed {
                    response_headers.extend(service::signed_headers(
                        state,
                        &current.session.token,
                        true,
                    )?);
                }
            } else if let Some(token) = cookies::token(&state.config, headers) {
                db::execute(
                    &state.db,
                    "DELETE FROM session WHERE token=$1 AND expires_at<=now()",
                    vec![token.into()],
                )
                .await?;
                for (key, value) in cleared(state)? {
                    if let Some(key) = key {
                        response_headers.append(key, value);
                    }
                }
            }
            let mut reply = Reply::json(serde_json::to_value(session)?);
            reply.headers = response_headers;
            reply
        }
        "signOut" => {
            service::sign_out(state, headers).await?;
            let mut reply = Reply::json(json!({"success":true}));
            reply.headers = cleared(state)?;
            reply
        }
        "sendVerificationOTP" => {
            pipeline::form_csrf(state, headers)?;
            Reply::json(otp::send(state, field(input, "email"), field(input, "type")).await?)
        }
        "checkVerificationOTP" => {
            otp::public_kind(field(input, "type"))?;
            let email = otp::validate_email(field(input, "email"))?;
            otp::check(
                state,
                &format!("{}-otp-{email}", field(input, "type")),
                field(input, "otp"),
                false,
                None,
            )
            .await?;
            if service::find_user(state, &email).await?.is_none() {
                return Err(error(400, "USER_NOT_FOUND", "User not found"));
            }
            Reply::json(json!({"success":true}))
        }
        "verifyEmailOTP" => {
            otp::verify_email(state, field(input, "email"), field(input, "otp"), headers).await?
        }
        "requestEmailChangeEmailOTP" | "changeEmailEmailOTP" => {
            otp::change(state, input, headers, name == "requestEmailChangeEmailOTP").await?
        }
        "verifyPassword" => {
            let session = service::require_session(state, headers).await?;
            verify_password(state, &session.user.id, field(input, "password"), false).await?;
            Reply::json(success())
        }
        "changePassword" => {
            let session = service::require_session(state, headers).await?;
            service::check_password(field(input, "newPassword"))?;
            if field(input, "currentPassword").encode_utf16().count() > 128 {
                return Err(error(400, "PASSWORD_TOO_LONG", "Password too long"));
            }
            let verified = verify_password(
                state,
                &session.user.id,
                field(input, "currentPassword"),
                true,
            )
            .await?;
            let renewed = set_password(
                state,
                &session.user.id,
                field(input, "newPassword"),
                input["revokeOtherSessions"] == true,
                Some((&verified, &session.session.token, headers)),
            )
            .await?;
            let mut reply = Reply::json(json!({"token":null,"user":session.user}));
            if let Some(token) = renewed {
                reply.headers = service::signed_headers(state, &token, true)?;
                reply.body["token"] = json!(token)
            }
            reply
        }
        "updateSession" => {
            service::require_session(state, headers).await?;
            return Err(pipeline::message(400, "No fields to update"));
        }
        "updateUser" => {
            let session = service::require_session(state, headers).await?;
            if input.get("email").is_some_and(pipeline::truthy) {
                return Err(error(
                    400,
                    "EMAIL_CAN_NOT_BE_UPDATED",
                    "Email can not be updated",
                ));
            }
            let Some(object) = input.as_object() else {
                return Err(error(
                    400,
                    "BODY_MUST_BE_AN_OBJECT",
                    "Body must be an object",
                ));
            };
            if !object.contains_key("name") && !object.contains_key("image") {
                return Err(pipeline::message(400, "No fields to update"));
            }
            let name = object.get("name").and_then(Value::as_str);
            let image = object.get("image");
            if object.get("name").is_some_and(|v| !v.is_string())
                || image.is_some_and(|v| !v.is_string() && !v.is_null())
            {
                return Err(error(400, "VALIDATION_ERROR", "Invalid user fields"));
            }
            db::execute(&state.db,"UPDATE \"user\" SET name=CASE WHEN $2 THEN $3 ELSE name END,image=CASE WHEN $4 THEN $5 ELSE image END,updated_at=date_trunc('milliseconds',now()) WHERE id=$1",vec![session.user.id.into(),name.is_some().into(),name.map(str::to_owned).into(),image.is_some().into(),image.and_then(Value::as_str).map(str::to_owned).into()]).await?;
            let mut reply = Reply::json(success());
            reply.headers = service::signed_headers(state, &session.session.token, true)?;
            reply
        }
        "listSessions" => {
            let session = service::require_fresh(state, headers).await?;
            let rows=db::rows(&state.db,"SELECT id,user_id AS \"userId\",token,to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"expiresAt\",to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"createdAt\",to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"updatedAt\",ip_address AS \"ipAddress\",user_agent AS \"userAgent\" FROM session WHERE user_id=$1 AND expires_at>now()",vec![session.user.id.into()]).await?;
            Reply::json(json!(rows))
        }
        "revokeSession" | "revokeSessions" | "revokeOtherSessions" => {
            let session = service::require_session(state, headers).await?;
            if name == "revokeSession" {
                db::execute(
                    &state.db,
                    "DELETE FROM session WHERE user_id=$1 AND token=$2",
                    vec![session.user.id.into(), field(input, "token").into()],
                )
                .await?;
            } else if name == "revokeOtherSessions" {
                db::execute(
                    &state.db,
                    "DELETE FROM session WHERE user_id=$1 AND token<>$2",
                    vec![session.user.id.into(), session.session.token.into()],
                )
                .await?;
            } else {
                db::execute(
                    &state.db,
                    "DELETE FROM session WHERE user_id=$1",
                    vec![session.user.id.into()],
                )
                .await?;
            }
            Reply::json(success())
        }
        "listUserAccounts" => {
            let session = service::require_session(state, headers).await?;
            let accounts=db::rows(&state.db,"SELECT id,account_id AS \"accountId\",provider_id AS \"providerId\",user_id AS \"userId\",to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"createdAt\",to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"updatedAt\",scope FROM account WHERE user_id=$1",vec![session.user.id.into()]).await?;
            let accounts = accounts
                .into_iter()
                .map(|mut account| {
                    let scopes = field(&account, "scope")
                        .split(',')
                        .map(str::trim)
                        .filter(|v| !v.is_empty())
                        .map(str::to_owned)
                        .collect::<Vec<_>>();
                    account
                        .as_object_mut()
                        .ok_or_else(AppError::internal)?
                        .remove("scope");
                    account["scopes"] = json!(scopes);
                    Ok(account)
                })
                .collect::<Result<Vec<_>>>()?;
            Reply::json(json!(accounts))
        }
        "unlinkAccount" => {
            let session = service::require_fresh(state, headers).await?;
            let tx = state.db.begin().await?;
            otp::lock(&tx, &format!("credential:{}", session.user.id)).await?;
            let accounts = db::rows(
                &tx,
                "SELECT id FROM account WHERE user_id=$1",
                vec![session.user.id.clone().into()],
            )
            .await?;
            if accounts.len() == 1 {
                return Err(error(
                    400,
                    "FAILED_TO_UNLINK_LAST_ACCOUNT",
                    "You can't unlink your last account",
                ));
            }
            if !accounts.iter().any(|r| r["id"] == input["accountId"]) {
                return Err(error(400, "ACCOUNT_NOT_FOUND", "Account not found"));
            }
            db::execute(
                &tx,
                "DELETE FROM account WHERE user_id=$1 AND id=$2",
                vec![session.user.id.into(), field(input, "accountId").into()],
            )
            .await?;
            tx.commit().await?;
            Reply::json(success())
        }
        "getAccessToken" | "refreshToken" | "accountInfo" => {
            let Some(session) = service::get_session(state, headers).await? else {
                let mut reply = Reply::json(Value::Null);
                reply.status = StatusCode::UNAUTHORIZED;
                reply.text = Some(String::new());
                return Ok(reply);
            };
            let selection = if name == "accountInfo" { &query } else { input };
            let accounts = db::rows(
                &state.db,
                "SELECT provider_id FROM account WHERE user_id=$1 AND id=$2",
                vec![session.user.id.into(), field(selection, "accountId").into()],
            )
            .await?;
            let account = accounts
                .first()
                .ok_or_else(|| error(400, "ACCOUNT_NOT_FOUND", "Account not found"))?;
            if name == "accountInfo" {
                return Err(error(
                    400,
                    "PROVIDER_NOT_CONFIGURED",
                    "Account is not associated with a configured social provider.",
                ));
            }
            return Err(error(
                400,
                "PROVIDER_NOT_SUPPORTED",
                &format!(
                    "Provider {} is not supported.",
                    field(account, "provider_id")
                ),
            ));
        }
        "requestPasswordReset" => {
            let redirect = field(input, "redirectTo");
            if !redirect.is_empty() && !pipeline::trusted_web(state, redirect) {
                return Err(error(
                    403,
                    "INVALID_REDIRECT_URL",
                    "A trusted HTTPS reset URL is required",
                ));
            }
            if !state.config.email_enabled() {
                return Err(error(
                    400,
                    "RESET_PASSWORD_DISABLED",
                    "Reset password isn't enabled",
                ));
            }
            if let Some(user) = service::find_user(state, field(input, "email")).await? {
                let token = service::random_token();
                otp::store(state, &format!("reset-password:{token}"), &user.id, 3600).await?;
                let callback = format!(
                    "{}/api/auth/reset-password/{token}?callbackURL={}",
                    state.config.auth_url.as_str().trim_end_matches('/'),
                    cookies::encode(field(input, "redirectTo"))
                );
                email::send(
                    state,
                    &user.email,
                    email::reset(state, &user.email, &token, &callback),
                )
                .await?;
            }
            Reply::json(
                json!({"status":true,"message":"If this email exists in our system, check your email for the reset link"}),
            )
        }
        "resetPassword" => {
            let token = input["token"]
                .as_str()
                .filter(|v| !v.is_empty())
                .or_else(|| query["token"].as_str())
                .filter(|v| !v.is_empty())
                .ok_or_else(|| error(400, "INVALID_TOKEN", "Invalid token"))?;
            service::check_password(field(input, "newPassword"))?;
            let identifier = format!("reset-password:{token}");
            let tx = state.db.begin().await?;
            otp::lock(&tx, &identifier).await?;
            let values=db::rows(&tx,"DELETE FROM verification WHERE identifier=$1 AND expires_at>=now() RETURNING value",vec![identifier.into()]).await?;
            let user = values
                .first()
                .and_then(|r| r["value"].as_str())
                .ok_or_else(|| error(400, "INVALID_TOKEN", "Invalid token"))?
                .to_owned();
            tx.commit().await?;
            set_password(state, &user, field(input, "newPassword"), true, None).await?;
            Reply::json(success())
        }
        "requestPasswordResetCallback" => {
            let token = uri.path().rsplit('/').next().unwrap_or("");
            let valid = !db::rows(
                &state.db,
                "SELECT id FROM verification WHERE identifier=$1 AND expires_at>=now()",
                vec![format!("reset-password:{token}").into()],
            )
            .await?
            .is_empty();
            let callback = field(&query, "callbackURL");
            if !pipeline::trusted_web(state, callback) {
                return Err(error(403, "INVALID_CALLBACK_URL", "Invalid callbackURL"));
            }
            Reply::redirect(&with_query(
                callback,
                if valid { "token" } else { "error" },
                if valid { token } else { "INVALID_TOKEN" },
                state,
            )?)?
        }
        "sendVerificationEmail" => {
            if !state.config.email_enabled() {
                return Err(error(
                    400,
                    "VERIFICATION_EMAIL_NOT_ENABLED",
                    "Verification email isn't enabled",
                ));
            }
            let address = field(input, "email").to_lowercase();
            let start = std::time::Instant::now();
            if let Some(session) = service::get_session(state, headers).await? {
                if session.user.email != address {
                    return Err(error(400, "EMAIL_MISMATCH", "Email mismatch"));
                }
                if session.user.email_verified {
                    return Err(error(
                        400,
                        "EMAIL_ALREADY_VERIFIED",
                        "Email already verified",
                    ));
                }
                otp::send(state, &address, "email-verification").await?;
            } else if let Some(user) = service::find_user(state, &address).await?
                && !user.email_verified
            {
                quiet_limit(otp::send(state, &address, "email-verification").await)?;
            }
            if let Some(remaining) =
                std::time::Duration::from_millis(500).checked_sub(start.elapsed())
            {
                tokio::time::sleep(remaining).await;
            }
            Reply::json(success())
        }
        "changeEmail" => {
            service::require_session(state, headers).await?;
            return Err(error(
                400,
                "CHANGE_EMAIL_DISABLED",
                "Change email is disabled",
            ));
        }
        "deleteUser" => {
            service::require_session(state, headers).await?;
            return Err(pipeline::message(404, "Not Found"));
        }
        "deleteUserCallback" => {
            return Err(error(
                404,
                "DELETE_USER_DISABLED",
                "Delete user is disabled",
            ));
        }
        "signInSocial" => return Err(error(404, "PROVIDER_NOT_FOUND", "Provider not found")),
        "linkSocialAccount" => {
            service::require_session(state, headers).await?;
            return Err(error(404, "PROVIDER_NOT_FOUND", "Provider not found"));
        }
        "callbackOAuth" => {
            let base = format!(
                "{}/api/auth",
                state.config.auth_url.as_str().trim_end_matches('/')
            );
            if method == Method::POST {
                let mut pairs = url::form_urlencoded::Serializer::new(String::new());
                if let Some(map) = body.and_then(Value::as_object) {
                    for (key, value) in map {
                        if let Some(value) = value.as_str() {
                            pairs.append_pair(key, value);
                        }
                    }
                }
                Reply::redirect(&format!(
                    "{base}{}?{}",
                    uri.path().trim_start_matches("/api/auth"),
                    pairs.finish()
                ))?
            } else {
                Reply::redirect(&format!("{base}/error?error=state_not_found"))?
            }
        }
        "expoAuthorizationProxy" => {
            let target = field(&query, "authorizationURL");
            let parsed = url::Url::parse(target)
                .map_err(|_| pipeline::message(400, "Invalid authorizationURL"))?;
            if target.contains('#')
                || parsed.scheme() != "https"
                || parsed.origin() == state.config.auth_url.origin()
            {
                return Err(pipeline::message(400, "Invalid authorizationURL"));
            }
            let mut reply = Reply::redirect(target)?;
            if let Some(oauth) = query["oauthState"].as_str().filter(|v| !v.is_empty()) {
                reply.headers.append(
                    "set-cookie",
                    cookies::cookie_kind(
                        &state.config,
                        "oauth_state",
                        &cookies::encode(oauth),
                        Some(600),
                    )
                    .parse()
                    .map_err(|_| AppError::internal())?,
                );
            } else {
                let value = parsed
                    .query_pairs()
                    .find(|(key, _)| key == "state")
                    .map(|(_, v)| v.into_owned())
                    .ok_or_else(|| pipeline::message(400, "Unexpected error"))?;
                let value = cookies::encode(
                    &cookies::sign(&state.config.auth_secret, &value)
                        .ok_or_else(AppError::internal)?,
                );
                reply.headers.append(
                    "set-cookie",
                    cookies::cookie_kind(&state.config, "state", &value, Some(300))
                        .parse()
                        .map_err(|_| AppError::internal())?,
                );
            }
            reply
        }
        "ok" => Reply::json(json!({"ok":true})),
        "error" => Reply::html(include_str!("error_page.html").into()),
        _ => return Err(AppError::not_found("Not found")),
    };
    Ok(result)
}
