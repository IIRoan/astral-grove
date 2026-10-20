use crate::{
    AppState,
    cache::TtlCache,
    config::Config,
    error::{AppError, Result},
    http,
    middleware::Limits,
};
use axum::{
    body::Body,
    extract::{Path, RawQuery, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use rusty_s3::{Bucket, Credentials, S3Action, UrlStyle};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::{Mutex, Semaphore};
use utoipa_axum::{router::OpenApiRouter, routes};

const MAX_IMAGE: usize = 5 * 1024 * 1024;
const MAX_MEMORY: usize = 128 * 1024 * 1024;
const BODY_CACHE: &str = "public, max-age=604800, immutable";
#[derive(Clone)]
struct Cached {
    bytes: axum::body::Bytes,
    content_type: String,
    etag: String,
}
pub struct Storage {
    bucket: Bucket,
    credentials: Credentials,
    client: reqwest_middleware::ClientWithMiddleware,
}
impl Storage {
    pub fn new(
        config: &Config,
        client: reqwest_middleware::ClientWithMiddleware,
    ) -> anyhow::Result<Option<Self>> {
        let keys = [
            "S3_ACCESS_KEY_ID",
            "S3_SECRET_ACCESS_KEY",
            "S3_BUCKET",
            "S3_ENDPOINT",
        ];
        if !keys.iter().all(|key| {
            config
                .values
                .get(*key)
                .is_some_and(|value| !value.is_empty())
        }) {
            return Ok(None);
        }
        let get = |key: &str| config.values.get(key).map(String::as_str).unwrap_or("");
        let bucket = Bucket::new(
            url::Url::parse(get("S3_ENDPOINT"))?,
            UrlStyle::Path,
            get("S3_BUCKET").to_owned(),
            config
                .values
                .get("S3_REGION")
                .or_else(|| config.values.get("AWS_REGION"))
                .cloned()
                .unwrap_or("us-east-1".into()),
        )?;
        Ok(Some(Self {
            bucket,
            credentials: Credentials::new(get("S3_ACCESS_KEY_ID"), get("S3_SECRET_ACCESS_KEY")),
            client,
        }))
    }
    pub fn presign(
        &self,
        key: &str,
        head: bool,
        seconds: u64,
        content_type: Option<&str>,
        disposition: Option<&str>,
    ) -> url::Url {
        fn sign<'a>(
            mut action: impl S3Action<'a>,
            seconds: u64,
            content_type: Option<&'a str>,
            disposition: Option<&'a str>,
        ) -> url::Url {
            if let Some(value) = content_type {
                action.query_mut().insert("response-content-type", value);
            }
            if let Some(value) = disposition {
                action
                    .query_mut()
                    .insert("response-content-disposition", value);
            }
            action.sign(Duration::from_secs(seconds))
        }
        if head {
            let action = self.bucket.head_object(Some(&self.credentials), key);
            sign(action, seconds, content_type, disposition)
        } else {
            let action = self.bucket.get_object(Some(&self.credentials), key);
            sign(action, seconds, content_type, disposition)
        }
    }
    pub async fn exists(&self, key: &str) -> bool {
        self.client
            .head(self.presign(key, true, 60, None, None))
            .send()
            .await
            .is_ok_and(|r| r.status().is_success())
    }
    pub async fn read(&self, key: &str, cap: usize) -> Option<(Vec<u8>, String)> {
        let response = self
            .client
            .get(self.presign(key, false, 60, None, None))
            .send()
            .await
            .ok()?;
        if !response.status().is_success() {
            return None;
        }
        let content_type = response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_owned();
        Some((capped(response, cap).await?, content_type))
    }
    async fn write(&self, key: &str, bytes: Vec<u8>, content_type: &str) -> bool {
        let url = self
            .bucket
            .put_object(Some(&self.credentials), key)
            .sign(Duration::from_secs(60));
        match self
            .client
            .put(url)
            .header(header::CONTENT_TYPE, content_type)
            .body(bytes)
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => true,
            _ => {
                tracing::warn!(category = "image-storage", "Object write failed");
                false
            }
        }
    }
}
pub async fn capped(mut response: reqwest::Response, cap: usize) -> Option<Vec<u8>> {
    if response
        .content_length()
        .is_some_and(|length| length > cap as u64)
    {
        return None;
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.ok()? {
        if bytes.len() + chunk.len() > cap {
            return None;
        }
        bytes.extend_from_slice(&chunk);
    }
    if bytes.is_empty() { None } else { Some(bytes) }
}
pub struct ImageStore {
    pub storage: Option<Arc<Storage>>,
    client: reqwest_middleware::ClientWithMiddleware,
    cache: Mutex<TtlCache<Cached>>,
    misses: Arc<Mutex<HashMap<String, Instant>>>,
    uploads: crate::tasks::Tasks,
    pending_uploads: Arc<std::sync::Mutex<HashSet<String>>>,
    locks: Mutex<HashMap<String, std::sync::Weak<Mutex<()>>>>,
    rate: Limits,
    resize: Arc<Semaphore>,
    resize_queue: Arc<Semaphore>,
    cdn: String,
}

struct PendingUpload {
    key: String,
    pending: Arc<std::sync::Mutex<HashSet<String>>>,
}
impl Drop for PendingUpload {
    fn drop(&mut self) {
        self.pending
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .remove(&self.key);
    }
}

impl ImageStore {
    pub fn new(
        config: &Config,
        client: reqwest_middleware::ClientWithMiddleware,
    ) -> anyhow::Result<Self> {
        Ok(Self {
            storage: Storage::new(config, client.clone())?.map(Arc::new),
            client,
            cache: Mutex::new(TtlCache::new(
                Duration::from_secs(86400),
                2000,
                Some(MAX_MEMORY),
            )),
            misses: Arc::new(Mutex::new(HashMap::new())),
            uploads: crate::tasks::Tasks::new(8),
            pending_uploads: Default::default(),
            locks: Mutex::new(HashMap::new()),
            rate: Limits::default(),
            resize: Arc::new(Semaphore::new(2)),
            resize_queue: Arc::new(Semaphore::new(8)),
            cdn: config
                .values
                .get("IMAGE_CDN_BASE_URL")
                .cloned()
                .unwrap_or("https://cdn.piltoverarchive.com".into())
                .trim_end_matches('/')
                .into(),
        })
    }

    pub(crate) async fn drain(&self) {
        self.uploads.drain().await;
    }

    fn store(&self, key: &str, bytes: &[u8], content_type: &str) {
        let Some(storage) = self.storage.clone() else {
            return;
        };
        if !self
            .pending_uploads
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .insert(key.into())
        {
            return;
        }
        let pending = PendingUpload {
            key: key.into(),
            pending: self.pending_uploads.clone(),
        };
        let misses = self.misses.clone();
        let content_type = content_type.to_owned();
        let bytes = bytes.to_vec();
        self.uploads.spawn(async move {
            if storage.write(&pending.key, bytes, &content_type).await {
                misses.lock().await.remove(&pending.key);
            }
        });
    }

    async fn allow_cdn(&self, ip: &str) -> bool {
        self.rate.check(format!("ip:{ip}"), 120, 60).await.is_none()
            && self.rate.check("global".into(), 600, 60).await.is_none()
    }
    async fn load(&self, key: &str, ip: &str) -> Option<(Vec<u8>, String, &'static str)> {
        if self
            .misses
            .lock()
            .await
            .get(key)
            .is_none_or(|time| *time < Instant::now())
            && let Some(storage) = &self.storage
        {
            if let Some((body, content_type)) = storage.read(key, MAX_IMAGE).await {
                return Some((body, safe_type(&content_type, key), "s3"));
            }
            let mut misses = self.misses.lock().await;
            if misses.len() >= 5000 {
                misses.clear();
            }
            misses.insert(key.into(), Instant::now() + Duration::from_secs(60));
        }
        if !self.allow_cdn(ip).await {
            return None;
        }
        let response = self
            .client
            .get(format!("{}/{key}", self.cdn))
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .ok()?;
        if !response.status().is_success() {
            return None;
        }
        let content_type = safe_type(
            response
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or(""),
            key,
        );
        let bytes = capped(response, MAX_IMAGE).await?;
        self.store(key, &bytes, &content_type);
        Some((bytes, content_type, "memory"))
    }
    async fn serve(
        &self,
        key: &str,
        width: Option<u32>,
        ip: &str,
    ) -> Result<Option<(Cached, &'static str)>> {
        let width = width.filter(|_| key.starts_with("cards/"));
        let storage_key = width.map_or_else(|| key.into(), |w| format!("thumbs/w{w}/{key}"));
        if let Some(cached) = self.cache.lock().await.get(&storage_key).cloned() {
            return Ok(Some((cached, "memory")));
        }
        let lock = {
            let mut locks = self.locks.lock().await;
            locks.retain(|_, weak| weak.strong_count() > 0);
            match locks.get(&storage_key).and_then(std::sync::Weak::upgrade) {
                Some(lock) => lock,
                None => {
                    let lock = Arc::new(Mutex::new(()));
                    locks.insert(storage_key.clone(), Arc::downgrade(&lock));
                    lock
                }
            }
        };
        let _guard = lock.lock().await;
        if let Some(cached) = self.cache.lock().await.get(&storage_key).cloned() {
            return Ok(Some((cached, "memory")));
        }
        let mut loaded = None;
        if width.is_some()
            && let Some(storage) = &self.storage
            && let Some((bytes, content_type)) = storage.read(&storage_key, MAX_IMAGE).await
        {
            loaded = Some((bytes, safe_type(&content_type, &storage_key), "s3"));
        }
        let derivative_loaded = loaded.is_some();
        let (mut bytes, mut content_type, mut source) = match loaded {
            Some(loaded) => loaded,
            None => match self.load(key, ip).await {
                Some(value) => value,
                None => return Ok(None),
            },
        };
        let mut actual_key = storage_key.clone();
        if width.is_some()
            && !derivative_loaded
            && let Some(width) = width
        {
            let encoded = if let Ok(queued) = self.resize_queue.clone().try_acquire_owned() {
                let permit = self
                    .resize
                    .clone()
                    .acquire_owned()
                    .await
                    .map_err(|_| AppError::internal())?;
                let original = bytes.clone();
                let result = tokio::task::spawn_blocking(move || {
                    let _permit = permit;
                    let _queued = queued;
                    resize(original, width)
                })
                .await
                .map_err(|_| AppError::internal())?
                .ok_or_else(AppError::internal)?;
                Some(result)
            } else {
                None
            };
            if let Some(encoded) = encoded {
                bytes = encoded;
                content_type = "image/webp".into();
                source = "memory";
                self.store(&storage_key, &bytes, &content_type);
            } else {
                actual_key = key.into();
            }
        }
        let cached = Cached {
            etag: format!("\"{}:{}\"", actual_key, bytes.len()),
            bytes: bytes.into(),
            content_type,
        };
        let size = cached.bytes.len();
        self.cache
            .lock()
            .await
            .insert(actual_key, cached.clone(), size);
        Ok(Some((cached, source)))
    }
}
fn resize(bytes: Vec<u8>, width: u32) -> Option<Vec<u8>> {
    use image::{ImageDecoder, ImageReader};
    let reader = ImageReader::new(std::io::Cursor::new(bytes))
        .with_guessed_format()
        .ok()?;
    let mut decoder = reader.into_decoder().ok()?;
    let (pixel_width, pixel_height) = decoder.dimensions();
    if u64::from(pixel_width) * u64::from(pixel_height) > 268_402_689 {
        return None;
    }
    let orientation = decoder.orientation().ok();
    let mut decoded = image::DynamicImage::from_decoder(decoder).ok()?;
    if let Some(orientation) = orientation {
        decoded.apply_orientation(orientation);
    }
    let height =
        (u64::from(decoded.height()) * u64::from(width) / u64::from(decoded.width())).max(1) as u32;
    if decoded.width() > width {
        decoded = decoded.resize_exact(width, height, image::imageops::FilterType::Lanczos3);
    }
    let pixels = decoded.to_rgba8();
    webp::Encoder::from_rgba(&pixels, decoded.width(), decoded.height())
        .encode_simple(false, 78.0)
        .ok()
        .map(|value| value.to_vec())
}
pub fn safe_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= 1024
        && !key.contains(['%', '?', '#', '\\'])
        && !key.chars().any(char::is_control)
        && key
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
        && !key.to_ascii_lowercase().ends_with(".svg")
        && (key.starts_with("cards/") || key.starts_with("colors/"))
}
fn safe_type(raw: &str, key: &str) -> String {
    let normalized = raw.split(';').next().unwrap_or("").trim().to_lowercase();
    if !normalized.is_empty()
        && !["svg", "html", "javascript", "xml"]
            .iter()
            .any(|value| normalized.contains(value))
    {
        return normalized;
    }
    match key
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "webp" => "image/webp",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        _ => "application/octet-stream",
    }
    .into()
}
pub fn rewrite(state: &AppState, value: &mut Value) {
    if state.images.storage.is_none() {
        return;
    }
    if let Some(text) = value.as_str()
        && let Ok(url) = url::Url::parse(text)
    {
        let key = url.path().trim_start_matches('/');
        if safe_key(key) {
            *value = Value::String(format!(
                "{}/api/v1/images/{key}",
                state.config.auth_url.as_str().trim_end_matches('/')
            ));
        }
    }
}
pub fn rewrite_all(state: &AppState, value: &mut Value) {
    match value {
        Value::Object(object) => {
            for (key, value) in object {
                if key == "imageUrl" {
                    rewrite(state, value);
                } else {
                    rewrite_all(state, value);
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(|value| rewrite_all(state, value)),
        _ => {}
    }
}
#[utoipa::path(get,path="/api/v1/images/{*key}",operation_id="getImage",responses((status=200,content_type="image/webp"),(status=302),(status=304),(status=404)))]
async fn get_image(
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Result<Response> {
    if !safe_key(&key) {
        return Err(AppError::not_found("Image not found"));
    }
    let input: astral_grove_api_types::ImageThumbQuery =
        http::parse("ImageThumbQuery", &http::query(query.as_deref()))?;
    let ip = crate::middleware::client_ip(&headers);
    if let Some((image, source)) = state
        .images
        .serve(&key, input.w.map(|width| width as u32), &ip)
        .await?
    {
        let matched = headers
            .get(header::IF_NONE_MATCH)
            .is_some_and(|value| value.as_bytes() == image.etag.as_bytes());
        let mut response = if matched {
            StatusCode::NOT_MODIFIED.into_response()
        } else {
            (
                [(header::CONTENT_TYPE, image.content_type)],
                Body::from(image.bytes.clone()),
            )
                .into_response()
        };
        let response_headers = response.headers_mut();
        response_headers.insert(
            header::ETAG,
            image.etag.parse().map_err(|_| AppError::internal())?,
        );
        response_headers.insert(
            header::CACHE_CONTROL,
            BODY_CACHE.parse().map_err(|_| AppError::internal())?,
        );
        response_headers.insert(
            "x-image-source",
            source.parse().map_err(|_| AppError::internal())?,
        );
        return Ok(response);
    }
    if input.w.is_some() {
        return Err(AppError::not_found("Image not found"));
    }
    Ok((
        StatusCode::FOUND,
        [
            (header::LOCATION, format!("{}/{key}", state.images.cdn)),
            (header::CACHE_CONTROL, "public, max-age=300".into()),
            (
                header::HeaderName::from_static("x-image-source"),
                "cdn-redirect".into(),
            ),
        ],
    )
        .into_response())
}
pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new().routes(routes!(get_image))
}

#[cfg(test)]
mod security_tests {
    use super::*;
    #[test]
    fn image_paths_cannot_change_the_cdn_path_or_url_parts() {
        for key in [
            "cards/.%2e/private.png",
            "cards/%252e%252e/private.png",
            "cards/../x.png",
            "cards/./x.png",
            "cards/x.png?key=y",
            "cards/x.png#x",
            "cards/x\\y.png",
            "cards//x.png",
            "cards/x.svg",
            "other/x.png",
            "cards/x\n.png",
        ] {
            assert!(!safe_key(key), "{key}");
        }
        for key in [
            "cards/OGN/001.webp",
            "colors/fury.png",
            "cards/card image.png",
        ] {
            assert!(safe_key(key), "{key}");
        }
    }
}
