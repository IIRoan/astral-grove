use super::{cookies, email, error, pipeline, service};
use crate::{AppState, db, error::Result};
use rand::RngExt;
use sea_orm::{ConnectionTrait, TransactionTrait};
use serde_json::{Value, json};
use std::sync::Arc;
use subtle::ConstantTimeEq;

pub fn validate_email(email: &str) -> Result<String> {
    let email = email.to_lowercase();
    if !crate::http::is_zod_email(&email) {
        return Err(error(400, "INVALID_EMAIL", "Invalid email"));
    }
    Ok(email)
}
pub fn public_kind(kind: &str) -> Result<()> {
    if kind != "email-verification" {
        return Err(pipeline::message(400, "Invalid OTP type"));
    }
    Ok(())
}

async fn budget<C: ConnectionTrait>(
    connection: &C,
    identifier: &str,
    max: u64,
    seconds: i64,
    charge: bool,
) -> Result<()> {
    let rows = db::rows(connection, "SELECT id,value,expires_at>now() AS active FROM verification WHERE identifier=$1 FOR UPDATE", vec![identifier.into()]).await?;
    let used = rows
        .first()
        .filter(|row| row["active"] == true)
        .and_then(|row| row["value"].as_str())
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0);
    if used >= max {
        return Err(error(
            429,
            "TOO_MANY_ATTEMPTS",
            "Too many attempts. Try again later.",
        ));
    }
    if !charge {
        return Ok(());
    }
    if used == 0 {
        db::execute(
            connection,
            "DELETE FROM verification WHERE identifier=$1",
            vec![identifier.into()],
        )
        .await?;
        db::execute(connection, "INSERT INTO verification(id,identifier,value,expires_at) VALUES($1,$2,'1',now()+($3::text||' seconds')::interval)", vec![service::id().into(),identifier.into(),seconds.into()]).await?;
    } else {
        db::execute(
            connection,
            "UPDATE verification SET value=$2 WHERE identifier=$1",
            vec![identifier.into(), (used + 1).to_string().into()],
        )
        .await?;
    }
    Ok(())
}

