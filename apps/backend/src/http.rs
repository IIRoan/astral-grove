pub mod schemas;
pub mod upstream_decks;
pub mod zod;

pub fn query(raw: Option<&str>) -> serde_json::Value {
    let fields = url::form_urlencoded::parse(raw.unwrap_or("").as_bytes())
        .map(|(key, value)| {
            (
                key.into_owned(),
                serde_json::Value::String(value.into_owned()),
            )
        })
        .collect();
    serde_json::Value::Object(fields)
}
pub fn output<T: serde::de::DeserializeOwned>(
    value: serde_json::Value,
) -> crate::error::Result<axum::Json<T>> {
    Ok(axum::Json(serde_json::from_value(value)?))
}

pub fn valid_uuid(value: &str) -> bool {
    value.len() == 36
        && [8, 13, 18, 23]
            .into_iter()
            .all(|index| value.as_bytes().get(index) == Some(&b'-'))
        && value
            .chars()
            .enumerate()
            .all(|(index, ch)| [8, 13, 18, 23].contains(&index) || ch.is_ascii_hexdigit())
}
pub fn valid_date(value: &str) -> bool {
    if value.len() != 10
        || !value.bytes().enumerate().all(|(index, byte)| {
            if matches!(index, 4 | 7) {
                byte == b'-'
            } else {
                byte.is_ascii_digit()
            }
        })
    {
        return false;
    }
    time::Date::parse(
        value,
        &time::macros::format_description!("[year]-[month]-[day]"),
    )
    .is_ok()
}
pub fn thumb_width(value: Option<&serde_json::Value>) -> Option<serde_json::Value> {
    match value {
        None => None,
        Some(serde_json::Value::String(text)) => {
            let text = text.trim_start();
            let digits: String = text
                .strip_prefix('+')
                .unwrap_or(text)
                .chars()
                .take_while(|ch| ch.is_ascii_digit())
                .collect();
            digits
                .parse::<i64>()
                .ok()
                .filter(|width| [96, 160, 240, 320].contains(width))
                .map(|width| serde_json::json!(width))
        }
        Some(serde_json::Value::Number(number)) => number
            .as_i64()
            .filter(|width| [96, 160, 240, 320].contains(width))
            .map(|width| serde_json::json!(width)),
        Some(value) => Some(value.clone()),
    }
}

pub fn parse<T: serde::de::DeserializeOwned>(
    name: &str,
    value: &serde_json::Value,
) -> crate::error::Result<T> {
    let parsed = schemas::schema(name)
        .parse(Some(value))
        .map_err(|_| crate::error::AppError::validation())?;
    serde_json::from_value(parsed.unwrap_or(serde_json::Value::Null))
        .map_err(|_| crate::error::AppError::validation())
}

pub fn is_zod_email(value: &str) -> bool {
    static PATTERN: std::sync::LazyLock<regex_lite::Regex> = std::sync::LazyLock::new(|| {
        regex_lite::Regex::new(
            r"(?i)^([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$",
        )
        .unwrap_or_else(|error| panic!("email pattern: {error}"))
    });
    !value.starts_with('.') && !value.contains("..") && PATTERN.is_match(value)
}

pub fn value(name: &str, value: &serde_json::Value) -> crate::error::Result<serde_json::Value> {
    schemas::schema(name)
        .parse(Some(value))
        .map_err(|_| crate::error::AppError::validation())
        .map(|value| value.unwrap_or(serde_json::Value::Null))
}
pub fn respond<T: serde::de::DeserializeOwned>(
    name: &str,
    value: serde_json::Value,
) -> crate::error::Result<axum::Json<T>> {
    let normalized = schemas::schema(name)
        .parse(Some(&value))
        .map_err(|_| crate::error::AppError::internal())?
        .ok_or_else(crate::error::AppError::internal)?;
    output(normalized)
}

#[derive(Clone)]
pub struct BodyJson(pub serde_json::Value);
impl<S: Send + Sync> axum::extract::FromRequestParts<S> for BodyJson {
    type Rejection = crate::error::AppError;
    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> crate::error::Result<Self> {
        Ok(parts
            .extensions
            .get::<Self>()
            .cloned()
            .unwrap_or(Self(serde_json::Value::Null)))
    }
}
pub async fn input_layer(
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    use axum::response::IntoResponse;
    if !request.uri().path().starts_with("/api/v1/")
        || matches!(
            request.method(),
            &axum::http::Method::GET | &axum::http::Method::HEAD | &axum::http::Method::OPTIONS
        )
    {
        return next.run(request).await;
    }
    let (mut parts, body) = request.into_parts();
    let bytes = match axum::body::to_bytes(body, 128 * 1024 * 1024).await {
        Ok(bytes) => bytes,
        Err(_) => {
            return crate::error::AppError::new(413, "PAYLOAD_TOO_LARGE", "Request body too large")
                .into_response();
        }
    };
    let media = parts
        .headers
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let value = if bytes.is_empty() {
        serde_json::Value::Null
    } else if media == "application/json" || media.ends_with("+json") {
        match serde_json::from_slice(&bytes) {
            Ok(value) => value,
            Err(_) => {
                return crate::error::AppError::new(
                    400,
                    "VALIDATION_ERROR",
                    "Invalid JSON request body",
                )
                .into_response();
            }
        }
    } else if media == "application/x-www-form-urlencoded" {
        query(std::str::from_utf8(&bytes).ok())
    } else if media.starts_with("text/") {
        serde_json::Value::String(String::from_utf8_lossy(&bytes).into_owned())
    } else {
        serde_json::Value::Null
    };
    parts.extensions.insert(BodyJson(value));
    next.run(axum::extract::Request::from_parts(
        parts,
        axum::body::Body::empty(),
    ))
    .await
}
