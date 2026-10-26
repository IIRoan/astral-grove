use super::{cookies, error, password};
use crate::{
    AppState, db,
    error::{AppError, Result},
};
use astral_grove_api_types::auth::{SessionResponse, User};
use axum::http::HeaderMap;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::RngExt;
use sea_orm::{ConnectionTrait, TransactionTrait};

// Remembered sessions roll forward on use, so a device stays signed in until it sits unused this long.
pub const SESSION_SECONDS: i64 = 90 * 86400;
const SHORT_SESSION_SECONDS: i64 = 86400;
const UPDATE_AGE_SECONDS: i64 = 86400;

pub const USER_COLUMNS: &str = "id, name, email, email_verified AS \"emailVerified\", image, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"createdAt\", to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"updatedAt\"";

pub fn id() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}
pub fn random_token() -> String {
    URL_SAFE_NO_PAD.encode(rand::rng().random::<[u8; 32]>())
}

pub async fn find_user(state: &AppState, email: &str) -> Result<Option<User>> {
    let rows = db::rows(
        &state.db,
        &format!("SELECT {USER_COLUMNS} FROM \"user\" WHERE email=$1"),
        vec![email.to_lowercase().into()],
    )
    .await?;
    rows.into_iter()
        .next()
        .map(serde_json::from_value)
        .transpose()
        .map_err(AppError::from)
}
pub async fn get_session(state: &AppState, headers: &HeaderMap) -> Result<Option<SessionResponse>> {
    session_with_refresh(state, headers, true).await
}

pub async fn session_with_refresh(
    state: &AppState,
    headers: &HeaderMap,
    refresh: bool,
) -> Result<Option<SessionResponse>> {
    let Some(mut session) = find_session(state, headers).await? else {
        return Ok(None);
    };
    if !refresh
        || cookies::dont_remember(&state.config, headers)
        || !needs_refresh(&session.session.expires_at, time::OffsetDateTime::now_utc())
    {
        return Ok(Some(session));
    }
    let renewed = db::rows(&state.db,"UPDATE session SET expires_at=date_trunc('milliseconds',now())+($2::text||' seconds')::interval,updated_at=date_trunc('milliseconds',now()) WHERE token=$1 AND expires_at>now() AND expires_at<=now()+($3::text||' seconds')::interval RETURNING to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS expires,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS updated",vec![session.session.token.clone().into(),SESSION_SECONDS.into(),(SESSION_SECONDS-UPDATE_AGE_SECONDS).into()]).await?;
    if let Some(row) = renewed.first() {
        session.session.expires_at = db::string(row, "expires").into();
        session.session.updated_at = db::string(row, "updated").into();
        Ok(Some(session))
    } else {
        find_session(state, headers).await
    }
}

fn needs_refresh(expires: &str, now: time::OffsetDateTime) -> bool {
    time::OffsetDateTime::parse(expires, &time::format_description::well_known::Rfc3339).is_ok_and(
        |expires| expires - time::Duration::seconds(SESSION_SECONDS - UPDATE_AGE_SECONDS) <= now,
    )
}

pub fn seconds_left(expires: &str) -> Option<i64> {
    time::OffsetDateTime::parse(expires, &time::format_description::well_known::Rfc3339)
        .ok()
        .map(|expires| (expires - time::OffsetDateTime::now_utc()).whole_seconds())
        .filter(|seconds| *seconds > 0)
}

