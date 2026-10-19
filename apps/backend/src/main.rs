use astral_grove_server::{AppState, router};

#[tokio::main(worker_threads = 2)]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter("astral_grove_server=info")
        .init();
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let command = args.first().map(String::as_str).unwrap_or("serve");
    let command_args = args.get(1..).unwrap_or_default();
    if matches!(command, "--help" | "-h") {
        println!(
            "astral-grove-server [serve | migrate | sync:catalog [--force] | sync:prices | audit:cards [--name TEXT|--variant CODE] [--limit N] [--concurrency N] [--fix] [--json] | explain:search --target=test|local|staging --use-env=TEST_DB_URL [--with-local-service] [--repeat=N] [--output=FILE] | prune:prices --target=test|local|staging --use-env=TEST_DB_URL [--retain-days=N] [--retain-snapshots=N] [--apply]]"
        );
        return Ok(());
    }
    anyhow::ensure!(
        [
            "serve",
            "migrate",
            "sync:catalog",
            "sync:prices",
            "audit:cards",
            "prune:prices",
            "explain:search"
        ]
        .contains(&command),
        "Unknown backend command"
    );
    if args
        .iter()
        .skip(1)
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
    {
        println!(
            "Use --help for the full command and argument list; maintenance commands require --target and --database-url or --use-env. Audit is read-only unless --fix; retention is read-only unless --apply."
        );
        return Ok(());
    }
    let config = astral_grove_server::cli::config(command, command_args)?;
    let address = format!(
        "{}:{}",
        if config.host.contains(':') {
            format!("[{}]", config.host)
        } else {
            config.host.clone()
        },
        config.port
    );
    let state = AppState::connect_with_migrations(
        config,
        !matches!(command, "audit:cards" | "explain:search" | "prune:prices"),
    )
    .await?;
    if command != "serve" {
        let result = astral_grove_server::cli::run(&state, command, command_args).await;
        state.db.clone().close().await?;
        return result;
    }
    let listener = tokio::net::TcpListener::bind(&address).await?;
    if (state
        .config
        .values
        .get("CATALOG_WARMUP_ON_START")
        .is_some_and(|v| v == "true")
        || state
            .config
            .values
            .get("NODE_ENV")
            .is_none_or(|v| v == "development"))
        && !state
            .config
            .values
            .get("CATALOG_PROBE_DISABLED")
            .is_some_and(|v| v == "true")
    {
        let state = state.clone();
        tokio::spawn(async move {
            if astral_grove_server::catalog::metadata::expanded(&state, false, true)
                .await
                .is_err()
            {
                tracing::warn!(
                    category = "catalog-warmup",
                    "Catalog metadata warmup failed"
                )
            }
        });
    }
    let database = state.db.clone();
    tracing::info!("The Astral Grove API is listening");
    let shutdown = state.shutdown.clone();
    let result = axum::serve(listener, router(state.clone()))
        .with_graceful_shutdown(async move {
            #[cfg(unix)]
            {
                if let Ok(mut terminate) =
                    tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                {
                    tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
                }
            }
            #[cfg(not(unix))]
            {
                let _ = tokio::signal::ctrl_c().await;
            }
            shutdown.send_replace(true);
        })
        .await;
    state.drain().await;
    database.close().await?;
    result?;
    Ok(())
}
