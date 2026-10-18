use crate::{
    AppState, db,
    error::{AppError, Result},
    http,
};
use axum::{Json, extract::State, http::HeaderMap};
use serde_json::json;
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};
#[utoipa::path(get,path="/api/v1/sync/status",operation_id="getSyncStatus",responses((status=200,body=astral_grove_api_types::SyncStatusResponse)))]
async fn status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<astral_grove_api_types::SyncStatusResponse>> {
    if !crate::middleware::admin(&state, &headers) {
        return Err(AppError::new(401, "UNAUTHORIZED", "Admin token required"));
    }
    let rows=db::rows(&state.db,"SELECT key,status,content_hash AS hash,row_count AS count,to_char(last_success_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS last FROM sync_state WHERE key=ANY(ARRAY['catalog','prices'])",vec![]).await?;
    let mut data = json!({});
    for key in ["catalog", "prices"] {
        let row = rows.iter().find(|row| row["key"] == key);
        let mut value = json!({"lastRun":row.map(|row|row["last"].clone()),"status":row.map(|row|db::string(row,"status")).unwrap_or("idle"),"hash":row.map(|row|db::string(row,"hash")).unwrap_or("")});
        value[if key == "catalog" {
            "variantCount"
        } else {
            "rowCount"
        }] = json!(row.and_then(|row| row["count"].as_i64()).unwrap_or(0));
        data[key] = value;
    }
    http::respond("SyncStatusResponse", json!({"data":data}))
}
pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(status))
        .routes(routes!(catalog))
        .routes(routes!(prices))
}

