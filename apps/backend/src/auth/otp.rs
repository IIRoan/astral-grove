use super::{email, error, pipeline, service};
use crate::{AppState, db, error::Result};
use rand::RngExt;
use sea_orm::{ConnectionTrait, TransactionTrait};
use serde_json::{Value, json};
use subtle::ConstantTimeEq;

pub fn validate_email(email: &str) -> Result<String> {
    let email = email.to_lowercase();
    if !crate::http::is_zod_email(&email) {
        return Err(error(400, "INVALID_EMAIL", "Invalid email"));
    }
    Ok(email)
}
pub async fn lock<C: ConnectionTrait>(connection: &C, identifier: &str) -> Result<()> {
    db::rows(
        connection,
        "SELECT pg_advisory_xact_lock(hashtextextended($1,1280472990))",
        vec![identifier.into()],
    )
    .await?;
    Ok(())
}
pub async fn store(state: &AppState, identifier: &str, value: &str, seconds: i64) -> Result<()> {
    let tx = state.db.begin().await?;
    lock(&tx, identifier).await?;
    db::execute(
        &tx,
        "DELETE FROM verification WHERE identifier=$1",
        vec![identifier.into()],
    )
    .await?;
    db::execute(&tx,"INSERT INTO verification(id,identifier,value,expires_at,created_at,updated_at) VALUES($1,$2,$3,date_trunc('milliseconds',now())+($4::text||' seconds')::interval,date_trunc('milliseconds',now()),date_trunc('milliseconds',now()))",vec![service::id().into(),identifier.into(),value.into(),seconds.into()]).await?;
    tx.commit().await?;
    Ok(())
}
pub async fn discard(state: &AppState, identifier: &str) -> Result<()> {
    db::execute(
        &state.db,
        "DELETE FROM verification WHERE identifier=$1",
        vec![identifier.into()],
    )
    .await?;
    Ok(())
}
pub async fn send(
    state: &AppState,
    address: &str,
    kind: &str,
    current: Option<&str>,
) -> Result<Value> {
    let address = validate_email(address)?;
    if kind == "change-email" {
        return Err(pipeline::message(400, "Invalid OTP type"));
    }
    let otp = format!("{:06}", rand::rng().random_range(0_u32..1_000_000));
    let identifier = format!("{kind}-otp-{address}");
    store(state, &identifier, &format!("{otp}:0"), 300).await?;
    if kind != "sign-in" && service::find_user(state, &address).await?.is_none() {
        discard(state, &identifier).await?;
        return Ok(json!({"success":true}));
    }
    send_message(state, &address, &otp, kind, current).await?;
    Ok(json!({"success":true}))
}
pub async fn send_message(
    state: &AppState,
    address: &str,
    otp: &str,
    kind: &str,
    current: Option<&str>,
) -> Result<()> {
    match kind {
        "email-verification" => {
            email::send(state, address, email::verification(state, address, otp)).await
        }
        "change-email" => {
            email::send(
                state,
                address,
                email::change_email(current.unwrap_or(""), otp),
            )
            .await
        }
        _ => Ok(()),
    }
}
pub async fn check(
    state: &AppState,
    identifier: &str,
    candidate: &str,
    consume: bool,
) -> Result<()> {
    let tx = state.db.begin().await?;
    lock(&tx, identifier).await?;
    let values=db::rows(&tx,"SELECT id,value,expires_at<now() AS expired FROM verification WHERE identifier=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",vec![identifier.into()]).await?;
    let outcome = if let Some(value) = values.first() {
        let remove = || vec![identifier.into()];
        if value["expired"] == true {
            db::execute(
                &tx,
                "DELETE FROM verification WHERE identifier=$1",
                remove(),
            )
            .await?;
            Err(error(400, "OTP_EXPIRED", "OTP expired"))
        } else {
            let raw = value["value"].as_str().unwrap_or("");
            let (otp, attempts) = raw.rsplit_once(':').unwrap_or((raw, "0"));
            let attempts = attempts.parse::<u32>().unwrap_or(0);
            if attempts >= 3 {
                db::execute(
                    &tx,
                    "DELETE FROM verification WHERE identifier=$1",
                    remove(),
                )
                .await?;
                Err(error(403, "TOO_MANY_ATTEMPTS", "Too many attempts"))
            } else if !bool::from(otp.as_bytes().ct_eq(candidate.as_bytes())) {
                db::execute(&tx,"UPDATE verification SET value=$2,updated_at=date_trunc('milliseconds',now()) WHERE identifier=$1",vec![identifier.into(),format!("{otp}:{}",attempts+1).into()]).await?;
                Err(error(400, "INVALID_OTP", "Invalid OTP"))
            } else {
                if consume {
                    db::execute(
                        &tx,
                        "DELETE FROM verification WHERE identifier=$1",
                        remove(),
                    )
                    .await?;
                }
                Ok(())
            }
        }
    } else {
        Err(error(400, "INVALID_OTP", "Invalid OTP"))
    };
    tx.commit().await?;
    outcome
}
pub async fn verify_email(
    state: &AppState,
    address: &str,
    otp: &str,
    headers: &axum::http::HeaderMap,
) -> Result<super::core::Reply> {
    let address = validate_email(address)?;
    check(
        state,
        &format!("email-verification-otp-{address}"),
        otp,
        true,
    )
    .await?;
    let user = service::find_user(state, &address)
        .await?
        .ok_or_else(|| error(400, "USER_NOT_FOUND", "User not found"))?;
    db::execute(&state.db,"UPDATE \"user\" SET email_verified=true,updated_at=date_trunc('milliseconds',now()) WHERE id=$1",vec![user.id.into()]).await?;
    let user = service::find_user(state, &address)
        .await?
        .ok_or_else(|| error(400, "USER_NOT_FOUND", "User not found"))?;
    let mut reply = super::core::Reply::json(json!({"status":true,"token":null,"user":user}));
    if state.config.email_enabled() {
        let token = service::create_session(state, &user.id, headers, true).await?;
        reply.headers = service::signed_headers(state, &token, true)?;
        reply.body["token"] = json!(token)
    }
    Ok(reply)
}
pub async fn sign_in(
    state: &AppState,
    body: &Value,
    headers: &axum::http::HeaderMap,
) -> Result<super::core::Reply> {
    let email = validate_email(body["email"].as_str().unwrap_or(""))?;
    check(
        state,
        &format!("sign-in-otp-{email}"),
        body["otp"].as_str().unwrap_or(""),
        true,
    )
    .await?;
    let tx = state.db.begin().await?;
    lock(&tx, &format!("user-email:{email}")).await?;
    let user = db::rows(
        &tx,
        "SELECT id,email_verified FROM \"user\" WHERE email=$1 FOR UPDATE",
        vec![email.clone().into()],
    )
    .await?;
    if let Some(user) = user.first() {
        if user["email_verified"] == false {
            let user = user["id"].as_str().unwrap_or("");
            db::execute(
                &tx,
                "DELETE FROM account WHERE user_id=$1",
                vec![user.into()],
            )
            .await?;
            db::execute(
                &tx,
                "DELETE FROM session WHERE user_id=$1",
                vec![user.into()],
            )
            .await?;
            db::execute(&tx,"UPDATE \"user\" SET email_verified=true,updated_at=date_trunc('milliseconds',now()) WHERE id=$1",vec![user.into()]).await?;
        }
    } else {
        db::execute(
            &tx,
            "INSERT INTO \"user\"(id,email,name,image,email_verified) VALUES($1,$2,$3,$4,true)",
            vec![
                service::id().into(),
                email.clone().into(),
                body["name"].as_str().unwrap_or("").into(),
                body["image"].as_str().map(str::to_owned).into(),
            ],
        )
        .await?;
    }
    tx.commit().await?;
    let user = service::find_user(state, &email)
        .await?
        .ok_or_else(|| error(500, "FAILED_TO_CREATE_USER", "Failed to create user"))?;
    let token = service::create_session(state, &user.id, headers, true).await?;
    let mut reply = super::core::Reply::json(json!({"token":token,"user":user}));
    reply.headers = service::signed_headers(state, &token, true)?;
    Ok(reply)
}
pub async fn reset(state: &AppState, body: &Value) -> Result<Value> {
    let email = validate_email(body["email"].as_str().unwrap_or(""))?;
    let plain = body["password"].as_str().unwrap_or("");
    service::check_password(plain)?;
    check(
        state,
        &format!("forget-password-otp-{email}"),
        body["otp"].as_str().unwrap_or(""),
        true,
    )
    .await?;
    let user = service::find_user(state, &email)
        .await?
        .ok_or_else(|| error(400, "USER_NOT_FOUND", "User not found"))?;
    super::core::set_password(state, &user.id, plain, true).await?;
    db::execute(&state.db,"UPDATE \"user\" SET email_verified=true,updated_at=date_trunc('milliseconds',now()) WHERE id=$1",vec![user.id.into()]).await?;
    Ok(json!({"success":true}))
}
pub async fn change(
    state: &AppState,
    body: &Value,
    headers: &axum::http::HeaderMap,
    request: bool,
) -> Result<super::core::Reply> {
    let session = service::require_session(state, headers).await?;
    let email = validate_email(body["newEmail"].as_str().unwrap_or(""))?;
    if email == session.user.email {
        return Err(pipeline::message(400, "Email is the same"));
    }
    let identifier = format!("change-email-otp-{}-{email}", session.user.email);
    if request {
        let otp = format!("{:06}", rand::rng().random_range(0_u32..1_000_000));
        store(state, &identifier, &format!("{otp}:0"), 300).await?;
        if service::find_user(state, &email).await?.is_some() {
            discard(state, &identifier).await?;
        } else {
            send_message(
                state,
                &email,
                &otp,
                "change-email",
                Some(&session.user.email),
            )
            .await?;
        }
        return Ok(super::core::Reply::json(json!({"success":true})));
    }
    check(state, &identifier, body["otp"].as_str().unwrap_or(""), true).await?;
    let tx = state.db.begin().await?;
    lock(&tx, &format!("user-email:{email}")).await?;
    if !db::rows(
        &tx,
        "SELECT id FROM \"user\" WHERE email=$1",
        vec![email.clone().into()],
    )
    .await?
    .is_empty()
    {
        return Err(pipeline::message(400, "Email already in use"));
    }
    let updated=db::execute(&tx,"UPDATE \"user\" SET email=$2,email_verified=true,updated_at=date_trunc('milliseconds',now()) WHERE id=$1",vec![session.user.id.into(),email.into()]).await?;
    if updated == 0 {
        return Err(error(400, "USER_NOT_FOUND", "User not found"));
    }
    tx.commit().await?;
    let mut reply = super::core::Reply::json(json!({"success":true}));
    reply.headers = service::signed_headers(state, &session.session.token, true)?;
    Ok(reply)
}
