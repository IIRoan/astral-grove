mod api_docs;
pub mod auth;
pub mod cache;
pub mod cardmarket;
pub mod catalog;
pub mod cli;
mod cli_audit;
mod cli_search;
pub mod collection;
pub mod config;
pub mod db;
pub mod deck_rules;
pub mod decks;
pub mod error;
pub mod http;
pub mod images;
pub mod instant;
pub mod middleware;
mod migrations;
pub mod prices;
pub mod releases;
pub mod search;
pub mod sync;
mod tasks;
pub mod upstream;
pub mod user_data;

use astral_grove_api_types::{HealthResponse, HealthResponseData};
use axum::{Json, extract::State};
use sea_orm::{ConnectionTrait, DatabaseConnection};
use std::sync::Arc;
use utoipa::OpenApi;
use utoipa_axum::{router::OpenApiRouter, routes};

pub struct AppState {
    pub config: config::Config,
    pub db: DatabaseConnection,
    pub client: reqwest::Client,
    pub images: images::ImageStore,
    pub catalog: catalog::query::Cache,
    pub limits: middleware::Limits,
    pub live: Arc<collection::live::Hub>,
    pub shutdown: tokio::sync::watch::Sender<bool>,
    pub probe: Arc<tokio::sync::Mutex<()>>,
    pub catalog_sync: tokio::sync::Mutex<()>,
    pub price_sync: tokio::sync::Mutex<()>,
    tasks: tasks::Tasks,
}
impl AppState {
    pub async fn connect(config: config::Config) -> anyhow::Result<Arc<Self>> {
        Self::connect_with_migrations(config, true).await
    }
    pub async fn connect_with_migrations(
        config: config::Config,
        migrate: bool,
    ) -> anyhow::Result<Arc<Self>> {
        let attempts = if config.production { 12 } else { 5 };
        let mut attempt = 0;
        let database = loop {
            attempt += 1;
            let result = async {
                let database = db::connect(&config.database_url, config.pool_max).await?;
                if migrate && let Err(error) = db::migrate(&database).await {
                    let _ = database.close().await;
                    return Err(error);
                }
                Ok::<_, sea_orm::DbErr>(database)
            }
            .await;
            match result {
                Ok(database) => break database,
                Err(error) if attempt < attempts && db::transient(&error) => {
                    tracing::warn!(
                        attempt,
                        attempts,
                        "Database connection interrupted during migration; retrying"
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(attempt.min(5))).await;
                }
                Err(error) => return Err(error.into()),
            }
        };
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        let images = images::ImageStore::new(&config, client.clone())?;
        Ok(Arc::new(Self {
            config,
            db: database,
            client,
            images,
            catalog: Default::default(),
            limits: Default::default(),
            live: Default::default(),
            shutdown: tokio::sync::watch::channel(false).0,
            probe: Default::default(),
            catalog_sync: Default::default(),
            price_sync: Default::default(),
            tasks: tasks::Tasks::new(8),
        }))
    }

    pub async fn drain(&self) {
        self.shutdown.send_replace(true);
        self.tasks.drain().await;
        self.images.drain().await;
    }
}

#[utoipa::path(get, path = "/api/v1/health", operation_id = "getHealth", responses((status = 200, body = HealthResponse)))]
async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let db_ok = state.db.execute_unprepared("SELECT 1").await.is_ok();
    let last = db::rows(&state.db, "SELECT to_char(last_success_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS value FROM sync_state WHERE key='catalog'", vec![]).await.ok().and_then(|rows| rows.first().and_then(|row| row["value"].as_str().map(str::to_owned)));
    Json(HealthResponse {
        data: HealthResponseData {
            status: "ok".into(),
            db: if db_ok {
                astral_grove_api_types::HealthResponseDataDb::Ok
            } else {
                astral_grove_api_types::HealthResponseDataDb::Error
            },
            last_catalog_sync: last,
            email_verification_required: state.config.email_enabled(),
        },
    })
}

fn api() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(health))
        .merge(auth::routes::router())
        .merge(collection::routes::router())
        .merge(collection::share::router())
        .merge(user_data::router())
        .merge(images::router())
        .merge(deck_rules::router())
        .merge(prices::router())
        .merge(catalog::routes::router())
        .merge(catalog::metadata::router())
        .merge(sync::router())
        .merge(decks::routes::router())
        .merge(releases::router())
        .routes(routes!(root))
}
pub fn router(state: Arc<AppState>) -> axum::Router {
    let router = api()
        .split_for_parts()
        .0
        .route_layer(axum::middleware::from_fn(http::input_layer))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth::pipeline::auth_only,
        ))
        .fallback(|| async { error::AppError::not_found("Not found") })
        .layer(axum::extract::DefaultBodyLimit::max(128 * 1024 * 1024))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::apply,
        ))
        .layer(tower_http::compression::CompressionLayer::new())
        .with_state(state);
    use tower::Layer;
    axum::Router::new().fallback_service(
        tower_http::normalize_path::NormalizePathLayer::trim_trailing_slash().layer(router),
    )
}
#[expect(
    clippy::expect_used,
    reason = "OpenAPI serializes generated static schemas"
)]
pub fn openapi() -> serde_json::Value {
    #[derive(OpenApi)]
    #[openapi(
        info(title = "The Astral Grove API", version = "1"),
        components(schemas(
            astral_grove_api_types::auth::User,
            astral_grove_api_types::auth::Session,
            astral_grove_api_types::auth::SessionResponse,
            astral_grove_api_types::auth::SignInResponse,
            astral_grove_api_types::auth::SignUpResponse
        ))
    )]
    struct Api;
    let mut document = Api::openapi();
    document.merge(astral_grove_api_types::ContractSchemas::openapi());
    document.merge(api().split_for_parts().1);
    let mut value = serde_json::to_value(document).expect("OpenAPI serializes");
    for name in http::schemas::NAMES {
        value["components"]["schemas"][*name] = http::schemas::schema(name).json_schema(true);
        value["components"]["schemas"][format!("{name}Input")] =
            http::schemas::schema(name).json_schema(false);
    }
    auth::document(&mut value);
    fn request_input(value: &mut serde_json::Value, names: &[&str]) {
        match value {
            serde_json::Value::Object(values) => {
                if let Some(serde_json::Value::String(reference)) = values.get_mut("$ref")
                    && let Some(name) = reference.strip_prefix("#/components/schemas/")
                    && names.contains(&name)
                {
                    reference.push_str("Input");
                }
                for value in values.values_mut() {
                    request_input(value, names)
                }
            }
            serde_json::Value::Array(values) => {
                for value in values {
                    request_input(value, names)
                }
            }
            _ => {}
        }
    }
    if let Some(paths) = value["paths"].as_object_mut() {
        for path in paths.values_mut() {
            if let Some(operations) = path.as_object_mut() {
                for operation in operations.values_mut() {
                    if let Some(body) = operation.get_mut("requestBody") {
                        request_input(body, http::schemas::NAMES);
                    }
                }
            }
        }
    }
    if let Some(paths) = value["paths"].as_object_mut()
        && let Some(image) = paths.remove("/api/v1/images/{*key}")
    {
        paths.insert("/api/v1/images/{key}".into(), image);
    }

    api_docs::complete(&mut value);
    value
}

#[utoipa::path(get,path="/",operation_id="root",responses((status=200,body=serde_json::Value)))]
async fn root() -> Json<serde_json::Value> {
    Json(
        serde_json::json!({"name":"astral-grove-api","health":"/api/v1/health","auth":"/api/auth"}),
    )
}