pub async fn issuance_budget(state: &AppState, identifier: &str) -> Result<()> {
    let tx = state.db.begin().await?;
    lock(&tx, identifier).await?;
    budget(&tx, &format!("otp-send:{identifier}"), 3, 60, true).await?;
    tx.commit().await?;
    Ok(())
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
pub async fn discard<C: ConnectionTrait>(connection: &C, identifier: &str) -> Result<()> {
    db::execute(
        connection,
        "DELETE FROM verification WHERE identifier=$1",
        vec![identifier.into()],
    )
    .await?;
    Ok(())
}
pub async fn send(state: &Arc<AppState>, address: &str, kind: &str) -> Result<Value> {
    let address = validate_email(address)?;
    public_kind(kind)?;
    let otp = format!("{:06}", rand::rng().random_range(0_u32..1_000_000));
    let identifier = format!("{kind}-otp-{address}");
    // Unknown addresses spend the same issuance budget so 429s do not reveal accounts.
    issuance_budget(state, &identifier).await?;
    // Every address stores a code before success, so success means a code exists without revealing accounts.
    store(state, &identifier, &format!("{otp}:0"), 300).await?;
    let worker = state.clone();
    email::detach(state, async move {
        if service::find_user(&worker, &address).await?.is_none() {
            return Ok(());
        }
        let link = service::random_token();
        store(&worker, &link_identifier(&link), &address, 3600).await?;
        email::send(
            &worker,
            &address,
            email::verification(&worker, &address, &otp, &link),
        )
        .await
    })?;
    Ok(json!({"success":true}))
}
fn link_identifier(token: &str) -> String {
    format!("email-verification-link:{token}")
}
pub async fn check(
    state: &AppState,
    identifier: &str,
    candidate: &str,
    consume: bool,
    target: Option<&str>,
) -> Result<()> {
    let mut budgets = vec![format!("otp-attempts:{identifier}")];
    budgets.extend(target.map(|target| format!("otp-attempts:target:{target}")));
    let tx = state.db.begin().await?;
    for key in &budgets {
        lock(&tx, key).await?;
    }
    lock(&tx, identifier).await?;
    for key in &budgets {
        budget(&tx, key, 10, 600, false).await?;
    }
    let values=db::rows(&tx,"SELECT id,value,expires_at<now() AS expired FROM verification WHERE identifier=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",vec![identifier.into()]).await?;
    let current = values.first().filter(|value| value["expired"] != true);
    let raw = current
        .and_then(|value| value["value"].as_str())
        .unwrap_or("");
    let (otp, attempts) = raw.rsplit_once(':').unwrap_or((raw, "0"));
    let attempts = attempts.parse::<u32>().unwrap_or(0);
    // Missing, expired and exhausted codes answer like wrong ones so accounts stay indistinguishable.
    if current.is_some() && attempts < 3 && bool::from(otp.as_bytes().ct_eq(candidate.as_bytes())) {
        if consume {
            discard(&tx, identifier).await?;
        }
        tx.commit().await?;
        return Ok(());
    }
    for key in &budgets {
        budget(&tx, key, 10, 600, true).await?;
    }
    if current.is_some() && attempts < 2 {
        db::execute(&tx,"UPDATE verification SET value=$2,updated_at=date_trunc('milliseconds',now()) WHERE identifier=$1",vec![identifier.into(),format!("{otp}:{}",attempts+1).into()]).await?;
    } else if !values.is_empty() {
        discard(&tx, identifier).await?;
    }
    tx.commit().await?;
    Err(error(400, "INVALID_OTP", "Invalid OTP"))
}
async fn consume_link(state: &AppState, address: &str, token: &str) -> Result<()> {
    let identifier = link_identifier(token);
    let tx = state.db.begin().await?;
    lock(&tx, &identifier).await?;
    let consumed = db::rows(&tx,"DELETE FROM verification WHERE identifier=$1 AND value=$2 AND expires_at>now() RETURNING id",vec![identifier.into(),address.into()]).await?;
    if consumed.is_empty() {
        return Err(error(400, "INVALID_OTP", "Invalid OTP"));
    }
    discard(&tx, &format!("email-verification-otp-{address}")).await?;
    tx.commit().await?;
    Ok(())
}
pub async fn verify_email(
    state: &AppState,
    address: &str,
    otp: &str,
    headers: &axum::http::HeaderMap,
) -> Result<super::core::Reply> {
    let address = validate_email(address)?;
    if service::get_session(state, headers)
        .await?
        .is_some_and(|session| session.user.email != address)
    {
        return Err(error(
            403,
            "ACCOUNT_MISMATCH",
            "Sign out before verifying another account",
        ));
    }
    // Emailed links carry a 256-bit token, so they bypass the guessing budget an attacker can exhaust.
    if otp.len() == 43 {
        consume_link(state, &address, otp).await?;
    } else {
        check(
            state,
            &format!("email-verification-otp-{address}"),
            otp,
            true,
            None,
        )
        .await?;
    }
    let user = service::find_user(state, &address)
        .await?
        .ok_or_else(|| error(400, "USER_NOT_FOUND", "User not found"))?;
    db::execute(&state.db,"UPDATE \"user\" SET email_verified=true,updated_at=date_trunc('milliseconds',now()) WHERE id=$1",vec![user.id.into()]).await?;
    let user = service::find_user(state, &address)
        .await?
        .ok_or_else(|| error(400, "USER_NOT_FOUND", "User not found"))?;
    Ok(super::core::Reply::json(
        json!({"status":true,"token":null,"user":user}),
    ))
}
pub async fn change(
    state: &Arc<AppState>,
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
        issuance_budget(state, &format!("change-email:{}", session.user.id)).await?;
        let otp = format!("{:06}", rand::rng().random_range(0_u32..1_000_000));
        store(state, &identifier, &format!("{otp}:0"), 300).await?;
        let worker = state.clone();
        email::detach(state, async move {
            if service::find_user(&worker, &email).await?.is_some() {
                return discard(&worker.db, &identifier).await;
            }
            email::send(
                &worker,
                &email,
                email::change_email(&session.user.email, &otp),
            )
            .await
        })?;
        return Ok(super::core::Reply::json(json!({"success":true})));
    }
    check(
        state,
        &identifier,
        body["otp"].as_str().unwrap_or(""),
        true,
        Some(&format!("change-email:{email}")),
    )
    .await?;
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
    let updated=db::execute(&tx,"UPDATE \"user\" SET email=$2,email_verified=true,updated_at=date_trunc('milliseconds',now()) WHERE id=$1",vec![session.user.id.clone().into(),email.into()]).await?;
    if updated == 0 {
        return Err(error(400, "USER_NOT_FOUND", "User not found"));
    }
    // Reset links mailed to the previous address must not outlive the change.
    db::execute(
        &tx,
        "DELETE FROM verification WHERE identifier LIKE 'reset-password:%' AND value=$1",
        vec![session.user.id.into()],
    )
    .await?;
    tx.commit().await?;
    let mut reply = super::core::Reply::json(json!({"success":true}));
    reply.headers = service::signed_headers(
        state,
        &session.session.token,
        !cookies::dont_remember(&state.config, headers),
    )?;
    Ok(reply)
}
