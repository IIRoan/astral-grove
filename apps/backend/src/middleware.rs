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
        .and_then(|value| value.parse::<std::net::IpAddr>().ok())
        .map(|ip| match ip {
            std::net::IpAddr::V6(ip) => ip.to_ipv4_mapped().map_or_else(
                || {
                    let mut octets = ip.octets();
                    octets[8..].fill(0);
                    std::net::Ipv6Addr::from(octets).to_string()
                },
                |ip| ip.to_string(),
            ),
            ip => ip.to_string(),
        })
        .unwrap_or_else(|| "unknown".into())
}
fn forwarded_ip(
    peer: std::net::IpAddr,
    headers: &HeaderMap,
    trusted: &[ipnet::IpNet],
) -> std::net::IpAddr {
    // Dual-stack listeners report IPv4 peers as ::ffff:a.b.c.d, which IPv4 ranges never contain.
    let trusted_hop = |ip: &std::net::IpAddr| trusted.iter().any(|network| network.contains(ip));
    let mut current = peer.to_canonical();
    // Every header line counts, so a forged first line cannot hide hops appended by the proxy.
    let entries = headers
        .get_all("x-forwarded-for")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .collect::<Vec<_>>();
    for entry in entries.iter().rev().take(16) {
        if !trusted_hop(&current) {
            break;
        }
        let Ok(address) = entry.trim().parse::<std::net::IpAddr>() else {
            break;
        };
        current = address.to_canonical();
    }
    current
}
pub const MAX_BUCKETS: usize = 65536;
// Long keys (such as maximum-length emails) are hashed so they are still charged with bounded memory.
fn bucket_key(key: String) -> String {
    if key.len() > 256 {
        hex::encode(Sha256::digest(key.as_bytes()))
    } else {
        key
    }
}
pub fn body_deadline(path: &str) -> Duration {
    // Large imports need time on slow mobile uplinks; other bodies are small.
    Duration::from_secs(if path == "/api/v1/collection/import" {
        120
    } else {
        10
    })
}
pub fn body_limit(path: &str) -> usize {
    if path.starts_with("/api/auth/") {
        64 * 1024
    } else if path == "/api/v1/collection/import" {
        16 * 1024 * 1024
    } else {
        2 * 1024 * 1024
    }
}
fn api_origin(state: &AppState, request: &Request) -> Result<(), AppError> {
    if !request.uri().path().starts_with("/api/v1/")
        || matches!(
            *request.method(),
            axum::http::Method::GET | axum::http::Method::HEAD | axum::http::Method::OPTIONS
        )
        || !request.headers().contains_key("cookie")
    {
        return Ok(());
    }
    let headers = request.headers();
    if headers.contains_key("origin") || headers.contains_key("referer") {
        return crate::auth::pipeline::validate_origin(state, headers, true);
    }
    // Existing native clients send JSON, which browsers cannot send cross-origin without preflight.
    let json_request = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .is_some_and(|value| value.trim().eq_ignore_ascii_case("application/json"));
    if (json_request
        || headers
            .get("x-astral-request")
            .is_some_and(|value| value == "1"))
        && !headers.contains_key("sec-fetch-site")
    {
        return Ok(());
    }
    Err(AppError::new(
        403,
        "INVALID_ORIGIN",
        "A trusted request origin is required",
    ))
}
impl Limits {
    pub async fn rolling(&self, key: String, max: u32, window: u64) -> Option<u64> {
        self.hit(key, max, window, true).await
    }

    pub async fn check(&self, key: String, max: u32, window: u64) -> Option<u64> {
        self.hit(key, max, window, false).await
    }

    pub async fn exhausted(&self, key: &str, max: u32) -> bool {
        let now = Instant::now();
        self.0
            .lock()
            .await
            .entries
            .get(&bucket_key(key.into()))
            .is_some_and(|(expires, used)| *expires > now && *used >= max)
    }

