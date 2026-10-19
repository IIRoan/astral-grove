use crate::{AppState, db, error::Result, http};
use astral_grove_api_types::{
    PriceHistoryResponse, PriceStatsBatchRequest, PriceStatsBatchResponse, PricesListResponse,
};
use axum::{
    Json,
    extract::{RawQuery, State},
};
use serde_json::{Value, json};
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};

pub const PRICE_FIELDS: &str = "cardmarket_id AS \"cardmarketId\",is_foil AS \"isFoil\",'cardmarket' AS provider,'EUR' AS currency,low_price AS \"lowPrice\",market_price AS \"marketPrice\",mid_price AS \"midPrice\",high_price AS \"highPrice\"";
pub async fn rows(state: &AppState, ids: Option<Vec<i64>>) -> Result<Vec<Value>> {
    let select = format!(
        "SELECT id::text AS id,{PRICE_FIELDS},avg_1_day AS \"avg1Day\",avg_7_day AS \"avg7Day\",avg_30_day AS \"avg30Day\",to_char(upstream_last_updated AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"lastUpdated\" FROM prices"
    );
    match ids {
        Some(ids) => {
            db::rows(
                &state.db,
                &format!("{select} WHERE cardmarket_id=ANY($1::bigint[])"),
                vec![ids.into()],
            )
            .await
        }
        None => db::rows(&state.db, &select, vec![]).await,
    }
}
pub type Index = std::collections::HashMap<i64, Vec<Value>>;
pub async fn index(state: &AppState, ids: Option<Vec<i64>>) -> Result<Index> {
    let mut index = Index::new();
    for row in rows(state, ids).await? {
        if let Some(id) = row["cardmarketId"].as_i64() {
            index.entry(id).or_default().push(row);
        }
    }
    Ok(index)
}
pub fn candidates(number: &str) -> Vec<String> {
    let trimmed = number.trim().to_lowercase();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let mut values = vec![trimmed.clone()];
    for suffix in ["-foil", "-release", "*"] {
        if let Some(base) = trimmed.strip_suffix(suffix)
            && !base.is_empty()
            && !values.iter().any(|v| v == base)
        {
            values.push(base.into());
        }
    }
    if let Some((prefix, suffix)) = trimmed.rsplit_once('-') {
        let bytes = suffix.as_bytes();
        if bytes.len() > 1
            && bytes.last().is_some_and(u8::is_ascii_alphabetic)
            && bytes[..bytes.len() - 1].iter().all(u8::is_ascii_digit)
        {
            let base = format!("{prefix}-{}", &suffix[..suffix.len() - 1]);
            if !values.contains(&base) {
                values.push(base);
            }
        }
    }

    values
}
pub fn resolve_id(number: &str, variants: &[Value]) -> Option<i64> {
    for candidate in candidates(number) {
        if let Some(id) = variants
            .iter()
            .find(|row| {
                row["variantNumber"]
                    .as_str()
                    .is_some_and(|number| number.to_lowercase() == candidate)
            })
            .and_then(|row| row["cardmarketId"].as_i64())
        {
            return Some(id);
        }
    }
    None
}
async fn market_id(state: &AppState, input: &Value) -> Result<Option<i64>> {
    if let Some(id) = input["cardmarketId"].as_i64() {
        return Ok(Some(id));
    }
    let Some(number) = input["variantNumber"].as_str() else {
        return Ok(None);
    };
    let rows=db::rows(&state.db,"SELECT variant_number AS \"variantNumber\",cardmarket_id AS \"cardmarketId\" FROM variants WHERE lower(variant_number)=ANY($1::text[])",vec![candidates(number).into()]).await?;
    Ok(resolve_id(number, &rows))
}
#[utoipa::path(get,path="/api/v1/prices",operation_id="listPrices",responses((status=200,body=PricesListResponse)))]
async fn list(
    State(state): State<Arc<AppState>>,
    RawQuery(query): RawQuery,
) -> Result<Json<PricesListResponse>> {
    let input = http::value("PricesListQuery", &http::query(query.as_deref()))?;
    let id = market_id(&state, &input).await?;
    let foil = input["isFoil"].as_bool();
    let mut rows = rows(&state, id.map(|id| vec![id])).await?;
    rows.retain(|row| foil.is_none_or(|foil| row["isFoil"] == foil));
    let meta=db::rows(&state.db,"SELECT content_hash AS hash,to_char(last_success_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS synced FROM sync_state WHERE key='prices'",vec![]).await?.into_iter().next().unwrap_or(json!({}));
    http::respond(
        "PricesListResponse",
        json!({"meta":{"pricesCatalogHash":db::string(&meta, "hash"),"lastSyncedAt":meta["synced"],"rowCount":rows.len()},"data":rows}),
    )
}
pub async fn daily(state: &AppState, ids: Vec<i64>, days: i64) -> Result<Vec<Value>> {
    db::rows(&state.db,&format!("SELECT {PRICE_FIELDS},price_date::text AS \"priceDate\" FROM price_daily WHERE cardmarket_id=ANY($1::bigint[]) AND price_date >= (now() AT TIME ZONE 'UTC')::date-$2::integer ORDER BY price_date"),vec![ids.into(),days.into()]).await
}
#[utoipa::path(get,path="/api/v1/prices/history",operation_id="getPriceHistory",responses((status=200,body=PriceHistoryResponse)))]
async fn history(
    State(state): State<Arc<AppState>>,
    RawQuery(query): RawQuery,
) -> Result<Json<PriceHistoryResponse>> {
    let input = http::value("PriceHistoryQuery", &http::query(query.as_deref()))?;
    let id = market_id(&state, &input).await?;
    let days = input["days"].as_i64().unwrap_or(30);
    let foil = input["isFoil"].as_bool();
    let rows = if let Some(id) = id {
        daily(&state, vec![id], days)
            .await?
            .into_iter()
            .filter(|row| foil.is_none_or(|foil| row["isFoil"] == foil))
            .collect()
    } else {
        Vec::new()
    };
    http::respond(
        "PriceHistoryResponse",
        json!({"meta":{"cardmarketId":id,"isFoil":foil,"days":days,"rowCount":rows.len()},"data":rows}),
    )
}
fn trend(row: &Value) -> Option<f64> {
    row["marketPrice"]
        .as_f64()
        .or_else(|| row["midPrice"].as_f64())
}
fn usable(row: &Value) -> bool {
    row["marketPrice"].as_f64().is_some_and(|value| value > 0.0)
        || row["midPrice"].as_f64().is_some()
}
pub fn statistics(
    number: &str,
    id: Option<i64>,
    foil: bool,
    days: i64,
    target: Option<&Value>,
    mut points: Vec<Value>,
) -> Value {
    points.sort_by(|left, right| left["priceDate"].as_str().cmp(&right["priceDate"].as_str()));
    let current = points.last().and_then(trend);
    let baseline = points.first().and_then(trend);
    let values: Vec<_> = points.iter().filter_map(trend).collect();
    let change = match (current, baseline) {
        (Some(current), Some(baseline)) if baseline != 0.0 => {
            Some((((current - baseline) / baseline) * 100.0 + 0.5).floor())
        }
        _ => None,
    };
    let mut result = json!({"variantNumber":number,"cardmarketId":id,"isFoil":foil,"currency":"EUR","currentPrice":current,"baselinePrice":baseline,"minPrice":values.iter().copied().reduce(f64::min),"maxPrice":values.iter().copied().reduce(f64::max),"avgPrice":if values.is_empty(){None}else{Some(values.iter().sum::<f64>()/values.len() as f64)},"listingLow":points.last().map(|row|row["lowPrice"].clone()).unwrap_or(Value::Null),"changePercent":change,"trend":if change.is_some_and(|value|value>=5.0){"up"}else if change.is_some_and(|value|value<=-5.0){"down"}else{"flat"},"days":days,"priceFilterLabel":format!("{} · Cardmarket price guide · EUR",if foil{"Foil"}else{"Non-foil"}),"priceSourceNote":"Trend = Cardmarket price guide estimate. Cheapest listing = lowest offer on the marketplace (any language, any condition). Language and NM filters are not applied.","points":points});
    if let Some(target) = target {
        result["targetPriceCents"] = target.clone();
        if let (Some(target), Some(current)) = (target.as_f64(), current) {
            result["belowTarget"] = json!(current * 100.0 <= target);
        }
    }
    result
}
#[utoipa::path(post,path="/api/v1/prices/stats/batch",operation_id="getPriceStats",request_body=PriceStatsBatchRequest,responses((status=200,body=PriceStatsBatchResponse)))]
async fn stats(
    State(state): State<Arc<AppState>>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<PriceStatsBatchResponse>> {
    let input = http::value("PriceStatsBatchRequest", &body)?;
    let items = db::array(&input, "items");
    let days = input["days"].as_i64().unwrap_or(30);
    let numbers: Vec<String> = items
        .iter()
        .filter_map(|item| item["variantNumber"].as_str())
        .flat_map(candidates)
        .collect();
    let variants=db::rows(&state.db,"SELECT variant_number AS \"variantNumber\",cardmarket_id AS \"cardmarketId\" FROM variants WHERE lower(variant_number)=ANY($1::text[])",vec![numbers.into()]).await?;
    let ids: Vec<i64> = variants
        .iter()
        .filter_map(|row| row["cardmarketId"].as_i64())
        .collect();
    let prices = rows(&state, Some(ids.clone())).await?;
    let daily = daily(&state, ids, days).await?;
    let today = time::OffsetDateTime::now_utc().date().to_string();
    let mut data = Vec::new();
    for item in items {
        let number = db::string(item, "variantNumber");
        let id = resolve_id(number, &variants);
        let requested = item["isFoil"].as_bool().unwrap_or(false);
        let matching = |foil| {
            prices.iter().find(|row| {
                Some(row["cardmarketId"].as_i64()).flatten() == id && row["isFoil"] == foil
            })
        };
        let foil = if matching(requested).is_some_and(usable) {
            requested
        } else if matching(!requested).is_some_and(usable) {
            !requested
        } else {
            requested
        };
        let mut points: Vec<_> = daily
            .iter()
            .filter(|row| row["cardmarketId"].as_i64() == id && row["isFoil"] == foil)
            .cloned()
            .collect();
        if !points.iter().any(|row| row["priceDate"] == today)
            && let Some(current) = matching(foil)
        {
            let mut point = json!({"cardmarketId":id.unwrap_or(0),"isFoil":foil,"provider":"cardmarket","currency":"EUR","priceDate":today});
            for key in ["lowPrice", "marketPrice", "midPrice", "highPrice"] {
                point[key] = current[key].clone();
            }
            points.push(point);
        }
        data.push(statistics(
            number,
            id,
            foil,
            days,
            item.get("targetPriceCents"),
            points,
        ));
    }
    http::respond(
        "PriceStatsBatchResponse",
        json!({"meta":{"days":days,"rowCount":data.len()},"data":data}),
    )
}
pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(list))
        .routes(routes!(history))
        .routes(routes!(stats))
}
