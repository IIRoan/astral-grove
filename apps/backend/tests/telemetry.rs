#![expect(
    clippy::unwrap_used,
    reason = "Failed test assertions must stop the probe immediately"
)]

use astral_grove_server::{db, telemetry};
use axum::{
    Router,
    body::Body,
    http::{HeaderMap, Request},
    routing::get,
};
use opentelemetry::{
    global,
    trace::{SpanKind, Status, TracerProvider as _},
};
use opentelemetry_sdk::{
    error::OTelSdkResult,
    propagation::TraceContextPropagator,
    trace::{SdkTracerProvider, SpanData, SpanExporter},
};
use sea_orm::{ConnectionTrait, DbBackend, Statement, TransactionTrait};
use std::sync::{Arc, Mutex};
use tower::ServiceExt;
use tracing_subscriber::{Layer as _, layer::SubscriberExt};

#[derive(Clone, Debug, Default)]
struct Capture(Arc<Mutex<Vec<SpanData>>>);
impl SpanExporter for Capture {
    async fn export(&self, batch: Vec<SpanData>) -> OTelSdkResult {
        self.0.lock().unwrap().extend(batch);
        Ok(())
    }
}

#[test]
#[ignore = "requires TEST_DB_URL naming a loopback riftbound_test database"]
fn traces_join_the_edge_and_cover_postgres_transactions_and_http_without_secrets()
-> anyhow::Result<()> {
    let database_url = std::env::var("TEST_DB_URL")?;
    let url = url::Url::parse(&database_url)?;
    anyhow::ensure!(
        matches!(url.scheme(), "postgres" | "postgresql")
            && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))
            && (url.path() == "/riftbound_test"
                || url
                    .path()
                    .strip_prefix("/riftbound_test_")
                    .is_some_and(|suffix| !suffix.is_empty()
                        && suffix
                            .bytes()
                            .all(|c| c.is_ascii_alphanumeric() || c == b'_'))),
        "Only a loopback riftbound_test database is allowed"
    );
    let capture = Capture::default();
    let provider = SdkTracerProvider::builder()
        .with_simple_exporter(capture.clone())
        .build();
    global::set_tracer_provider(provider.clone());
    global::set_text_map_propagator(TraceContextPropagator::new());
    let subscriber = tracing_subscriber::registry().with(
        tracing_opentelemetry::layer()
            .with_tracer(provider.tracer("test.http"))
            .with_filter(
                tracing_subscriber::filter::Targets::new()
                    .with_target("astral_grove_server", tracing::Level::INFO),
            ),
    );
    let _subscriber = tracing::subscriber::set_default(subscriber);
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?
        .block_on(async {
            let database = db::connect(&database_url, 2).await?;
            let propagated = Arc::new(Mutex::new(Vec::<String>::new()));
            let headers_seen = propagated.clone();
            let upstream = Router::new().route(
                "/",
                get(move |headers: HeaderMap| {
                    let headers_seen = headers_seen.clone();
                    async move {
                        headers_seen.lock().unwrap().push(
                            headers
                                .get("traceparent")
                                .unwrap()
                                .to_str()
                                .unwrap()
                                .to_owned(),
                        );
                        "ok"
                    }
                }),
            );
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
            let address = listener.local_addr()?;
            let server = tokio::spawn(async move { axum::serve(listener, upstream).await });
            let client = reqwest_middleware::ClientBuilder::new(reqwest::Client::new())
                .with(telemetry::HttpTracing)
                .build();
            let connection = database.clone();
            let app = Router::new()
                .route(
                    "/probe/{id}",
                    get(move || {
                        let connection = connection.clone();
                        let client = client.clone();
                        async move {
                            db::rows(
                                &connection,
                                "SELECT $1::text AS secret",
                                vec!["synthetic-sql-secret".into()],
                            )
                            .await
                            .unwrap();
                            let tx = connection.begin().await.unwrap();
                            tx.query_all_raw(Statement::from_string(
                                DbBackend::Postgres,
                                "SELECT 1",
                            ))
                            .await
                            .unwrap();
                            tx.commit().await.unwrap();
                            assert!(db::rows(&connection, "SELECT 1 / 0", vec![]).await.is_err());
                            client
                                .get(format!("http://{address}/?token=synthetic-http-secret"))
                                .basic_auth("synthetic-user", Some("synthetic-password"))
                                .send()
                                .await
                                .unwrap();
                            "ok"
                        }
                    }),
                )
                .layer(axum::middleware::from_fn(telemetry::incoming));
            for flags in ["01", "00"] {
                let response = app
                    .clone()
                    .oneshot(
                        Request::builder()
                            .uri("/probe/synthetic-path-secret?token=synthetic-query-secret")
                            .header(
                                "traceparent",
                                format!(
                                    "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-{flags}"
                                ),
                            )
                            .body(Body::empty())?,
                    )
                    .await?;
                assert_eq!(response.status(), 200);
            }
            server.abort();
            database.close().await?;
            let spans = capture.0.lock().unwrap();
            let server = spans
                .iter()
                .find(|span| span.span_kind == SpanKind::Server)
                .unwrap();
            assert_eq!(server.name, "GET /probe/{id}");
            assert_eq!(
                server.span_context.trace_id().to_string(),
                "4bf92f3577b34da6a3ce929d0e0e4736"
            );
            assert_eq!(server.parent_span_id.to_string(), "00f067aa0ba902b7");
            assert!(server.parent_span_is_remote);
            assert_eq!(
                spans
                    .iter()
                    .filter(|span| span.span_kind == SpanKind::Server)
                    .count(),
                1
            );
            let queries = spans
                .iter()
                .filter(|span| span.instrumentation_scope.name() == "astral-grove.sea-orm")
                .collect::<Vec<_>>();
            assert_eq!(queries.len(), 3);
            assert_eq!(
                queries
                    .iter()
                    .filter(|span| matches!(span.status, Status::Error { .. }))
                    .count(),
                1
            );
            for span in &queries {
                assert_eq!(span.span_kind, SpanKind::Client);
                assert_eq!(span.parent_span_id, server.span_context.span_id());
                assert!(
                    span.attributes
                        .iter()
                        .any(|a| a.key.as_str() == "db.namespace"
                            && a.value.to_string() == url.path().trim_start_matches('/'))
                );
                assert!(
                    span.attributes
                        .iter()
                        .any(|a| a.key.as_str() == "db.operation.name"
                            && matches!(a.value.to_string().as_str(), "SELECT" | "WITH"))
                );
                assert!(span.end_time >= span.start_time);
            }
            let outgoing = spans
                .iter()
                .find(|span| {
                    span.span_kind == SpanKind::Client
                        && span.instrumentation_scope.name() == "test.http"
                })
                .unwrap();
            assert_eq!(outgoing.parent_span_id, server.span_context.span_id());
            assert_eq!(
                propagated.lock().unwrap()[0],
                format!(
                    "00-{}-{}-01",
                    outgoing.span_context.trace_id(),
                    outgoing.span_context.span_id()
                )
            );
            assert!(propagated.lock().unwrap()[1].ends_with("-00"));
            let serialized = format!("{spans:?}");
            for secret in [
                "synthetic-sql-secret",
                "synthetic-http-secret",
                "synthetic-user",
                "synthetic-password",
                "synthetic-path-secret",
                "synthetic-query-secret",
                "division by zero",
            ] {
                assert!(!serialized.contains(secret), "Telemetry leaked {secret}");
            }
            Ok::<_, anyhow::Error>(())
        })?;
    provider.shutdown()?;
    Ok(())
}
