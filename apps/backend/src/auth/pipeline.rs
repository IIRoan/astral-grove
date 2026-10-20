use super::error;
use crate::{
    AppState,
    error::{AppError, Result},
};
use axum::{
    Json,
    body::Body,
    extract::{FromRequestParts, Request, State},
    http::{HeaderMap, Method, StatusCode, request::Parts},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
use std::sync::{Arc, OnceLock};

#[derive(Clone)]
pub struct AuthBody(pub Option<Value>);
impl FromRequestParts<Arc<AppState>> for AuthBody {
    type Rejection = AppError;
    async fn from_request_parts(parts: &mut Parts, _state: &Arc<AppState>) -> Result<Self> {
        Ok(parts.extensions.remove::<Self>().unwrap_or(Self(None)))
    }
}
pub fn message(status: u16, message: &str) -> AppError {
    AppError::json(status, json!({"message":message}))
}
pub fn truthy(value: &Value) -> bool {
    !matches!(value, Value::Null | Value::Bool(false)) && value != &json!("") && value != &json!(0)
}
pub async fn apply(State(state): State<Arc<AppState>>, request: Request, next: Next) -> Response {
    let path = request
        .extensions()
        .get::<axum::extract::MatchedPath>()
        .map_or("/api/auth/unknown", |path| path.as_str())
        .trim_start_matches("/api/auth")
        .to_owned();
    if let Some(retry) = limited(&state, &path, request.headers()).await {
        let body = json!({"message":"Too many requests. Please try again later."});
        return (
            StatusCode::TOO_MANY_REQUESTS,
            [("x-retry-after", retry.to_string())],
            Json(body),
        )
            .into_response();
    }
    match prepare(&state, &path, request).await {
        Ok(request) => next.run(request).await,
        Err(error) => error.into_response(),
    }
}
async fn limited(state: &AppState, path: &str, headers: &HeaderMap) -> Option<u64> {
    if state
        .config
        .values
        .get("NODE_ENV")
        .is_some_and(|mode| mode == "test")
    {
        return None;
    }
    // Like Better Auth, requests without a trusted IP share client_ip's "unknown" per-path bucket.
    let ip = crate::middleware::client_ip(headers);
    let (max, window) = if path.contains("email-otp")
        || [
            "/request-password-reset",
            "/send-verification-email",
            "/forget-password",
        ]
        .contains(&path)
    {
        (3, 60)
    } else if [
        "/sign-in/email",
        "/sign-up/email",
        "/change-password",
        "/change-email",
    ]
    .contains(&path)
    {
        (3, 10)
    } else {
        (100, 10)
    };
    state
        .limits
        .rolling(format!("{ip}:auth:{path}"), max, window)
        .await
}
async fn prepare(state: &AppState, path: &str, request: Request) -> Result<Request> {
    let (mut parts, body) = request.into_parts();
    if !parts.headers.contains_key("origin")
        && let Some(origin) = parts.headers.get("expo-origin").cloned()
    {
        parts.headers.insert("origin", origin);
    }
    let mut bytes = axum::body::Bytes::new();
    let mut value = None;
    if !matches!(parts.method, Method::GET | Method::HEAD | Method::OPTIONS) {
        bytes = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            axum::body::to_bytes(body, crate::middleware::body_limit("/api/auth/")),
        )
        .await
        .map_err(|_| error(408, "REQUEST_TIMEOUT", "Request body timed out"))?
        .map_err(|_| error(413, "BAD_REQUEST", "Request body too large"))?;
        if !bytes.is_empty() {
            let media = parts
                .headers
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .split(';')
                .next()
                .unwrap_or("")
                .trim()
                .to_ascii_lowercase();
            let form = ["/sign-in/email", "/sign-up/email"].contains(&path)
                || path.starts_with("/callback/");
            value = Some(match media.as_str() {
                "application/json" => serde_json::from_slice(&bytes)
                    .map_err(|_| error(400, "BAD_REQUEST", "Invalid JSON in request body"))?,
                "application/x-www-form-urlencoded" if form => {
                    crate::http::query(Some(std::str::from_utf8(&bytes).unwrap_or("")))
                }
                _ => {
                    return Err(error(
                        415,
                        "UNSUPPORTED_MEDIA_TYPE",
                        &format!(
                            "Content-Type \"{media}\" is not allowed. Allowed types: {}",
                            if form {
                                "application/x-www-form-urlencoded, application/json"
                            } else {
                                "application/json"
                            }
                        ),
                    ));
                }
            });
        }
        check_origin(state, &parts.headers, value.as_ref(), parts.uri.query())?;
    }
    parts.extensions.insert(AuthBody(value));
    Ok(Request::from_parts(parts, Body::from(bytes)))
}
pub fn validate_origin(state: &AppState, headers: &HeaderMap, force: bool) -> Result<()> {
    if !force && !headers.contains_key("cookie") {
        return Ok(());
    }
    let mut candidate = headers
        .get("origin")
        .or_else(|| headers.get("referer"))
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_owned();
    if candidate == "null"
        && headers
            .get("sec-fetch-site")
            .is_some_and(|v| v == "same-origin")
    {
        candidate = state.config.auth_url.origin().ascii_serialization();
    }
    if candidate.is_empty() || candidate == "null" {
        return Err(error(
            403,
            "MISSING_OR_NULL_ORIGIN",
            "Missing or null Origin",
        ));
    }
    if !state.config.origin_allowed(&candidate) {
        return Err(error(403, "INVALID_ORIGIN", "Invalid origin"));
    }
    Ok(())
}
pub fn trusted(state: &AppState, target: &str) -> bool {
    state
        .config
        .trusted_origins
        .iter()
        .any(|pattern| matches_origin(target, pattern, true))
}
pub fn trusted_web(state: &AppState, target: &str) -> bool {
    let Ok(url) = state.config.auth_url.join(target) else {
        return false;
    };
    let web = url.scheme() == "https"
        || (!state.config.production
            && url.scheme() == "http"
            && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")));
    web && trusted(state, target)
}
fn check_origin(
    state: &AppState,
    headers: &HeaderMap,
    body: Option<&Value>,
    raw_query: Option<&str>,
) -> Result<()> {
    validate_origin(state, headers, false)?;
    let query = crate::http::query(raw_query);
    for (name, label, code) in [
        ("callbackURL", "callbackURL", "INVALID_CALLBACK_URL"),
        ("redirectTo", "redirectURL", "INVALID_REDIRECT_URL"),
        (
            "errorCallbackURL",
            "errorCallbackURL",
            "INVALID_ERROR_CALLBACK_URL",
        ),
        (
            "newUserCallbackURL",
            "newUserCallbackURL",
            "INVALID_NEW_USER_CALLBACK_URL",
        ),
    ] {
        let value = body
            .and_then(|v| v.get(name))
            .or_else(|| (name == "callbackURL").then(|| query.get(name)).flatten());
        if let Some(value) = value.filter(|v| truthy(v)) {
            let Some(value) = value.as_str() else {
                return Err(message(400, &format!("Invalid {label}: expected a string")));
            };
            if !trusted(state, value) {
                return Err(error(403, code, &format!("Invalid {label}")));
            }
        }
    }
    Ok(())
}
pub fn form_csrf(state: &AppState, headers: &HeaderMap) -> Result<()> {
    if headers.contains_key("cookie") {
        return validate_origin(state, headers, false);
    }
    let header = |name: &str| {
        headers
            .get(name)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .trim()
    };
    if ["sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest"]
        .iter()
        .any(|v| !header(v).is_empty())
    {
        if header("sec-fetch-site") == "cross-site" && header("sec-fetch-mode") == "navigate" {
            return Err(error(
                403,
                "CROSS_SITE_NAVIGATION_LOGIN_BLOCKED",
                "Cross-site navigation login blocked. This request appears to be a CSRF attack.",
            ));
        }
        return validate_origin(state, headers, true);
    }
    if headers.contains_key("origin") || headers.contains_key("referer") {
        return validate_origin(state, headers, true);
    }
    Ok(())
}
pub fn matches_origin(target: &str, pattern: &str, relative: bool) -> bool {
    if target.starts_with('/') {
        let path = target
            .split(['?', '#'])
            .next()
            .unwrap_or("")
            .to_ascii_lowercase();
        return relative
            && !target.starts_with("//")
            && !target.contains('\\')
            && !target.chars().any(char::is_control)
            && !path.contains("%2f")
            && !path.contains("%5c")
            && url::Url::parse("https://better-auth.invalid")
                .and_then(|u| u.join(target))
                .is_ok_and(|u| u.origin().ascii_serialization() == "https://better-auth.invalid");
    }
    let parsed = url::Url::parse(target).ok();
    if pattern.contains(['*', '?']) {
        let candidate = if pattern.contains("://") {
            parsed
                .as_ref()
                .filter(|u| matches!(u.scheme(), "http" | "https"))
                .map(|u| u.origin().ascii_serialization())
                .unwrap_or_else(|| target.into())
        } else {
            parsed
                .as_ref()
                .and_then(|u| u.host_str())
                .unwrap_or(target)
                .into()
        };
        let mut expression = String::from("^");
        let mut escape = false;
        for c in pattern.chars() {
            if escape {
                expression.push_str(&regex_lite::escape(&c.to_string()));
                escape = false;
            } else {
                match c {
                    '\\' => escape = true,
                    '*' => expression.push_str(".*?"),
                    '?' => expression.push('.'),
                    _ => expression.push_str(&regex_lite::escape(&c.to_string())),
                }
            }
        }
        expression.push('$');
        return regex_lite::Regex::new(&expression).is_ok_and(|r| r.is_match(&candidate));
    }
    if let Some(parsed) = parsed
        .as_ref()
        .filter(|u| matches!(u.scheme(), "http" | "https"))
    {
        return parsed.origin().ascii_serialization() == pattern;
    }
    fn custom(value: &str) -> Option<(String, String, String)> {
        if value.chars().any(char::is_control) {
            return None;
        }
        let (scheme, mut rest) = value.split_once(':')?;
        if scheme.is_empty() {
            return None;
        }
        let mut authority = "";
        if let Some(after) = rest.strip_prefix("//") {
            let end = after.find(['/', '?', '#']).unwrap_or(after.len());
            authority = &after[..end];
            rest = &after[end..];
        }
        let decoded =
            percent_encoding::percent_decode_str(rest.split(['?', '#']).next().unwrap_or(""))
                .decode_utf8_lossy();
        let mut segments = Vec::new();
        for part in decoded.split('/') {
            match part {
                ".." => {
                    segments.pop();
                }
                "." | "" => {}
                part => segments.push(part),
            }
        }
        Some((
            scheme.to_lowercase(),
            authority.to_lowercase(),
            if segments.is_empty() {
                String::new()
            } else {
                format!("/{}", segments.join("/"))
            },
        ))
    }
    match (custom(target), custom(pattern)) {
        (Some((scheme, host, path)), Some((expected, authority, prefix))) => {
            scheme == expected
                && (authority.is_empty() || authority == host)
                && (prefix.is_empty() || path == prefix || path.starts_with(&format!("{prefix}/")))
        }
        _ => false,
    }
}
#[expect(
    clippy::expect_used,
    reason = "The checked-in auth schema is verified during generation and tests"
)]
fn definitions() -> &'static Value {
    static VALUE: OnceLock<Value> = OnceLock::new();
    VALUE.get_or_init(|| {
        serde_json::from_str(include_str!("request-schemas.json")).expect("auth schemas")
    })
}
pub fn schema(name: &str, kind: &str) -> Option<&'static Value> {
    definitions().get(name).and_then(|v| v.get(kind))
}
pub fn validate(name: &str, body: Option<&Value>, query: &Value) -> Result<()> {
    if let Some(body) = body {
        for (field, max) in [
            ("name", 256),
            ("image", 2048),
            ("email", 254),
            ("newEmail", 254),
        ] {
            if body[field]
                .as_str()
                .is_some_and(|value| value.encode_utf16().count() > max)
            {
                return Err(error(
                    400,
                    "VALIDATION_ERROR",
                    &format!("{field} is too long"),
                ));
            }
        }
    }
    validate_kind(name, "body", body)?;
    validate_kind(name, "query", Some(query))
}
pub fn validate_kind(name: &str, kind: &str, value: Option<&Value>) -> Result<()> {
    if value.is_none() && definitions()[name][format!("{kind}Optional")] == true {
        return Ok(());
    }
    if let Some(schema) = schema(name, kind) {
        let mut issues = Vec::new();
        validate_node(schema, value, kind, &mut issues);
        if !issues.is_empty() {
            return Err(error(400, "VALIDATION_ERROR", &issues.join("; ")));
        }
    }
    Ok(())
}

