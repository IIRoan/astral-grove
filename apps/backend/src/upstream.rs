use crate::{
    AppState,
    error::{AppError, Result},
    http,
};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::time::Duration;
tokio::task_local! {
    /// Client identity for work done inside an HTTP request; background jobs run outside this scope.
    pub static CLIENT: String;
}
#[derive(Debug)]
pub struct PaError {
    pub status: u16,
}
impl From<PaError> for AppError {
    fn from(error: PaError) -> Self {
        if error.status == 429 {
            return AppError::new(
                503,
                "UPSTREAM_BUSY",
                "Upstream capacity reached. Please retry shortly",
            );
        }
        AppError::internal()
    }
}
pub async fn request(
    state: &AppState,
    method: reqwest::Method,
    path: &str,
    params: &Value,
    body: Option<&Value>,
    schema: Option<&str>,
) -> std::result::Result<Value, PaError> {
    let cacheable = (path.starts_with("/v1/cards")
        || path.starts_with("/v1/filters")
        || path.starts_with("/v1/decks"))
        && !path.contains("hash");
    let cache_key = hex::encode(Sha256::digest(
        format!("{method}:{path}:{params}:{body:?}:{schema:?}").as_bytes(),
    ));
    if cacheable && let Some(value) = state.upstream_cache.lock().await.get(&cache_key).cloned() {
        return Ok(value);
    }
    let maximum = state.config.upstream_per_minute;
    let client = CLIENT.try_with(Clone::clone).ok();
    // Each client gets a share and interactive work leaves a quarter for background sync.
    if let Some(client) = &client
        && (state
            .upstream_budget
            .check(format!("client:{client}"), maximum.div_ceil(4), 60)
            .await
            .is_some()
            || state
                .upstream_budget
                .check("interactive".into(), maximum - maximum / 4, 60)
                .await
                .is_some())
    {
        return Err(PaError { status: 429 });
    }
    let mut waited = 0;
    while let Some(retry) = state
        .upstream_budget
        .check("global".into(), maximum, 60)
        .await
    {
        // Background jobs wait for the window instead of failing a whole sync.
        if client.is_some() || waited >= 120 {
            return Err(PaError { status: 429 });
        }
        let pause = retry.clamp(1, 5);
        tokio::time::sleep(Duration::from_secs(pause)).await;
        waited += pause;
    }
    let _permit = tokio::time::timeout(Duration::from_secs(10), state.upstream_slots.acquire())
        .await
        .map_err(|_| PaError { status: 429 })?
        .map_err(|_| PaError { status: 429 })?;
    let mut request = state
        .client
        .request(method, format!("{}{}", state.config.pa_url, path))
        .header("content-type", "application/json")
        .header("x-api-key", &state.config.pa_key);
    if let Some(params) = params.as_object() {
        let params: Vec<(String, String)> = params
            .iter()
            .filter(|(_, value)| !value.is_null() && **value != "")
            .map(|(key, value)| {
                (
                    key.clone(),
                    value
                        .as_str()
                        .map(str::to_owned)
                        .unwrap_or_else(|| value.to_string()),
                )
            })
            .collect();
        request = request.query(&params);
    }
    if let Some(body) = body {
        request = request.json(body);
    }
    let response = request.send().await.map_err(|_| PaError { status: 502 })?;
    let status = response.status().as_u16();
    if !response.status().is_success() {
        return Err(PaError { status });
    }
    if status == 204 {
        return Ok(Value::Null);
    }
    let bytes = crate::images::capped(response, 16 * 1024 * 1024)
        .await
        .ok_or(PaError { status: 502 })?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|_| PaError { status: 502 })?;
    let result = match schema {
        Some(schema) => http::schemas::schema(schema)
            .parse(Some(&value))
            .map_err(|_| PaError { status: 502 })?
            .ok_or(PaError { status: 502 }),
        None => Ok(value),
    }?;
    if cacheable {
        state.upstream_cache.lock().await.insert(
            cache_key,
            result.clone(),
            bytes.len().saturating_mul(4),
        );
    }
    Ok(result)
}
pub async fn list_cards(state: &AppState, params: &Value) -> Result<Value> {
    Ok(request(
        state,
        reqwest::Method::GET,
        "/v1/cards",
        params,
        None,
        Some("PaCardsListResponse"),
    )
    .await?)
}
pub async fn card(state: &AppState, number: &str) -> std::result::Result<Value, PaError> {
    if number.is_empty() || number.chars().all(|c| c == '.') {
        return Err(PaError { status: 404 });
    }
    request(
        state,
        reqwest::Method::GET,
        &format!("/v1/cards/{}", crate::auth::cookies::encode(number)),
        &Value::Null,
        None,
        Some("PaLogicalCard"),
    )
    .await
}
