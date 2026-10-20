use axum::{
    extract::{MatchedPath, Request},
    middleware::Next,
    response::Response,
};
use opentelemetry::{
    KeyValue, global,
    trace::{Span as _, SpanKind, Status, Tracer as _, TracerProvider as _},
};
use opentelemetry_http::{HeaderExtractor, HeaderInjector};
use opentelemetry_sdk::{
    Resource,
    propagation::TraceContextPropagator,
    trace::{BatchConfigBuilder, BatchSpanProcessor, SdkTracerProvider},
};
use std::time::{Duration, SystemTime};
use tracing::{Instrument, Span, field::Empty};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::{Layer as _, layer::SubscriberExt, util::SubscriberInitExt};

pub fn init() -> anyhow::Result<Option<SdkTracerProvider>> {
    global::set_text_map_propagator(TraceContextPropagator::new());
    let enabled = std::env::var("OTEL_SDK_DISABLED").as_deref() != Ok("true")
        && [
            "OTEL_EXPORTER_OTLP_ENDPOINT",
            "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
        ]
        .iter()
        .any(|name| std::env::var(name).is_ok_and(|value| !value.is_empty()));
    let provider = if enabled {
        let exporter = opentelemetry_otlp::SpanExporter::builder()
            .with_http()
            .build()?;
        let processor = BatchSpanProcessor::builder(exporter)
            .with_batch_config(
                BatchConfigBuilder::default()
                    .with_max_queue_size(256)
                    .with_max_export_batch_size(64)
                    .build(),
            )
            .build();
        let mut resource = Resource::builder();
        if let Ok(version) = std::env::var("OTEL_SERVICE_VERSION") {
            resource = resource.with_attribute(KeyValue::new("service.version", version));
        }
        let provider = SdkTracerProvider::builder()
            .with_resource(resource.build())
            .with_span_processor(processor)
            .build();
        global::set_tracer_provider(provider.clone());
        Some(provider)
    } else {
        None
    };
    let otel = provider.as_ref().map(|provider| {
        tracing_opentelemetry::layer()
            .with_tracer(provider.tracer("astral-grove.http"))
            .with_filter(
                tracing_subscriber::filter::Targets::new()
                    .with_target("astral_grove_server", tracing::Level::INFO),
            )
    });
    tracing_subscriber::registry()
        .with(otel)
        .with(
            tracing_subscriber::fmt::layer().json().with_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| "astral_grove_server=info".into()),
            ),
        )
        .try_init()?;
    Ok(provider)
}

pub async fn incoming(request: Request, next: Next) -> Response {
    let route = request
        .extensions()
        .get::<MatchedPath>()
        .map_or("unmatched", MatchedPath::as_str);
    let span = tracing::info_span!(
        "http.server",
        otel.name = %format!("{} {route}", request.method()),
        otel.kind = "server",
        http.request.method = %request.method(),
        http.route = route,
        http.response.status_code = Empty,
        otel.status_code = Empty,
    );
    let parent =
        global::get_text_map_propagator(|p| p.extract(&HeaderExtractor(request.headers())));
    let _ = span.set_parent(parent);
    let response = next.run(request).instrument(span.clone()).await;
    span.record("http.response.status_code", response.status().as_u16());
    if response.status().is_server_error() {
        span.record("otel.status_code", "ERROR");
    }
    response
}

pub struct HttpTracing;

#[async_trait::async_trait]
impl reqwest_middleware::Middleware for HttpTracing {
    async fn handle(
        &self,
        mut request: reqwest::Request,
        extensions: &mut axum::http::Extensions,
        next: reqwest_middleware::Next<'_>,
    ) -> reqwest_middleware::Result<reqwest::Response> {
        let span = tracing::info_span!(
            "http.client",
            otel.name = %format!("{} {}", request.method(), request.url().host_str().unwrap_or("unknown")),
            otel.kind = "client",
            http.request.method = %request.method(),
            server.address = request.url().host_str().unwrap_or("unknown"),
            server.port = request.url().port_or_known_default(),
            http.response.status_code = Empty,
            otel.status_code = Empty,
        );
        global::get_text_map_propagator(|p| {
            p.inject_context(&span.context(), &mut HeaderInjector(request.headers_mut()));
        });
        let result = next.run(request, extensions).instrument(span.clone()).await;
        if let Ok(response) = &result {
            span.record("http.response.status_code", response.status().as_u16());
        }
        if result.as_ref().map_or(true, |response| {
            response.status().is_client_error() || response.status().is_server_error()
        }) {
            span.record("otel.status_code", "ERROR");
        }
        result
    }
}

// Only operation names leave the process; SQL, bind values and driver errors can contain secrets.
fn operation(sql: &str) -> &'static str {
    let sql = sql.strip_prefix(crate::db::ROWS_PREFIX).unwrap_or(sql);
    match sql
        .split_ascii_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase()
        .as_str()
    {
        "SELECT" => "SELECT",
        "INSERT" => "INSERT",
        "UPDATE" => "UPDATE",
        "DELETE" => "DELETE",
        "WITH" => "WITH",
        "CREATE" => "CREATE",
        "ALTER" => "ALTER",
        "EXPLAIN" => "EXPLAIN",
        _ => "EXECUTE",
    }
}

pub fn database_query(namespace: &str, sql: &str, elapsed: Duration, failed: bool) {
    let operation = operation(sql);
    let end = SystemTime::now();
    let tracer = global::tracer("astral-grove.sea-orm");
    let mut span = tracer
        .span_builder(operation)
        .with_kind(SpanKind::Client)
        .with_start_time(end.checked_sub(elapsed).unwrap_or(end))
        .with_attributes([
            KeyValue::new("db.system", "postgresql"),
            KeyValue::new("db.system.name", "postgresql"),
            KeyValue::new("db.namespace", namespace.to_owned()),
            KeyValue::new("db.operation.name", operation),
        ])
        .start_with_context(&tracer, &Span::current().context());
    if failed {
        span.set_status(Status::error("Database query failed"));
    }
    span.end_with_timestamp(end);
}

#[cfg(test)]
mod tests {
    use super::operation;
    #[test]
    fn wrapped_row_queries_report_their_inner_operation() {
        for (sql, expected) in [
            ("SELECT 1", "SELECT"),
            ("insert into t values(1)", "INSERT"),
            ("WITH x AS (SELECT 1) SELECT * FROM x", "WITH"),
            ("SET LOCAL x=1", "EXECUTE"),
        ] {
            assert_eq!(operation(sql), expected);
            let wrapped = format!(
                "{}{sql}) SELECT to_jsonb(result) AS data FROM result",
                crate::db::ROWS_PREFIX
            );
            assert_eq!(operation(&wrapped), expected);
        }
    }
}
