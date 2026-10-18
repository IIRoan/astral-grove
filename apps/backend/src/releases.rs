use crate::AppState;
use axum::{
    extract::{Path, RawQuery, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use hmac::{KeyInit, Mac};
use serde_json::json;
use std::{sync::Arc, time::Duration};
use subtle::ConstantTimeEq;
use utoipa_axum::{router::OpenApiRouter, routes};
fn file(filename: &str) -> Option<(String, &'static str, &'static str, &'static str)> {
    for profile in ["development", "preview"] {
        for (kind, suffix, content_type) in [
            ("ipa", ".ipa", "application/octet-stream"),
            ("apk", ".apk", "application/vnd.android.package-archive"),
            ("plist", ".plist", "application/xml"),
            ("page", ".html", "text/html; charset=utf-8"),
            ("qr", "-qr.png", "image/png"),
        ] {
            if filename == format!("{profile}{suffix}") {
                return Some((format!("releases/{filename}"), profile, kind, content_type));
            }
        }
    }
    None
}
fn authorized(secret: &str, key: &str, token: Option<&str>) -> bool {
    let Some(token) = token.filter(|value| value.len() == 64) else {
        return false;
    };
    let Ok(mut mac) = <hmac::Hmac<sha2::Sha256> as KeyInit>::new_from_slice(secret.as_bytes())
    else {
        return false;
    };
    mac.update(format!("astral-grove:internal-release:{key}").as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());
    bool::from(expected.as_bytes().ct_eq(token.as_bytes()))
}
async fn serve(state: &AppState, filename: &str, query: Option<&str>, head: bool) -> Response {
    let unavailable = || {
        (
            StatusCode::NOT_FOUND,
            [(header::CACHE_CONTROL, "no-store")],
            axum::Json(json!({"error":"NOT_FOUND","message":"Build unavailable"})),
        )
            .into_response()
    };
    let Some((key, profile, kind, content_type)) = file(filename) else {
        return unavailable();
    };
    let Some(storage) = &state.images.storage else {
        return unavailable();
    };
    let Some(secret) = state.config.values.get("S3_SECRET_ACCESS_KEY") else {
        return unavailable();
    };
    let token = url::form_urlencoded::parse(query.unwrap_or("").as_bytes())
        .find(|(key, _)| key == "token")
        .map(|(_, value)| value.into_owned());
    if !authorized(secret, &key, token.as_deref()) || !storage.exists(&key).await {
        return unavailable();
    }
    if matches!(kind, "page" | "plist") {
        let content = if head {
            Vec::new()
        } else {
            let Some((body, _)) = storage.read(&key, 10 * 1024 * 1024).await else {
                return unavailable();
            };
            body
        };
        return (
            [
                (header::CONTENT_TYPE, content_type),
                (header::CACHE_CONTROL, "no-store"),
                (header::REFERRER_POLICY, "no-referrer"),
            ],
            content,
        )
            .into_response();
    }
    let disposition = matches!(kind, "apk" | "ipa")
        .then(|| format!("attachment; filename=\"astral-grove-{profile}.{kind}\""));
    let url = storage.presign(
        &key,
        head,
        Duration::from_secs(3600).as_secs(),
        Some(content_type),
        disposition.as_deref(),
    );
    (
        StatusCode::FOUND,
        [
            (header::LOCATION, url.to_string()),
            (header::CACHE_CONTROL, "no-store".into()),
        ],
    )
        .into_response()
}
#[utoipa::path(get,path="/api/v1/releases/{filename}",operation_id="downloadInternalRelease",responses((status=200,body=String),(status=302),(status=404)))]
async fn get(
    State(state): State<Arc<AppState>>,
    Path(filename): Path<String>,
    RawQuery(query): RawQuery,
) -> Response {
    serve(&state, &filename, query.as_deref(), false).await
}
#[utoipa::path(head,path="/api/v1/releases/{filename}",operation_id="headInternalRelease",responses((status=200),(status=302),(status=404)))]
async fn head(
    State(state): State<Arc<AppState>>,
    Path(filename): Path<String>,
    RawQuery(query): RawQuery,
) -> Response {
    serve(&state, &filename, query.as_deref(), true).await
}
pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new().routes(routes!(get, head))
}