async fn find_session(state: &AppState, headers: &HeaderMap) -> Result<Option<SessionResponse>> {
    let Some(token) = cookies::token(&state.config, headers) else {
        return Ok(None);
    };
    let rows = db::rows(&state.db, "SELECT jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'emailVerified',u.email_verified,'image',u.image,'createdAt',to_char(u.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),'updatedAt',to_char(u.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')) AS \"user\", jsonb_build_object('id',s.id,'userId',s.user_id,'token',s.token,'expiresAt',to_char(s.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),'createdAt',to_char(s.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),'updatedAt',to_char(s.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),'ipAddress',s.ip_address,'userAgent',s.user_agent) AS session FROM session s JOIN \"user\" u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>now()", vec![token.into()]).await?;
    rows.into_iter()
        .next()
        .map(serde_json::from_value)
        .transpose()
        .map_err(AppError::from)
}
pub async fn create_session(
    state: &AppState,
    user_id: &str,
    headers: &HeaderMap,
    remember: bool,
) -> Result<String> {
    create_session_on(&state.db, user_id, headers, remember).await
}
pub async fn create_session_on<C: ConnectionTrait>(
    connection: &C,
    user_id: &str,
    headers: &HeaderMap,
    remember: bool,
) -> Result<String> {
    let token = random_token();
    let ip = crate::middleware::client_ip(headers);
    let agent = headers
        .get("user-agent")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .chars()
        .take(1024)
        .collect::<String>();
    db::execute(connection, "INSERT INTO session(id,user_id,token,expires_at,ip_address,user_agent) VALUES($1,$2,$3,now()+($4::text||' seconds')::interval,$5,$6)", vec![id().into(), user_id.into(), token.clone().into(), (if remember { SESSION_SECONDS } else { SHORT_SESSION_SECONDS }).into(), ip.into(), agent.into()]).await?;
    Ok(token)
}
pub async fn password_session(
    state: &AppState,
    user_id: &str,
    verified_hash: &str,
    headers: &HeaderMap,
    remember: bool,
) -> Result<String> {
    let tx = state.db.begin().await?;
    super::otp::lock(&tx, &format!("credential:{user_id}")).await?;
    let rows = db::rows(
        &tx,
        "SELECT password FROM account WHERE user_id=$1 AND provider_id='credential'",
        vec![user_id.into()],
    )
    .await?;
    if !rows
        .iter()
        .any(|row| row["password"].as_str() == Some(verified_hash))
    {
        return Err(error(
            401,
            "INVALID_EMAIL_OR_PASSWORD",
            "Invalid email or password",
        ));
    }
    let token = create_session_on(&tx, user_id, headers, remember).await?;
    tx.commit().await?;
    Ok(token)
}
pub async fn sign_up(
    state: &AppState,
    name: &str,
    email: &str,
    plain: &str,
    image: Option<&str>,
) -> Result<(User, bool)> {
    check_password(plain)?;
    if !crate::http::is_zod_email(email) {
        return Err(error(400, "INVALID_EMAIL", "Invalid email"));
    }
    let hash = password::hash(plain)
        .await
        .map_err(|_| AppError::internal())?;
    let user_id = id();
    let tx = state.db.begin().await?;
    super::otp::lock(&tx, &format!("user-email:{}", email.to_lowercase())).await?;
    if !db::rows(
        &tx,
        "SELECT id FROM \"user\" WHERE email=$1 FOR UPDATE",
        vec![email.to_lowercase().into()],
    )
    .await?
    .is_empty()
    {
        if state.config.email_enabled() {
            let now = db::iso(time::OffsetDateTime::now_utc());
            tx.commit().await?;
            return Ok((
                User {
                    id: id(),
                    name: name.into(),
                    email: email.to_lowercase(),
                    email_verified: false,
                    image: image.map(str::to_owned),
                    created_at: now.clone(),
                    updated_at: now,
                },
                false,
            ));
        }
        return Err(error(
            422,
            "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
            "User already exists. Use another email.",
        ));
    }
    db::execute(
        &tx,
        "INSERT INTO \"user\"(id,name,email,image) VALUES($1,$2,$3,$4)",
        vec![
            user_id.clone().into(),
            name.into(),
            email.to_lowercase().into(),
            image.map(str::to_owned).into(),
        ],
    )
    .await?;
    db::execute(&tx, "INSERT INTO account(id,account_id,provider_id,user_id,password) VALUES($1,$2,'credential',$2,$3)", vec![id().into(),user_id.into(),hash.into()]).await?;
    tx.commit().await?;
    Ok((
        find_user(state, email)
            .await?
            .ok_or_else(AppError::internal)?,
        true,
    ))
}
pub async fn sign_in(
    state: &AppState,
    email: &str,
    plain: &str,
    ip: &str,
) -> Result<(User, String)> {
    if !crate::http::is_zod_email(email) {
        return Err(error(400, "INVALID_EMAIL", "Invalid email"));
    }
    if plain.encode_utf16().count() > 128 {
        return Err(error(400, "PASSWORD_TOO_LONG", "Password too long"));
    }
    // Failed sign-ins are budgeted per address and client, so an attacker elsewhere cannot lock the owner out.
    let account = format!("sign-in:{ip}:{}", email.to_lowercase());
    if state.limits.exhausted(&account, 20).await {
        return Err(error(
            429,
            "TOO_MANY_ATTEMPTS",
            "Too many attempts. Try again later.",
        ));
    }
    let invalid = || async {
        state.limits.rolling(account.clone(), 20, 900).await;
        error(
            401,
            "INVALID_EMAIL_OR_PASSWORD",
            "Invalid email or password",
        )
    };
    let Some(user) = find_user(state, email).await? else {
        let _ = password::hash(plain).await;
        return Err(invalid().await);
    };
    let rows = db::rows(
        &state.db,
        "SELECT password FROM account WHERE user_id=$1 AND provider_id='credential'",
        vec![user.id.clone().into()],
    )
    .await?;
    let hash = rows
        .first()
        .and_then(|row| row["password"].as_str())
        .unwrap_or("");
    if hash.is_empty() {
        let _ = password::hash(plain).await;
        return Err(invalid().await);
    }
    if !password::verify(hash, plain)
        .await
        .map_err(|_| AppError::internal())?
    {
        return Err(invalid().await);
    }
    if state.config.email_enabled() && !user.email_verified {
        return Err(error(403, "EMAIL_NOT_VERIFIED", "Email not verified"));
    }
    Ok((user, hash.into()))
}
pub fn check_password(value: &str) -> Result<()> {
    let length = value.encode_utf16().count();
    if length < 12 {
        return Err(error(400, "PASSWORD_TOO_SHORT", "Password too short"));
    }
    if length > 128 {
        return Err(error(400, "PASSWORD_TOO_LONG", "Password too long"));
    }
    Ok(())
}
pub async fn sign_out(state: &AppState, headers: &HeaderMap) -> Result<()> {
    if let Some(token) = cookies::token(&state.config, headers) {
        db::execute(
            &state.db,
            "DELETE FROM session WHERE token=$1",
            vec![token.into()],
        )
        .await?;
    }
    Ok(())
}
pub fn signed_headers(state: &AppState, token: &str, remember: bool) -> Result<HeaderMap> {
    session_cookies(state, token, remember.then_some(SESSION_SECONDS))
}
/// `age: None` issues a browser-session cookie marked dont_remember.
pub fn session_cookies(state: &AppState, token: &str, age: Option<i64>) -> Result<HeaderMap> {
    let value = cookies::sign(&state.config.auth_secret, token).ok_or_else(AppError::internal)?;
    let encoded = cookies::encode(&value);
    let mut headers = HeaderMap::new();
    headers.insert(
        "set-cookie",
        cookies::cookie_kind(&state.config, "session_token", &encoded, age)
            .parse()
            .map_err(|_| AppError::internal())?,
    );
    // A remembered login clears any dont_remember left by an earlier short session.
    let dont_remember = if age.is_some() {
        cookies::cookie_kind(&state.config, "dont_remember", "", Some(0))
    } else {
        let value = cookies::encode(
            &cookies::sign(&state.config.auth_secret, "true").ok_or_else(AppError::internal)?,
        );
        cookies::cookie_kind(&state.config, "dont_remember", &value, None)
    };
    headers.append(
        "set-cookie",
        dont_remember.parse().map_err(|_| AppError::internal())?,
    );
    headers.insert(
        "set-auth-token",
        encoded.parse().map_err(|_| AppError::internal())?,
    );
    headers.insert(
        "access-control-expose-headers",
        axum::http::HeaderValue::from_static("set-auth-token"),
    );
    Ok(headers)
}

