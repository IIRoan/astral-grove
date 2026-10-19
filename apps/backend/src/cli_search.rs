use crate::{AppState, catalog::query, cli, db};
use sea_orm::{ConnectionTrait, DbBackend, Statement, TransactionTrait};
use serde_json::{Value, json};
use std::{sync::Arc, time::Instant};

fn percentile(values: &[f64], fraction: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(f64::total_cmp);
    let index = ((sorted.len() as f64 * fraction).ceil() as usize)
        .saturating_sub(1)
        .min(sorted.len() - 1);
    (sorted[index] * 100.0).round() / 100.0
}
pub async fn run(state: &Arc<AppState>, args: &[String]) -> anyhow::Result<Value> {
    let options = cli::options(
        args,
        &["--with-local-service"],
        &[
            "--target",
            "--database-url",
            "--use-env",
            "--repeat",
            "--output",
        ],
    )?;
    let repeat = cli::integer(&options, "--repeat", 1, 500)?;
    let benchmarks: Vec<Value> = serde_json::from_str(include_str!("cli-search-cases.json"))?;
    let version = db::rows(&state.db, "SELECT version() AS version", vec![]).await?;
    let collation = db::rows(
        &state.db,
        "SELECT datcollate,datctype FROM pg_database WHERE datname=current_database()",
        vec![],
    )
    .await?;
    let extensions=db::rows(&state.db,"SELECT e.extname,e.extversion,n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname IN('pg_trgm','unaccent','vector') ORDER BY e.extname",vec![]).await?;
    let relations=db::rows(&state.db,"SELECT c.relname,c.relkind,c.reltuples::bigint AS reltuples,pg_relation_size(c.oid)::text AS \"sizeBytes\" FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY['cards','variants','sets','prices','price_history','price_daily','collection_items']) ORDER BY c.relname",vec![]).await?;
    let indexes=db::rows(&state.db,"SELECT indexname AS name,tablename AS table,indexdef AS definition,pg_relation_size(indexname::regclass)::text AS \"sizeBytes\" FROM pg_indexes WHERE schemaname='public' AND tablename=ANY(ARRAY['cards','variants','sets','prices','price_history','price_daily','collection_items']) ORDER BY tablename,indexname",vec![]).await?;
    let stats=db::rows(&state.db,"SELECT relname,last_analyze::text AS \"lastAnalyze\",last_autoanalyze::text AS \"lastAutoanalyze\" FROM pg_stat_user_tables WHERE schemaname='public' AND relname=ANY(ARRAY['cards','variants','sets','prices','price_history','price_daily','collection_items']) ORDER BY relname",vec![]).await?;
    let mut cases = Vec::new();
    let mut service = Vec::new();
    for benchmark in benchmarks {
        let mut transport = benchmark["query"].clone();
        for key in ["excludeTokens", "excludeBanned", "refresh"] {
            if let Some(value) = transport[key].as_bool() {
                transport[key] = json!(value.to_string());
            }
        }
        let input = crate::http::value("CardsListQuery", &transport)
            .map_err(|_| anyhow::anyhow!("Invalid search benchmark {}", benchmark["id"]))?;
        let (sql, values, direct) = query::candidate_query(&input);
        let tx = state.db.begin().await?;
        tx.execute_unprepared("SET TRANSACTION READ ONLY").await?;
        tx.execute_unprepared("SET LOCAL statement_timeout='30000ms'")
            .await?;
        let rows = tx
            .query_all_raw(Statement::from_sql_and_values(
                DbBackend::Postgres,
                format!("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) {sql}"),
                values,
            ))
            .await?;
        let plan: Value = rows
            .first()
            .ok_or_else(|| anyhow::anyhow!("Missing EXPLAIN plan"))?
            .try_get("", "QUERY PLAN")?;
        tx.commit().await?;
        let root = &plan[0];
        let node = &root["Plan"];
        cases.push(json!({"id":benchmark["id"],"materializeThenPage":!direct,"sqlPaged":direct,"page":input["page"],"limit":input["limit"],"sortBy":input["sortBy"],"plan":{"planningTimeMs":root["Planning Time"],"executionTimeMs":root["Execution Time"],"nodeType":node["Node Type"],"actualRows":node["Actual Rows"],"planRows":node["Plan Rows"],"sharedHitBlocks":node["Shared Hit Blocks"],"sharedReadBlocks":node["Shared Read Blocks"],"rowsRemovedByFilter":node["Rows Removed by Filter"]},"planJson":root}));
        if options.contains_key("--with-local-service") {
            let mut timings = Vec::new();
            let mut first = Value::Null;
            for index in 0..repeat {
                let start = Instant::now();
                let result = query::local_without_upstream(state, &input).await?;
                let elapsed = start.elapsed().as_secs_f64() * 1000.0;
                if index == 0 {
                    first = json!({"total":result["total"],"items":result["items"].as_array().map_or(0,Vec::len),"totalMs":elapsed});
                } else {
                    timings.push(elapsed);
                }
            }
            service.push(json!({"id":benchmark["id"],"coldTimings":first,"warmedPercentiles":{"totalMs":{"p50":percentile(&timings,0.5),"p95":percentile(&timings,0.95)}}}));
        }
    }
    let url = url::Url::parse(&state.config.database_url)?;
    let report = json!({"generatedAt":db::iso(time::OffsetDateTime::now_utc()),"target":options.get("--target"),"host":url.host_str(),"database":url.path().trim_start_matches('/'),"envName":options.get("--use-env"),"catalog":{"postgresVersion":version.first().map(|v|&v["version"]),"collation":collation.first(),"extensions":extensions,"relations":relations,"indexes":indexes,"statsFreshness":stats},"cases":cases,"service":if options.contains_key("--with-local-service"){json!(service)}else{Value::Null},"notes":["Database-only diagnostic; no PA requests or backfill. EXPLAIN uses the same candidate SQL as HTTP search.","Statement timeout 30 seconds in read-only transactions; service timing reports measured total time.","First service sample is process-cold; subsequent samples use the same process. Database buffers are not flushed."]});
    if let Some(path) = options.get("--output") {
        let path = std::path::Path::new(path);
        if let Some(parent) = path.parent().filter(|path| !path.as_os_str().is_empty()) {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, serde_json::to_string_pretty(&report)?)?;
        return Ok(json!({"output":path}));
    }
    Ok(report)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn percentiles_use_nearest_rank_and_round_to_centiseconds() {
        assert_eq!(percentile(&[], 0.5), 0.0);
        assert_eq!(percentile(&[4.123, 1.001, 2.002, 3.003], 0.5), 2.0);
        assert_eq!(percentile(&[4.123, 1.001, 2.002, 3.003], 0.95), 4.12);
    }
}