fn validate_node(schema: &Value, value: Option<&Value>, path: &str, issues: &mut Vec<String>) {
    if let Some(all) = schema["allOf"].as_array() {
        for child in all {
            validate_node(child, value, path, issues)
        }
        return;
    }
    if let Some(any) = schema["anyOf"].as_array() {
        let branches = any
            .iter()
            .map(|child| {
                let mut issues = Vec::new();
                validate_node(child, value, path, &mut issues);
                issues
            })
            .collect::<Vec<_>>();
        if branches.iter().any(Vec::is_empty) {
            return;
        }
        let mut continuable = branches.into_iter().filter(|issues| {
            issues.iter().all(|message| {
                !message.contains("] Invalid input") && !message.contains("] Invalid option")
            })
        });
        if let Some(branch) = continuable.next()
            && continuable.next().is_none()
        {
            issues.extend(branch);
        } else {
            issues.push(format!("[{path}] Invalid input"));
        }
        return;
    }
    if let Some(options) = schema["enum"].as_array()
        && !options.iter().any(|v| Some(v) == value)
    {
        issues.push(format!(
            "[{path}] Invalid option: expected one of {}",
            options
                .iter()
                .map(|v| v.to_string())
                .collect::<Vec<_>>()
                .join("|")
        ));
        return;
    }
    let expected = schema["type"].as_str().unwrap_or("");
    let label = if schema.get("propertyNames").is_some() {
        "record"
    } else {
        expected
    };
    let valid = match expected {
        "object" => value.is_some_and(Value::is_object),
        "array" => value.is_some_and(Value::is_array),
        "string" => value.is_some_and(Value::is_string),
        "boolean" => value.is_some_and(Value::is_boolean),
        "number" | "integer" => value.is_some_and(Value::is_number),
        _ => true,
    };
    if !valid {
        let received = match value {
            None => "undefined",
            Some(Value::Null) => "null",
            Some(Value::Bool(_)) => "boolean",
            Some(Value::String(_)) => "string",
            Some(Value::Number(_)) => "number",
            Some(Value::Array(_)) => "array",
            _ => "object",
        };
        issues.push(format!(
            "[{path}] Invalid input: expected {label}, received {received}"
        ));
        if let Some(array) = value.and_then(Value::as_array)
            && let Some(minimum) = schema["minLength"].as_u64()
            && array.len() < (minimum as usize)
        {
            issues.push(format!(
                "[{path}] Too small: expected array to have >={minimum} items"
            ));
        }
        return;
    }
    if schema.get("const").is_some_and(|v| Some(v) != value) {
        issues.push(format!(
            "[{path}] Invalid input: expected {}",
            schema["const"]
        ));
        return;
    }
    if let Some(object) = value.and_then(Value::as_object)
        && let Some(properties) = schema["properties"].as_object()
    {
        for (key, child) in properties {
            let entry = object.get(key);
            let required = schema["required"]
                .as_array()
                .is_some_and(|r| r.iter().any(|v| v == key));
            if entry.is_some() || required {
                validate_node(child, entry, &format!("{path}.{key}"), issues)
            }
        }
        if schema["additionalProperties"] == false {
            let unknown = object
                .keys()
                .filter(|key| !properties.contains_key(*key))
                .map(|key| format!("\"{key}\""))
                .collect::<Vec<_>>();
            if !unknown.is_empty() {
                issues.push(format!(
                    "[{path}] Unrecognized key{}: {}",
                    if unknown.len() == 1 { "" } else { "s" },
                    unknown.join(", ")
                ))
            }
        }
    }
    if let Some(object) = value.and_then(Value::as_object)
        && let Some(child) = schema
            .get("additionalProperties")
            .filter(|value| value.is_object())
    {
        for (key, value) in object {
            if schema["properties"].get(key).is_none() {
                validate_node(child, Some(value), &format!("{path}.{key}"), issues)
            }
        }
    }
    if let Some(array) = value.and_then(Value::as_array)
        && schema.get("items").is_some()
    {
        for (index, entry) in array.iter().enumerate() {
            validate_node(
                &schema["items"],
                Some(entry),
                &format!("{path}.{index}"),
                issues,
            )
        }
    }
    if let Some(text) = value.and_then(Value::as_str) {
        if schema["format"] == "email" && !crate::http::is_zod_email(text) {
            issues.push(format!("[{path}] Invalid email address"))
        }
        if let Some(min) = schema["minLength"].as_u64()
            && text.encode_utf16().count() < (min as usize)
        {
            issues.push(format!(
                "[{path}] Too small: expected string to have >={min} characters"
            ))
        }
    }
}

pub async fn auth_only(state: State<Arc<AppState>>, request: Request, next: Next) -> Response {
    if request.uri().path().starts_with("/api/auth/") {
        apply(state, request, next).await
    } else {
        next.run(request).await
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn origin_rules() {
        assert!(matches_origin(
            "exp://192.168.1.2:8081/--/login",
            "exp://**",
            false
        ));
        assert!(matches_origin(
            "astral-grove://reset-password",
            "astral-grove://",
            false
        ));
        assert!(!matches_origin(
            "https://evil.example",
            "https://app.example",
            false
        ));
        assert!(!matches_origin("/a%2f..%2fb", "https://app.example", true));
        assert!(matches_origin(
            "/reset?token=x",
            "https://app.example",
            true
        ));
    }
    #[test]
    fn schema_cannot_assign_foreign_tokens() {
        assert!(
            validate(
                "refreshToken",
                Some(&json!({"accountId":"x","providerId":"credential"})),
                &json!({})
            )
            .is_err()
        );
    }
}