pub async fn user_by_id(state: &AppState, id: &str) -> Result<Option<User>> {
    db::rows(
        &state.db,
        &format!("SELECT {USER_COLUMNS} FROM \"user\" WHERE id=$1"),
        vec![id.into()],
    )
    .await?
    .into_iter()
    .next()
    .map(serde_json::from_value)
    .transpose()
    .map_err(AppError::from)
}
pub async fn require_session(state: &AppState, headers: &HeaderMap) -> Result<SessionResponse> {
    get_session(state, headers)
        .await?
        .ok_or_else(|| error(401, "UNAUTHORIZED", "Unauthorized"))
}
pub async fn require_fresh(state: &AppState, headers: &HeaderMap) -> Result<SessionResponse> {
    let session = require_session(state, headers).await?;
    if time::OffsetDateTime::parse(
        &session.session.created_at,
        &time::format_description::well_known::Rfc3339,
    )
    .ok()
    .is_some_and(|created| {
        time::OffsetDateTime::now_utc().unix_timestamp() - created.unix_timestamp() >= 86400
    }) {
        return Err(error(403, "SESSION_NOT_FRESH", "Session is not fresh"));
    }
    Ok(session)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_renewal_starts_at_the_daily_update_boundary() {
        let now = time::macros::datetime!(2026-10-19 12:00 UTC);
        assert!(!needs_refresh("2027-01-17T12:00:00.000Z", now));
        assert!(!needs_refresh("2027-01-16T12:00:00.001Z", now));
        assert!(needs_refresh("2027-01-16T12:00:00.000Z", now));
        assert!(needs_refresh("2026-10-20T12:00:00.000Z", now));
        assert!(!needs_refresh("invalid", now));
    }
}