    async fn hit(&self, key: String, max: u32, window: u64, extend: bool) -> Option<u64> {
        let now = Instant::now();
        let window = Duration::from_secs(window);
        let key = bucket_key(key);
        let mut buckets = self.0.lock().await;
        // Expired buckets are swept at most once a second instead of on every request.
        if buckets
            .swept
            .is_none_or(|at| now.duration_since(at) >= Duration::from_secs(1))
        {
            buckets.entries.retain(|_, (expires, _)| *expires > now);
            buckets.swept = Some(now);
        }
        // Evict the soonest-expiring eighth in one pass; rolling auth buckets stay newest while attacked.
        if !buckets.entries.contains_key(&key) && buckets.entries.len() >= MAX_BUCKETS {
            let mut expiries = buckets
                .entries
                .values()
                .map(|(expires, _)| *expires)
                .collect::<Vec<_>>();
            let cutoff = *expiries.select_nth_unstable(MAX_BUCKETS / 8).1;
            buckets.entries.retain(|_, (expires, _)| *expires > cutoff);
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
    let peer = request
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|peer| peer.0.ip());
    let ip = peer.map(|peer| forwarded_ip(peer, request.headers(), &state.config.trusted_proxies));
    request.headers_mut().remove("x-real-ip");
    if let Some(ip) = ip.and_then(|ip| ip.to_string().parse().ok()) {
        request.headers_mut().insert("x-real-ip", ip);
    }
    let mut rejection = api_origin(&state, &request).err();
    let unsafe_method = !matches!(
        *request.method(),
        axum::http::Method::GET | axum::http::Method::HEAD | axum::http::Method::OPTIONS
    );
    let origin = request.headers().get(header::ORIGIN).cloned();
    let path = request.uri().path().to_owned();
    let preflight = request.method() == axum::http::Method::OPTIONS;
    // Auth routes are limited per path by the auth pipeline instead.
    let exempt = preflight
        || path == "/api/v1/health"
        || path.starts_with("/api/v1/images/")
        || path.starts_with("/api/auth/");
    let limited = if rejection.is_none() && state.config.production && !exempt {
        state
            .limits
            .check(format!("{}:api", client_ip(request.headers())), 180, 60)
            .await
    } else {
        None
    };
    let import = path == "/api/v1/collection/import";
    if unsafe_method
        && rejection.is_none()
        && limited.is_none()
        && import
        && let Err(error) = crate::auth::service::require_session(&state, request.headers()).await
    {
        rejection = Some(error);
    }
    // Auth bodies are capped at 64 KiB, so only larger API bodies share the buffering slots.
    let slots = if import {
        &state.import_slots
    } else {
        &state.body_slots
    };
    let _body_permit = if unsafe_method
        && rejection.is_none()
        && limited.is_none()
        && !path.starts_with("/api/auth/")
    {
        match slots.try_acquire() {
            Ok(permit) => Some(permit),
            Err(_) => {
                rejection = Some(AppError::new(503, "BUSY", "Please retry shortly"));
                None
            }
        }
    } else {
        None
    };
    let mut response = if let Some(error) = rejection {
        error.into_response()
    } else if let Some(retry) = limited {
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
        let client = client_ip(request.headers());
        crate::upstream::CLIENT
            .scope(client, next.run(request))
            .await
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
        && origin
            .to_str()
            .is_ok_and(|origin| state.config.origin_allowed(origin))
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
                axum::http::HeaderValue::from_static(
                    "Content-Type, Authorization, Cookie, X-Astral-Request",
                ),
            );
        }
    }
    response
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    #[test]
    fn forwarding_requires_trusted_peers_and_stops_at_the_first_untrusted_hop() {
        let peer = "10.0.0.2".parse().unwrap();
        let trusted = ["10.0.0.0/24".parse().unwrap()];
        let mut headers = HeaderMap::new();
        headers.insert("x-real-ip", "203.0.113.9".parse().unwrap());
        headers.insert(
            "x-forwarded-for",
            "198.51.100.66, 192.0.2.1, 10.0.0.3".parse().unwrap(),
        );
        assert_eq!(forwarded_ip(peer, &headers, &[]), peer);
        assert_eq!(
            forwarded_ip(peer, &headers, &trusted).to_string(),
            "192.0.2.1"
        );
        for raw in ["forged", "192.0.2.1, not-an-ip", ""] {
            headers.insert("x-forwarded-for", raw.parse().unwrap());
            assert_eq!(forwarded_ip(peer, &headers, &trusted), peer);
        }
        headers.insert("x-forwarded-for", "not-an-ip, 192.0.2.7".parse().unwrap());
        assert_eq!(
            forwarded_ip(peer, &headers, &trusted).to_string(),
            "192.0.2.7"
        );
        headers.insert("x-forwarded-for", "198.51.100.66".parse().unwrap());
        headers.append("x-forwarded-for", "192.0.2.8".parse().unwrap());
        assert_eq!(
            forwarded_ip(peer, &headers, &trusted).to_string(),
            "192.0.2.8"
        );
        let mapped = "::ffff:10.0.0.2".parse().unwrap();
        assert_eq!(
            forwarded_ip(mapped, &headers, &trusted).to_string(),
            "192.0.2.8"
        );
        headers.insert(
            "x-forwarded-for",
            vec!["10.0.0.4"; 17].join(",").parse().unwrap(),
        );
        assert_eq!(
            forwarded_ip(peer, &headers, &trusted).to_string(),
            "10.0.0.4"
        );
    }
    #[test]
    fn limiter_identity_is_validated_and_ipv6_uses_a_subnet() {
        for (input, expected) in [
            ("bad:header", "unknown"),
            ("::ffff:192.0.2.1", "192.0.2.1"),
            ("2001:db8:1:2::abcd", "2001:db8:1:2::"),
            ("192.0.2.1", "192.0.2.1"),
        ] {
            let mut headers = HeaderMap::new();
            headers.insert("x-real-ip", input.parse().unwrap());
            assert_eq!(client_ip(&headers), expected);
        }
    }
    #[tokio::test]
    async fn saturated_limits_serve_new_keys_and_keep_recently_attacked_budgets() {
        let limits = Limits::default();
        assert_eq!(limits.rolling("attacked".into(), 1, 600).await, None);
        for index in 1..MAX_BUCKETS {
            assert_eq!(limits.check(index.to_string(), 1, 60).await, None);
        }
        assert_eq!(limits.check("new".into(), 1, 60).await, None);
        assert!(limits.rolling("attacked".into(), 1, 600).await.is_some());
        assert!(limits.check("new".into(), 1, 60).await.is_some());
        assert!(limits.0.lock().await.entries.len() < MAX_BUCKETS);
        assert!(limits.exhausted("attacked", 1).await);
        assert!(!limits.exhausted("missing", 1).await);
    }
    #[tokio::test]
    async fn long_keys_are_charged_and_exhausted_like_short_ones() {
        let limits = Limits::default();
        let account = format!("sign-in:{}@example.com", "a".repeat(244));
        assert!(account.len() > 256);
        for _ in 0..2 {
            assert_eq!(limits.rolling(account.clone(), 2, 900).await, None);
        }
        assert!(limits.exhausted(&account, 2).await);
        assert!(limits.rolling(account.clone(), 2, 900).await.is_some());
        assert!(!limits.exhausted(&format!("{account}x"), 2).await);
        assert!(
            limits
                .0
                .lock()
                .await
                .entries
                .keys()
                .all(|key| key.len() <= 256)
        );
    }
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