pub async fn set_status(
    state: &AppState,
    key: &str,
    status: &str,
    hash: Option<&str>,
    count: Option<i64>,
    error: Option<&str>,
) -> Result<()> {
    db::execute(&state.db,"INSERT INTO sync_state(key,status,content_hash,row_count,last_attempt_at,last_error) VALUES($1,$2,coalesce($3,''),coalesce($4,0),now(),$5) ON CONFLICT(key) DO UPDATE SET status=EXCLUDED.status,last_attempt_at=now(),content_hash=coalesce($3,sync_state.content_hash),row_count=coalesce($4,sync_state.row_count),last_error=CASE WHEN $5 IS NOT NULL OR $2='idle' THEN $5 ELSE sync_state.last_error END",vec![key.into(),status.into(),hash.map(str::to_owned).into(),count.into(),error.map(str::to_owned).into()]).await?;
    Ok(())
}
async fn complete(state: &AppState, key: &str, hash: &str, count: i64, at: &str) -> Result<()> {
    db::execute(&state.db,"INSERT INTO sync_state(key,status,content_hash,row_count,last_attempt_at,last_success_at,last_error) VALUES($1,'idle',$2,$3,now(),$4::timestamptz,NULL) ON CONFLICT(key) DO UPDATE SET status='idle',content_hash=EXCLUDED.content_hash,row_count=EXCLUDED.row_count,last_attempt_at=now(),last_success_at=EXCLUDED.last_success_at,last_error=NULL",vec![key.into(),hash.into(),count.into(),at.into()]).await?;
    Ok(())
}
async fn local_counts(state: &AppState) -> Result<(i64, Vec<serde_json::Value>)> {
    let total = db::rows(
        &state.db,
        "SELECT count(*)::bigint AS total FROM variants",
        vec![],
    )
    .await?
    .first()
    .and_then(|row| row["total"].as_i64())
    .unwrap_or(0);
    let sets=db::rows(&state.db,"SELECT upper(trim(s.code)) AS code,count(*) FILTER(WHERE v.is_collectible)::bigint AS total FROM variants v JOIN sets s ON s.id=v.set_id GROUP BY s.code",vec![]).await?;
    Ok((total, sets))
}
fn shortfalls(
    snapshot: &serde_json::Value,
    counts: &[serde_json::Value],
) -> Vec<serde_json::Value> {
    snapshot["sets"]
        .as_array()
        .map(Vec::as_slice)
        .unwrap_or(&[])
        .iter()
        .filter_map(|set| {
            let code = set["code"]
                .as_str()
                .or_else(|| set["id"].as_str())
                .unwrap_or("")
                .trim()
                .to_uppercase();
            let expected = set["printCount"]
                .as_i64()
                .or_else(|| set["count"].as_i64())
                .unwrap_or(0);
            let actual = counts
                .iter()
                .find(|row| row["code"] == code)
                .and_then(|row| row["total"].as_i64())
                .unwrap_or(0);
            (!code.is_empty() && expected > 0 && actual < expected)
                .then(|| json!({"code":code,"expected":expected,"actual":actual}))
        })
        .collect()
}
async fn publish(state: &AppState, count: i64, at: &str) -> Result<String> {
    let row=db::rows(&state.db,"SELECT encode(sha256(convert_to(string_agg(v.id||':'||v.card_id||':'||v.content_hash||':'||c.content_hash,',' ORDER BY v.id),'UTF8')),'hex') AS digest FROM variants v JOIN cards c ON c.id=v.card_id",vec![]).await?.into_iter().next().unwrap_or(json!({}));
    let hash = crate::catalog::hash(&json!({"localCatalog":row["digest"].as_str().unwrap_or("")}));
    complete(state, "catalog", &hash, count, at).await?;
    state.catalog.invalidate().await;
    Ok(hash)
}
pub async fn catalog_sync(state: &Arc<AppState>, force: bool) -> Result<serde_json::Value> {
    let _lock = state.catalog_sync.lock().await;
    let at = db::iso(time::OffsetDateTime::now_utc());
    set_status(state, "catalog", "running", None, None, None).await?;
    let result=async{
        let probe=crate::upstream::list_cards(state,&json!({"limit":1,"page":1})).await?;
        let fingerprint=crate::catalog::hash(&json!({"total":probe["pagination"]["total"],"filters":probe.get("meta").and_then(|meta|meta.get("filters")).cloned().unwrap_or(json!({}))}));
        let existing=db::rows(&state.db,"SELECT key,content_hash AS hash,row_count AS count FROM sync_state WHERE key=ANY(ARRAY['catalog','catalog_upstream'])",vec![]).await?;
        let previous=existing.iter().find(|row|row["key"]=="catalog").and_then(|row|row["count"].as_i64()).unwrap_or(0);let same=existing.iter().find(|row|row["key"]=="catalog_upstream").is_some_and(|row|row["hash"]==fingerprint);
        let snapshot=crate::catalog::metadata::expanded(state,force||!same,true).await?;let expected=crate::catalog::metadata::total(&snapshot,previous);let(local,sets)=local_counts(state).await?;
        if !force&&same&&shortfalls(&snapshot,&sets).is_empty()&&local>0&&(expected<=0||local>=expected){let count=local.max(expected).max(previous);let hash=publish(state,count,&at).await?;return Ok(json!({"changed":false,"pages":0,"variantCount":count,"hash":hash}));}
        let maximum=state.config.values.get("SYNC_MAX_PAGES").map(|value|crate::http::zod::js_number(value)).filter(|value|*value!=0.0&&value.is_finite());let mut page=1_i64;let mut pages=0_i64;let mut failures=0_i64;let mut seen=std::collections::HashSet::<String>::new();let mut cards=std::collections::HashSet::<String>::new();
        loop{let response=crate::upstream::list_cards(state,&json!({"limit":100,"page":page})).await?;pages+=1;
            for item in response["data"].as_array().map(Vec::as_slice).unwrap_or(&[]){let number=db::string(item,"variantNumber");if seen.contains(&number.to_lowercase()){continue;}match crate::upstream::card(state,number).await{Ok(card)=>{if let Some(variants)=card["variants"].as_array(){for variant in variants{seen.insert(db::string(variant,"variantNumber").to_lowercase());}}let id=db::string(&card,"id");if cards.contains(id){continue;}
if crate::catalog::store::upsert(state,&card).await.is_ok(){cards.insert(id.into());}else{failures+=1;}},Err(_)=>failures+=1}}
            if response["pagination"]["hasNext"]!=true||page>=response["pagination"]["totalPages"].as_i64().unwrap_or(page)||maximum.is_some_and(|max|pages as f64>=max){break;}page+=1;
        }
        let(local,sets)=local_counts(state).await?;let final_total=local.max(expected).max(crate::catalog::metadata::total(&snapshot,0));let shortfalls=shortfalls(&snapshot,&sets);
        let incomplete=failures>0||!shortfalls.is_empty()||maximum.is_some()&&local<final_total;
        let upstream_hash=if incomplete{crate::catalog::hash(&json!({"total":pages,"filters":{"partial":true,"fingerprint":fingerprint,"upsertFailures":failures,"shortfalls":shortfalls}}))}else{fingerprint};
        complete(state,"catalog_upstream",&upstream_hash,local,&at).await?;let hash=publish(state,local,&at).await?;Ok::<_,AppError>(json!({"changed":true,"pages":pages,"variantCount":local,"hash":hash}))
    }.await;
    if result.is_err() {
        set_status(
            state,
            "catalog",
            "failed",
            None,
            None,
            Some("Catalog synchronization failed"),
        )
        .await?;
    }
    result
}
#[utoipa::path(post,path="/api/v1/sync/catalog",operation_id="syncCatalog",responses((status=200,body=astral_grove_api_types::SyncCatalogResponse)))]
async fn catalog(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    axum::extract::RawQuery(query): axum::extract::RawQuery,
) -> Result<Json<astral_grove_api_types::SyncCatalogResponse>> {
    if !crate::middleware::admin(&state, &headers) {
        return Err(AppError::new(401, "UNAUTHORIZED", "Admin token required"));
    }
    let query = http::query(query.as_deref());
    let force = matches!(query["force"].as_str(), Some("true" | "1"));
    http::respond(
        "SyncCatalogResponse",
        json!({"data":catalog_sync(&state,force).await?}),
    )
}
#[utoipa::path(post,path="/api/v1/sync/prices",operation_id="syncPrices",responses((status=200,body=astral_grove_api_types::SyncPricesResponse)))]
async fn prices(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<astral_grove_api_types::SyncPricesResponse>> {
    if !crate::middleware::admin(&state, &headers) {
        return Err(AppError::new(401, "UNAUTHORIZED", "Admin token required"));
    }
    let _lock = state.price_sync.lock().await;
    let result = crate::cardmarket::guide::sync(&state).await?;
    let days = state
        .config
        .values
        .get("PRICE_HISTORY_RETAIN_DAYS")
        .and_then(|value| value.parse().ok())
        .unwrap_or(90);
    let snapshots = state
        .config
        .values
        .get("PRICE_HISTORY_RETAIN_SNAPSHOTS")
        .and_then(|value| value.parse().ok())
        .unwrap_or(30);
    if crate::cardmarket::guide::prune(&state, days, snapshots, false)
        .await
        .is_err()
    {
        tracing::warn!(category = "price-retention", "Price history prune failed");
    }
    http::respond("SyncPricesResponse", json!({"data":result}))
}
