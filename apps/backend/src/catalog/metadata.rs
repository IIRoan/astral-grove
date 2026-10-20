use super::hash;
use crate::{
    AppState, db,
    error::{AppError, Result},
    http, upstream,
};
use axum::{Json, extract::State};
use serde_json::{Value, json};
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};
use tracing::Instrument;
use utoipa_axum::{router::OpenApiRouter, routes};
pub fn total(snapshot: &Value, synced: i64) -> i64 {
    let sets = db::array(snapshot, "sets");
    let from_sets: i64 = sets
        .iter()
        .map(|set| {
            set["printCount"]
                .as_i64()
                .or_else(|| set["count"].as_i64())
                .unwrap_or(0)
        })
        .sum();
    if from_sets > 0 && sets.iter().any(|set| set.get("printCount").is_some()) {
        return from_sets.max(synced);
    }
    let variants: i64 = db::array(snapshot, "variants")
        .iter()
        .filter_map(|value| value["count"].as_i64())
        .sum();
    if variants > 0 {
        variants.max(synced)
    } else {
        from_sets.max(synced)
    }
}
pub async fn latest(state: &AppState) -> Result<Option<Value>> {
    Ok(db::rows(&state.db,"SELECT snapshot,to_char(captured_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS at FROM filter_snapshots ORDER BY captured_at DESC LIMIT 1",vec![]).await?.into_iter().next())
}
fn base(probe: &Value) -> Result<Value> {
    http::schemas::schema("FilterSnapshot").parse(Some(probe.get("meta").and_then(|meta|meta.get("filters")).unwrap_or(&json!({"colors":[],"sets":[],"types":[],"supertypes":[],"rarities":[],"variants":[]})))).map_err(|_|AppError::internal())?.ok_or_else(AppError::internal)
}
pub async fn expanded(state: &Arc<AppState>, force: bool, blocking: bool) -> Result<Value> {
    let previous = latest(state).await?;
    if state
        .config
        .values
        .get("CATALOG_PROBE_DISABLED")
        .is_some_and(|value| value == "true")
    {
        return match previous {
            Some(row) => http::schemas::schema("FilterSnapshot")
                .parse(row.get("snapshot"))
                .map_err(|_| AppError::internal())?
                .ok_or_else(AppError::internal),
            None => base(&upstream::list_cards(state, &json!({"limit":1,"page":1})).await?),
        };
    }
    let probe = upstream::list_cards(state, &json!({"limit":1,"page":1})).await?;
    let fingerprint = hash(
        &json!({"total":probe["pagination"]["total"],"filters":probe["meta"].get("filters").cloned().unwrap_or(json!({}))}),
    );
    let base = base(&probe)?;
    let old = db::rows(
        &state.db,
        "SELECT content_hash AS hash FROM sync_state WHERE key='catalog_probe'",
        vec![],
    )
    .await?
    .into_iter()
    .next();
    let complete = previous.as_ref().is_some_and(|row| {
        db::array(&row["snapshot"], "sets")
            .iter()
            .any(|set| set["printCount"].as_i64().unwrap_or(0) > 0)
    });
    let needs = force || !complete || old.is_none_or(|old| old["hash"] != fingerprint);
    if !needs {
        return Ok(previous.map(|row| row["snapshot"].clone()).unwrap_or(base));
    }
    if blocking {
        let _lock = state.probe.lock().await;
        return run_probe(state, &base, &fingerprint).await;
    }
    if let Ok(guard) = state.probe.clone().try_lock_owned() {
        let state = state.clone();
        let base = base.clone();
        tokio::spawn(
            async move {
                let _guard = guard;
                if run_probe(&state, &base, &fingerprint).await.is_err() {
                    tracing::warn!(category = "catalog-probe", "Catalog metadata probe failed");
                }
            }
            .instrument(tracing::info_span!("catalog.probe")),
        );
    }
    Ok(previous.map(|row| row["snapshot"].clone()).unwrap_or(base))
}
async fn run_probe(state: &Arc<AppState>, base: &Value, fingerprint: &str) -> Result<Value> {
    let mut seen = HashSet::new();
    let mut seen_variants = HashSet::new();
    let mut totals = HashMap::<String, i64>::new();
    let mut foils = HashMap::<String, i64>::new();
    let mut page = 1;
    loop {
        let response = upstream::list_cards(state, &json!({"limit":100,"page":page})).await?;
        for variant in db::array(&response, "data") {
            let number = db::string(variant, "variantNumber");
            if seen_variants.contains(number) {
                continue;
            }
            let card = upstream::card(state, number).await?;
            if !seen.insert(db::string(&card, "id").to_owned()) {
                continue;
            }
            for variant in db::array(&card, "variants") {
                seen_variants.insert(db::string(variant, "variantNumber").to_owned());
                if variant["isCollectible"] != true {
                    continue;
                }
                let code = db::string(&variant["set"], "prefix").to_owned();
                *totals.entry(code.clone()).or_default() += 1;
                if super::mapper::foil(variant) {
                    *foils.entry(code).or_default() += 1;
                }
            }
        }
        if response["pagination"]["hasNext"] != true {
            break;
        }
        page += 1;
    }
    let mut enriched = base.clone();
    if let Some(sets) = enriched["sets"].as_array_mut() {
        for set in sets {
            let code = set["code"]
                .as_str()
                .or_else(|| set["id"].as_str())
                .unwrap_or("");
            let count = totals
                .get(code)
                .copied()
                .unwrap_or_else(|| set["count"].as_i64().unwrap_or(0));
            let foil = foils
                .get(code)
                .copied()
                .unwrap_or_else(|| set["foilPrintCount"].as_i64().unwrap_or(0));
            set["printCount"] = json!(count);
            set["foilPrintCount"] = json!(foil);
        }
    }
    db::execute(
        &state.db,
        "INSERT INTO filter_snapshots(snapshot,content_hash) VALUES($1,$2)",
        vec![enriched.clone().into(), hash(&enriched).into()],
    )
    .await?;
    db::execute(&state.db,"INSERT INTO sync_state(key,status,content_hash,row_count,last_attempt_at,last_success_at) VALUES('catalog_probe','idle',$1,$2,now(),now()) ON CONFLICT(key) DO UPDATE SET status='idle',content_hash=EXCLUDED.content_hash,row_count=EXCLUDED.row_count,last_attempt_at=now(),last_success_at=now(),last_error=NULL",vec![fingerprint.into(),totals.values().sum::<i64>().into()]).await?;
    Ok(enriched)
}
#[utoipa::path(get,path="/api/v1/filters",operation_id="catalogFilters",responses((status=200,body=astral_grove_api_types::FiltersResponse)))]
async fn filters(
    State(state): State<Arc<AppState>>,
) -> Result<Json<astral_grove_api_types::FiltersResponse>> {
    let mut snapshot = expanded(&state, false, false).await?;
    let latest = latest(&state).await?;
    let counts=db::rows(&state.db,"SELECT s.code,s.name,count(*) FILTER(WHERE v.is_collectible)::bigint AS count,count(*) FILTER(WHERE v.foil_mode ILIKE 'foil_only' OR v.variant_number ILIKE '%foil%' OR v.variant_label ILIKE '%foil%' OR v.variant_type ILIKE '%foil%')::bigint AS foil FROM variants v JOIN sets s ON s.id=v.set_id GROUP BY s.code,s.name",vec![]).await?;
    let synced = db::rows(
        &state.db,
        "SELECT row_count AS count FROM sync_state WHERE key='catalog'",
        vec![],
    )
    .await?
    .first()
    .and_then(|row| row["count"].as_i64())
    .unwrap_or(0);
    let set_sum: i64 = db::array(&snapshot, "sets")
        .iter()
        .map(|set| {
            set["printCount"]
                .as_i64()
                .or_else(|| set["count"].as_i64())
                .unwrap_or(0)
        })
        .sum();
    let overlay_sets = !(synced > 0 && set_sum >= synced);
    let overlay_foils = !db::array(&snapshot, "sets")
        .iter()
        .all(|set| set.get("foilPrintCount").is_some());
    if let Some(sets) = snapshot["sets"].as_array_mut() {
        for set in sets.iter_mut() {
            let code = set["code"]
                .as_str()
                .or_else(|| set["id"].as_str())
                .unwrap_or("")
                .to_owned();
            if overlay_foils {
                set["foilPrintCount"] = json!(
                    counts
                        .iter()
                        .find(|row| row["code"] == code)
                        .and_then(|row| row["foil"].as_i64())
                        .or_else(|| set["foilPrintCount"].as_i64())
                        .unwrap_or(0)
                );
            }
            if overlay_sets
                && let Some(row) = counts
                    .iter()
                    .find(|row| db::string(row, "code").eq_ignore_ascii_case(&code))
            {
                let count = row["count"].as_i64().unwrap_or(0);
                if count > 0 {
                    set["printCount"] = json!(
                        count.max(
                            set["printCount"]
                                .as_i64()
                                .or_else(|| set["count"].as_i64())
                                .unwrap_or(0)
                        )
                    );
                }
            }
        }
        if overlay_sets && !sets.is_empty() {
            for row in &counts {
                if row["count"].as_i64().unwrap_or(0) > 0
                    && !sets.iter().any(|set| {
                        set["code"]
                            .as_str()
                            .or_else(|| set["id"].as_str())
                            .is_some_and(|code| code.eq_ignore_ascii_case(db::string(row, "code")))
                    })
                {
                    sets.push(json!({"id":db::string(row,"code").to_lowercase(),"code":row["code"],"name":row["name"],"count":row["count"],"printCount":row["count"]}));
                }
            }
        }
    }
    let count = total(&snapshot, synced);
    let (hash, prices) = super::store::hashes(&state).await?;
    let prices = prices.rsplit_once(':').map(|(hash, _)| hash).unwrap_or("");
    http::respond(
        "FiltersResponse",
        json!({"data":snapshot,"meta":{"cachedAt":latest.map(|row|row["at"].clone()).unwrap_or(json!(db::iso(time::OffsetDateTime::now_utc()))),"catalogHash":hash,"pricesCatalogHash":prices,"variantCount":count}}),
    )
}
pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new().routes(routes!(filters))
}
