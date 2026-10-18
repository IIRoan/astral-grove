use crate::{
    AppState,
    error::{AppError, Result},
    http,
};
use serde_json::Value;
#[derive(Debug)]
pub struct PaError {
    pub status: u16,
}
impl From<PaError> for AppError {
    fn from(_: PaError) -> Self {
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
    write: bool,
) -> std::result::Result<Value, PaError> {
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
    if write
        && let (Some(name), Some(value)) = (
            state
                .config
                .values
                .get("UPSTREAM_DECK_WRITE_EXTRA_HEADER_NAME"),
            state
                .config
                .values
                .get("UPSTREAM_DECK_WRITE_EXTRA_HEADER_VALUE"),
        )
    {
        request = request.header(name, value);
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
    let bytes = crate::images::capped(response, 50 * 1024 * 1024)
        .await
        .ok_or(PaError { status: 502 })?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|_| PaError { status: 502 })?;
    match schema {
        Some(schema) => http::schemas::schema(schema)
            .parse(Some(&value))
            .map_err(|_| PaError { status: 502 })?
            .ok_or(PaError { status: 502 }),
        None => Ok(value),
    }
}
pub async fn list_cards(state: &AppState, params: &Value) -> Result<Value> {
    Ok(request(
        state,
        reqwest::Method::GET,
        "/v1/cards",
        params,
        None,
        Some("PaCardsListResponse"),
        false,
    )
    .await?)
}
pub async fn card(state: &AppState, number: &str) -> std::result::Result<Value, PaError> {
    request(
        state,
        reqwest::Method::GET,
        &format!("/v1/cards/{}", crate::auth::cookies::encode(number)),
        &Value::Null,
        None,
        Some("PaLogicalCard"),
        false,
    )
    .await
}
