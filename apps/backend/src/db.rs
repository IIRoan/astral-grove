use crate::{
    error::{AppError, Result},
    migrations::MIGRATIONS,
};
use sea_orm::{
    ConnectOptions, ConnectionTrait, Database, DatabaseConnection, DbBackend, DbErr, Statement,
    TransactionTrait, Value,
};
use serde_json::Value as JsonValue;
use sha2::{Digest, Sha256};
use std::time::Duration;

pub async fn connect(url: &str, max: u32) -> std::result::Result<DatabaseConnection, DbErr> {
    let mut options = ConnectOptions::new(url);
    options
        .max_connections(max)
        .min_connections(max.min(2))
        .acquire_timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(1800))
        .test_before_acquire(false)
        .sqlx_logging(false);
    let mut database = Database::connect(options).await?;
    let namespace = namespace(url);
    database.set_metric_callback(move |info| {
        crate::telemetry::database_query(
            &namespace,
            &info.statement.sql,
            info.elapsed,
            info.failed,
        );
    });
    Ok(database)
}

fn namespace(url: &str) -> String {
    url::Url::parse(url)
        .map(|url| url.path().trim_start_matches('/').to_owned())
        .unwrap_or_default()
}

async fn unprepared(
    db: &impl ConnectionTrait,
    sql: &str,
    namespace: &str,
) -> std::result::Result<sea_orm::ExecResult, DbErr> {
    let start = std::time::Instant::now();
    let result = db.execute_unprepared(sql).await;
    crate::telemetry::database_query(namespace, sql, start.elapsed(), result.is_err());
    result
}

pub async fn migrate(db: &DatabaseConnection, url: &str) -> std::result::Result<(), DbErr> {
    let namespace = namespace(url);
    let tx = db.begin().await?;
    unprepared(&tx, "SELECT pg_advisory_xact_lock(1280472985)", &namespace).await?;
    unprepared(&tx, "CREATE SCHEMA IF NOT EXISTS drizzle", &namespace).await?;
    unprepared(&tx, "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)", &namespace).await?;
    let history = tx
        .query_all_raw(Statement::from_string(
            DbBackend::Postgres,
            "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at",
        ))
        .await?;
    let latest = history
        .last()
        .map(|row| row.try_get::<i64>("", "created_at"))
        .transpose()?
        .unwrap_or(0);
    for (name, when, source) in MIGRATIONS {
        let hash = hex::encode(Sha256::digest(source.as_bytes()));
        let applied = history
            .iter()
            .find(|row| row.try_get::<i64>("", "created_at").ok() == Some(*when));
        if let Some(row) = applied {
            if !migration_checksum_matches(name, &hash, &row.try_get::<String>("", "hash")?) {
                return Err(DbErr::Custom(format!(
                    "Migration checksum mismatch: {name}"
                )));
            }
            continue;
        }
        if *when <= latest {
            return Err(DbErr::Custom(format!(
                "Missing historical migration: {name}"
            )));
        }
        for statement in source
            .split("--> statement-breakpoint")
            .map(str::trim)
            .filter(|statement| !statement.is_empty())
        {
            unprepared(&tx, statement, &namespace).await?;
        }
        tx.execute_raw(Statement::from_sql_and_values(
            DbBackend::Postgres,
            "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ($1,$2)",
            [hash.into(), (*when).into()],
        ))
        .await?;
    }
    tx.commit().await
}

fn migration_checksum_matches(name: &str, current: &str, applied: &str) -> bool {
    current == applied
        // Preserve the observed production checksum without rewriting its historical ledger.
        || matches!(
            (name, current, applied),
            (
                "0013_graceful_speedball",
                "b996aa55710fb04b8c04d4614c83681938993a0ffbf384cdc963e1fbb7326d5e",
                "131e9b7202b99f05fbeec89c4ffe41acc22c334037df805c605d3eefe484fbc0"
            )
        )
}

pub async fn rows(
    db: &impl ConnectionTrait,
    sql: &str,
    values: Vec<Value>,
) -> Result<Vec<JsonValue>> {
    let query = format!("WITH result AS ({sql}) SELECT to_jsonb(result) AS data FROM result");
    db.query_all_raw(Statement::from_sql_and_values(
        DbBackend::Postgres,
        query,
        values,
    ))
    .await?
    .into_iter()
    .map(|row| row.try_get("", "data").map_err(AppError::from))
    .collect()
}
pub async fn execute(db: &impl ConnectionTrait, sql: &str, values: Vec<Value>) -> Result<u64> {
    Ok(db
        .execute_raw(Statement::from_sql_and_values(
            DbBackend::Postgres,
            sql,
            values,
        ))
        .await?
        .rows_affected())
}

pub fn string<'a>(value: &'a JsonValue, key: &str) -> &'a str {
    value.get(key).and_then(JsonValue::as_str).unwrap_or("")
}
pub fn array<'a>(value: &'a JsonValue, key: &str) -> &'a [JsonValue] {
    value
        .get(key)
        .and_then(JsonValue::as_array)
        .map_or(&[], Vec::as_slice)
}
pub fn iso(value: time::OffsetDateTime) -> String {
    format!(
        "{}.{:03}Z",
        value
            .format(&time::macros::format_description!(
                "[year]-[month]-[day]T[hour]:[minute]:[second]"
            ))
            .unwrap_or_default(),
        value.millisecond()
    )
}

pub fn transient(error: &DbErr) -> bool {
    use sea_orm::{RuntimeErr, SqlxError};
    let runtime = match error {
        DbErr::Conn(error) | DbErr::Query(error) | DbErr::Exec(error) => Some(error),
        _ => None,
    };
    match runtime {
        Some(RuntimeErr::SqlxError(error)) => match error.as_ref() {
            SqlxError::Io(_) | SqlxError::PoolTimedOut | SqlxError::WorkerCrashed => true,
            SqlxError::Database(error) => error.code().is_some_and(|code| {
                code.starts_with("08") || matches!(code.as_ref(), "57P01" | "57P02" | "57P03")
            }),
            _ => false,
        },
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn legacy_checksum_acceptance_is_bound_to_the_exact_migration_contents() {
        let current = "b996aa55710fb04b8c04d4614c83681938993a0ffbf384cdc963e1fbb7326d5e";
        let legacy = "131e9b7202b99f05fbeec89c4ffe41acc22c334037df805c605d3eefe484fbc0";
        assert!(migration_checksum_matches(
            "0013_graceful_speedball",
            current,
            legacy
        ));
        assert!(!migration_checksum_matches(
            "another_migration",
            current,
            legacy
        ));
        assert!(!migration_checksum_matches(
            "0013_graceful_speedball",
            "edited",
            legacy
        ));
        assert!(!migration_checksum_matches(
            "0013_graceful_speedball",
            current,
            "unknown"
        ));
    }

    #[test]
    fn migration_chain_is_complete_and_ordered() {
        assert_eq!(MIGRATIONS.len(), 18);
        for pair in MIGRATIONS.windows(2) {
            assert!(pair[0].1 < pair[1].1);
        }
        assert!(MIGRATIONS.iter().all(|(_, _, sql)| !sql.trim().is_empty()));
    }
    #[test]
    fn timestamps_render_javascript_milliseconds() {
        assert_eq!(
            iso(time::macros::datetime!(1969-12-31 23:59:59.999999 UTC)),
            "1969-12-31T23:59:59.999Z"
        );
    }
}
