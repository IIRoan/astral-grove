use crate::{AppState, error::AppError};
use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use subtle::ConstantTimeEq;
use tokio::sync::Mutex;
#[derive(Default)]
pub struct Limits(Mutex<Buckets>);
#[derive(Default)]
struct Buckets {
    entries: HashMap<String, (Instant, u32)>,
    swept: Option<Instant>,
}
pub fn admin(state: &AppState, headers: &HeaderMap) -> bool {
    let Some(value) = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
    else {
        return false;
    };
    let value = if value
        .get(..6)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("bearer"))
        && value.as_bytes().get(6).is_some_and(u8::is_ascii_whitespace)
    {
        value[6..].trim()
    } else {
        value.trim()
    };
    !value.is_empty()
        && bool::from(
            Sha256::digest(value.as_bytes())
                .ct_eq(&Sha256::digest(state.config.admin_token.as_bytes())),
        )
}
pub fn client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| {
            !value.is_empty()
                && !value.contains(',')
                && !value.chars().any(char::is_whitespace)
                && (value.parse::<std::net::Ipv4Addr>().is_ok()
                    || value.contains(':') && !value.contains('/'))
        })
        .unwrap_or("unknown")
        .into()
}
impl Limits {
    pub async fn rolling(&self, key: String, max: u32, window: u64) -> Option<u64> {
        self.hit(key, max, window, true).await
    }

    pub async fn check(&self, key: String, max: u32, window: u64) -> Option<u64> {
        self.hit(key, max, window, false).await
    }

    async fn hit(&self, key: String, max: u32, window: u64, extend: bool) -> Option<u64> {
        let now = Instant::now();
        let window = Duration::from_secs(window);
        let mut buckets = self.0.lock().await;
        // Expired buckets are swept at most once a second instead of on every request.
        if buckets
            .swept
            .is_none_or(|at| now.duration_since(at) >= Duration::from_secs(1))
        {
            buckets.entries.retain(|_, (expires, _)| *expires > now);
            buckets.swept = Some(now);
        }
        let entry = buckets.entries.entry(key).or_insert((now + window, 0));
        if entry.0 <= now {
            *entry = (now + window, 0);
        }
        if entry.1 >= max {
            Some(
                entry
                    .0
                    .saturating_duration_since(now)
                    .as_secs()
                    .saturating_add(1),
            )
        } else {
            if extend {
                entry.0 = now + window;
            }
            entry.1 += 1;
            None
        }
    }
}
pub async fn apply(
    State(state): State<Arc<AppState>>,
    mut request: Request,
    next: Next,
) -> Response {
    let origin = request.headers().get(header::ORIGIN).cloned();
    let path = request.uri().path().to_owned();
    let preflight = request.method() == axum::http::Method::OPTIONS;
    if path.len() > 1 && path.ends_with('/') {
        let mut parts = request.uri().clone().into_parts();
        let query = request
            .uri()
            .query()
            .map(|value| format!("?{value}"))
            .unwrap_or_default();
        if let Ok(path) = format!("{}{query}", path.trim_end_matches('/')).parse() {
            parts.path_and_query = Some(path);
            if let Ok(uri) = axum::http::Uri::from_parts(parts) {
                *request.uri_mut() = uri;
            }
        }
    }
    // Auth routes have their own Better Auth-compatible limiter, matching Elysia's mounted handler.
    let exempt = preflight
        || path == "/api/v1/health"
        || path.starts_with("/api/v1/images/")
        || path.starts_with("/api/auth/");
    let limited = if state.config.production && !exempt {
        state
            .limits
            .check(format!("{}:api", client_ip(request.headers())), 180, 60)
            .await
    } else {
        None
    };
    let mut response = if let Some(retry) = limited {
        let mut response = (
            StatusCode::TOO_MANY_REQUESTS,
            axum::Json(json!({"error":"RATE_LIMITED","message":"Too many requests"})),
        )
            .into_response();
        if let Ok(value) = retry.to_string().parse() {
            response.headers_mut().insert(header::RETRY_AFTER, value);
        }
        response
    } else if preflight {
        StatusCode::NO_CONTENT.into_response()
    } else {
        next.run(request).await
    };
    if path.starts_with("/api/v1/")
        && matches!(response.status().as_u16(), 400 | 413 | 415 | 422)
        && !response
            .headers()
            .get(header::CONTENT_TYPE)
            .is_some_and(|value| value.as_bytes().starts_with(b"application/json"))
    {
        response = AppError::validation().into_response();
    }
    let headers = response.headers_mut();
    for (key, value) in [
        ("x-content-type-options", "nosniff"),
        ("x-frame-options", "DENY"),
        ("referrer-policy", "no-referrer"),
        ("x-permitted-cross-domain-policies", "none"),
    ] {
        headers.insert(key, axum::http::HeaderValue::from_static(value));
    }
    if state.config.production {
        headers.insert(
            "strict-transport-security",
            axum::http::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        );
    }
    if let Some(origin) = origin
        && (!state.config.production
            || origin
                .to_str()
                .is_ok_and(|origin| state.config.origin_allowed(origin)))
    {
        headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
        headers.insert(
            header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
            axum::http::HeaderValue::from_static("true"),
        );
        headers.append(header::VARY, axum::http::HeaderValue::from_static("Origin"));
        if preflight {
            headers.insert(
                header::ACCESS_CONTROL_ALLOW_METHODS,
                axum::http::HeaderValue::from_static("GET, POST, PUT, PATCH, DELETE, OPTIONS"),
            );
            headers.insert(
                header::ACCESS_CONTROL_ALLOW_HEADERS,
                axum::http::HeaderValue::from_static("Content-Type, Authorization, Cookie"),
            );
        }
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn limits_reset_expired_buckets_without_sweeping_every_request() {
        let limits = Limits::default();
        assert_eq!(limits.check("a".into(), 1, 1).await, None);
        assert_eq!(limits.check("a".into(), 1, 1).await, Some(1));
        tokio::time::sleep(Duration::from_millis(1100)).await;
        assert_eq!(limits.check("a".into(), 1, 1).await, None);
        assert_eq!(limits.rolling("b".into(), 2, 10).await, None);
        assert_eq!(limits.rolling("b".into(), 2, 10).await, None);
        assert!(limits.rolling("b".into(), 2, 10).await.is_some());
    }
}
