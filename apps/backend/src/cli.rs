use crate::AppState;
use serde_json::json;
use std::collections::BTreeMap;
use std::sync::Arc;

pub(crate) fn options(
    args: &[String],
    flags: &[&str],
    keys: &[&str],
) -> anyhow::Result<BTreeMap<String, String>> {
    let mut result = BTreeMap::new();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        index += 1;
        if flags.contains(&arg.as_str()) {
            result.insert(arg.clone(), "true".into());
            continue;
        }
        let (name, value) = if let Some((key, value)) = arg.split_once('=') {
            (key.to_owned(), value.to_owned())
        } else {
            let value = args
                .get(index)
                .ok_or_else(|| anyhow::anyhow!("Missing command argument value"))?
                .clone();
            index += 1;
            (arg.clone(), value)
        };
        anyhow::ensure!(
            keys.contains(&name.as_str()) && !value.is_empty(),
            "Unknown or empty command argument"
        );
        result.insert(name, value);
    }
    Ok(result)
}
pub(crate) fn integer(
    options: &BTreeMap<String, String>,
    key: &str,
    default: i64,
    max: i64,
) -> anyhow::Result<i64> {
    let Some(value) = options.get(key) else {
        return Ok(default);
    };
    let value = crate::http::zod::js_number(value);
    anyhow::ensure!(
        value.is_finite() && value >= 1.0 && value <= max as f64,
        "Invalid numeric command argument: {key}"
    );
    Ok(value.floor() as i64)
}
pub fn config(command: &str, args: &[String]) -> anyhow::Result<crate::config::Config> {
    config_from_values(command, args, std::env::vars().collect())
}
fn maintenance_target(database: &str) -> anyhow::Result<(String, u16, String)> {
    let url = url::Url::parse(database).map_err(|_| anyhow::anyhow!("Invalid database URL"))?;
    anyhow::ensure!(
        matches!(url.scheme(), "postgres" | "postgresql")
            && !url.query_pairs().any(|(key, _)| matches!(
                key.as_ref(),
                "host" | "hostaddr" | "port" | "dbname" | "database"
            )),
        "Maintenance requires PostgreSQL without database routing query overrides"
    );
    let host = url
        .host_str()
        .ok_or_else(|| anyhow::anyhow!("Maintenance requires an explicit database host"))?
        .trim_end_matches('.')
        .to_ascii_lowercase();
    let name = percent_encoding::percent_decode_str(url.path().trim_start_matches('/'))
        .decode_utf8()
        .map_err(|_| anyhow::anyhow!("Invalid database name"))?
        .trim_end_matches('/')
        .to_owned();
    anyhow::ensure!(
        !name.is_empty(),
        "Maintenance requires an explicit database name"
    );
    Ok((host, url.port().unwrap_or(5432), name))
}
fn config_from_values(
    command: &str,
    args: &[String],
    mut values: BTreeMap<String, String>,
) -> anyhow::Result<crate::config::Config> {
    if matches!(command, "prune:prices" | "explain:search") {
        let options = options(
            args,
            if command == "prune:prices" {
                &["--apply", "--dry-run"]
            } else {
                &["--with-local-service"]
            },
            if command == "prune:prices" {
                &[
                    "--target",
                    "--database-url",
                    "--use-env",
                    "--retain-days",
                    "--retain-snapshots",
                ]
            } else {
                &[
                    "--target",
                    "--database-url",
                    "--use-env",
                    "--repeat",
                    "--output",
                ]
            },
        )?;
        let target = options
            .get("--target")
            .ok_or_else(|| anyhow::anyhow!("Maintenance requires --target=local|test|staging"))?;
        anyhow::ensure!(
            ["local", "test", "staging"].contains(&target.as_str()),
            "Production is not an allowed maintenance target"
        );
        anyhow::ensure!(
            values.get("NODE_ENV").is_none_or(|v| v != "production"),
            "Refusing maintenance with NODE_ENV=production"
        );
        anyhow::ensure!(
            options.contains_key("--database-url") != options.contains_key("--use-env"),
            "Pass exactly one of --database-url or --use-env; no default database is allowed"
        );
        let database = if let Some(database) = options.get("--database-url") {
            database.clone()
        } else {
            let name = options
                .get("--use-env")
                .ok_or_else(|| anyhow::anyhow!("Missing database selection"))?;
            anyhow::ensure!(
                [
                    "DATABASE_URL",
                    "TEST_DB_URL",
                    "SEARCH_EXPLAIN_DATABASE_URL",
                    "STAGING_DATABASE_URL"
                ]
                .contains(&name.as_str()),
                "Unsupported database environment selector"
            );
            values
                .get(name)
                .cloned()
                .ok_or_else(|| anyhow::anyhow!("Selected database environment variable is unset"))?
        };
        let selected = maintenance_target(&database)?;
        let local = matches!(
            selected.0.as_str(),
            "localhost" | "127.0.0.1" | "[::1]" | "::1"
        );
        anyhow::ensure!(
            if target == "staging" { !local } else { local },
            "Database host does not match the explicit maintenance target"
        );
        if target == "staging" {
            // Compare decoded database names and canonical host spellings against the ambient production URL.
            let ambient = values
                .get("DATABASE_URL")
                .map(|database| maintenance_target(database))
                .transpose()?;
            anyhow::ensure!(
                options
                    .get("--use-env")
                    .is_none_or(|name| name != "DATABASE_URL")
                    && ambient.is_none_or(|ambient| ambient != selected),
                "Staging maintenance must not use DATABASE_URL; select STAGING_DATABASE_URL"
            );
        }
        if target == "test" {
            anyhow::ensure!(
                selected.2 == "riftbound_test" || selected.2.starts_with("riftbound_test_"),
                "Test target must select a named test database"
            );
        }
        integer(&options, "--retain-days", 90, 3650)?;
        integer(&options, "--retain-snapshots", 30, 1000)?;
        integer(&options, "--repeat", 1, 500)?;
        values.insert("DATABASE_URL".into(), database);
        values
            .entry("PA_API_KEY".into())
            .or_insert("ak_unused_local_maintenance".into());
        values
            .entry("BETTER_AUTH_SECRET".into())
            .or_insert("unused-local-maintenance-secret-more-than-32-chars".into());
        values
            .entry("ADMIN_SYNC_TOKEN".into())
            .or_insert("unused-local-maintenance-admin".into());
    }
    crate::config::Config::from_map(values)
}
pub async fn run(state: &Arc<AppState>, command: &str, args: &[String]) -> anyhow::Result<()> {
    let value = match command {
        "migrate" => json!({"ok":true,"migrations":crate::migrations::MIGRATIONS.len()}),
        "sync:catalog" => {
            crate::sync::catalog_sync(state, args.iter().any(|arg| arg == "--force")).await?
        }
        "sync:prices" => crate::cardmarket::guide::sync(state).await?,
        "prune:prices" => {
            let parsed = options(
                args,
                &["--apply", "--dry-run"],
                &[
                    "--target",
                    "--database-url",
                    "--use-env",
                    "--retain-days",
                    "--retain-snapshots",
                ],
            )?;
            let dry_run = !args.iter().any(|arg| arg == "--apply")
                || args.iter().any(|arg| arg == "--dry-run");
            let config = &state.config;
            let days = integer(&parsed, "--retain-days", config.retain_days, 3650)?;
            let snapshots = integer(&parsed, "--retain-snapshots", config.retain_snapshots, 1000)?;
            json!({"dryRun":dry_run,"rows":crate::cardmarket::guide::prune(state,days,snapshots,dry_run).await?})
        }
        "audit:cards" => {
            let (report, failed) = crate::cli_audit::run(state, args).await?;
            println!("{}", serde_json::to_string_pretty(&report)?);
            anyhow::ensure!(!failed, "Card audit found unresolved differences");
            return Ok(());
        }
        "explain:search" => crate::cli_search::run(state, args).await?,
        _ => anyhow::bail!("Unknown backend command"),
    };
    println!("{}", serde_json::to_string_pretty(&value)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn values() -> BTreeMap<String, String> {
        BTreeMap::from([
            ("NODE_ENV".into(), "test".into()),
            (
                "TEST_DB_URL".into(),
                "postgres://fixture:fixture@127.0.0.1:5433/riftbound_test_native".into(),
            ),
        ])
    }
    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| (*v).into()).collect()
    }
    #[test]
    fn maintenance_refuses_implicit_or_inconsistent_database_targets() {
        for input in [
            vec![],
            vec!["--target=test"],
            vec!["--target=production", "--use-env=TEST_DB_URL"],
            vec!["--target=staging", "--use-env=TEST_DB_URL"],
            vec![
                "--target=test",
                "--database-url=postgres://fixture:fixture@example.test/production",
            ],
            vec![
                "--target=test",
                "--database-url=postgres://fixture:fixture@localhost/production",
            ],
        ] {
            assert!(config_from_values("prune:prices", &args(&input), values()).is_err());
        }
    }
    #[test]
    fn maintenance_requires_one_explicit_database_and_valid_retention() {
        assert!(
            config_from_values(
                "prune:prices",
                &args(&["--target=test", "--use-env=TEST_DB_URL", "--retain-days=91"]),
                values()
            )
            .is_ok()
        );
        assert!(
            config_from_values(
                "prune:prices",
                &args(&["--target=test", "--use-env=TEST_DB_URL", "--retain-days=0"]),
                values()
            )
            .is_err()
        );
        assert!(
            config_from_values(
                "prune:prices",
                &args(&[
                    "--target=test",
                    "--use-env=TEST_DB_URL",
                    "--database-url=postgres://localhost/riftbound_test"
                ]),
                values()
            )
            .is_err()
        );
    }
    #[test]
    fn maintenance_rejects_database_routing_overrides_before_connecting() {
        for database in [
            "postgres://localhost/riftbound_test?host=production.example.test",
            "postgres://localhost/riftbound_test?hostaddr=192.0.2.1",
            "postgres://localhost/riftbound_test?port=6543",
            "postgres://localhost/riftbound_test?dbname=production",
            "postgres://localhost/riftbound_test?database=production",
            "postgres://localhost/riftbound_test?%68ost=production.example.test",
            "postgres://fixture@localhost",
            "https://localhost/riftbound_test",
        ] {
            for command in ["prune:prices", "explain:search"] {
                let selected = format!("--database-url={database}");
                assert!(
                    config_from_values(command, &args(&["--target=local", &selected]), values())
                        .is_err(),
                    "{command}: {database}"
                );
            }
        }
    }
    #[test]
    fn staging_maintenance_never_targets_the_ambient_database_url() {
        let production = "postgres://fixture:fixture@production.example.test/railway";
        let mut config = values();
        config.insert("DATABASE_URL".into(), production.into());
        config.insert(
            "STAGING_DATABASE_URL".into(),
            "postgres://fixture:fixture@staging.example.test/railway".into(),
        );
        let explicit = format!("--database-url={production}");
        let respelled = "--database-url=postgres://other:creds@PRODUCTION.example.test:5432/railway/?sslmode=require";
        for input in [
            vec!["--target=staging", "--use-env=DATABASE_URL", "--apply"],
            vec!["--target=staging", explicit.as_str()],
            vec!["--target=staging", respelled],
            vec![
                "--target=staging",
                "--database-url=postgres://fixture:fixture@production.example.test/%72ailway",
            ],
            vec![
                "--target=staging",
                "--database-url=postgres://fixture:fixture@production.example.test./railway",
            ],
        ] {
            assert!(config_from_values("prune:prices", &args(&input), config.clone()).is_err());
        }
        assert!(
            config_from_values(
                "prune:prices",
                &args(&["--target=staging", "--use-env=STAGING_DATABASE_URL"]),
                config
            )
            .is_ok()
        );
    }
    #[test]
    fn diagnostics_reject_mutation_and_unknown_flags_before_connecting() {
        assert!(
            config_from_values(
                "explain:search",
                &args(&["--target=test", "--use-env=TEST_DB_URL", "--apply"]),
                values()
            )
            .is_err()
        );
        assert!(
            config_from_values(
                "explain:search",
                &args(&["--target=test", "--use-env=TEST_DB_URL", "--repeat=501"]),
                values()
            )
            .is_err()
        );
        let mut config = values();
        config.insert("NODE_ENV".into(), "production".into());
        assert!(
            config_from_values(
                "prune:prices",
                &args(&["--target=test", "--use-env=TEST_DB_URL"]),
                config
            )
            .is_err()
        );
    }
}
