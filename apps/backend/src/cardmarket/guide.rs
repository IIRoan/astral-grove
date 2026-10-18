use crate::{
    AppState, catalog, db,
    error::{AppError, Result},
};
use sea_orm::TransactionTrait;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
#[derive(serde::Deserialize)]
pub struct Guide {
    pub version: i64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "priceGuides")]
    pub prices: Vec<Entry>,
}
#[derive(serde::Deserialize)]
pub struct Entry {
    #[serde(rename = "idProduct")]
    pub id: i64,
    #[serde(rename = "idCategory")]
    pub category: i64,
    pub avg: Option<f64>,
    pub low: Option<f64>,
    pub trend: Option<f64>,
    pub avg1: Option<f64>,
    pub avg7: Option<f64>,
    pub avg30: Option<f64>,
    #[serde(rename = "avg-foil")]
    pub avg_foil: Option<f64>,
    #[serde(rename = "low-foil")]
    pub low_foil: Option<f64>,
    #[serde(rename = "trend-foil")]
    pub trend_foil: Option<f64>,
    #[serde(rename = "avg1-foil")]
    pub avg1_foil: Option<f64>,
    #[serde(rename = "avg7-foil")]
    pub avg7_foil: Option<f64>,
    #[serde(rename = "avg30-foil")]
    pub avg30_foil: Option<f64>,
}
pub fn decimal(value: Option<f64>) -> Value {
    let Some(value) = value.filter(|value| value.is_finite()) else {
        return Value::Null;
    };
    if value.abs() >= 1e21 {
        return json!(crate::http::zod::js_number_string(value));
    }
    let bits = value.abs().to_bits();
    let significand = if bits >> 52 & 0x7ff == 0 {
        bits & ((1 << 52) - 1)
    } else {
        (bits & ((1 << 52) - 1)) | (1 << 52)
    };
    let exponent = ((bits >> 52 & 0x7ff) as i32) - 1023 - 52;
    let numerator = u128::from(significand) * 100;
    let integer = if exponent >= 0 {
        numerator.checked_shl(exponent as u32).unwrap_or(0)
    } else {
        let shift = (-exponent) as u32;
        if shift >= 128 {
            0
        } else {
            let whole = numerator >> shift;
            let remainder = numerator & ((1_u128 << shift) - 1);
            whole + u128::from(remainder >= (1_u128 << (shift - 1)))
        }
    };
    json!(format!(
        "{}{}.{:02}",
        if value < 0.0 { "-" } else { "" },
        integer / 100,
        integer % 100
    ))
}
fn row(id: i64, foil: bool, values: [Option<f64>; 6], updated: &str) -> Value {
    let digest = hex::encode(Sha256::digest(
        format!(
            "astral-grove:cardmarket-price:{id}:{}",
            if foil { "foil" } else { "plain" }
        )
        .as_bytes(),
    ));
    let id_string = format!(
        "{}-{}-{}-{}-{}",
        &digest[..8],
        &digest[8..12],
        &digest[12..16],
        &digest[16..20],
        &digest[20..32]
    );
    let mut payload = json!({"cardmarketId":id,"isFoil":foil,"lowPrice":decimal(values[0]),"marketPrice":decimal(values[1]),"midPrice":decimal(values[2]),"avg1Day":decimal(values[3]),"avg7Day":decimal(values[4]),"avg30Day":decimal(values[5]),"lastUpdated":updated});
    let digest = catalog::hash(&payload);
    payload["id"] = json!(id_string);
    payload["provider"] = json!("cardmarket");
    payload["currency"] = json!("EUR");
    payload["highPrice"] = Value::Null;
    payload["contentHash"] = json!(digest);
    payload
}
pub fn map(guide: &Guide) -> Result<Vec<Value>> {
    let at = crate::instant::parse_js_date(&guide.created_at).ok_or_else(AppError::internal)?;
    let timestamp = time::OffsetDateTime::from_unix_timestamp_nanos(i128::from(at) * 1_000_000)
        .map_err(|_| AppError::internal())?;
    let updated = db::iso(timestamp);
    let mut rows = Vec::new();
    for entry in &guide.prices {
        let plain = entry.avg.is_some()
            || entry.avg1.is_some()
            || entry.avg7.is_some()
            || entry.avg30.is_some()
            || entry.trend.is_some_and(|value| value > 0.0);
        let trend = entry
            .trend
            .filter(|value| !(*value == 0.0 && entry.avg.is_none() && entry.avg7.is_none()));
        if plain {
            rows.push(row(
                entry.id,
                false,
                [
                    entry.low,
                    trend,
                    entry.avg,
                    entry.avg1,
                    entry.avg7,
                    entry.avg30,
                ],
                &updated,
            ));
        }
        let foil = [
            entry.low_foil,
            entry.trend_foil,
            entry.avg_foil,
            entry.avg1_foil,
            entry.avg7_foil,
            entry.avg30_foil,
        ];
        if foil.iter().any(Option::is_some) {
            rows.push(row(entry.id, true, foil, &updated));
        }
    }
    Ok(rows)
}
pub async fn download(state: &AppState, path: &str) -> Result<Value> {
    let base = state
        .config
        .values
        .get("CARDMARKET_EXPORT_BASE_URL")
        .map(String::as_str)
        .unwrap_or("https://downloads.s3.cardmarket.com/productCatalog");
    let response = state
        .client
        .get(format!("{}{path}", base.trim_end_matches('/')))
        .header("accept", "application/json")
        .header("user-agent", "AstralGrove/1.0 (+https://rift.solace.onl)")
        .header("referer", "https://www.cardmarket.com/")
        .send()
        .await
        .map_err(|_| AppError::internal())?;
    if !response.status().is_success() {
        return Err(AppError::internal());
    }
    let body = crate::images::capped(response, 100 * 1024 * 1024)
        .await
        .ok_or_else(AppError::internal)?;
    Ok(serde_json::from_slice(&body)?)
}
const RECORD: &str = "jsonb_to_recordset($1::jsonb) AS x(\"id\" text,\"cardmarketId\" integer,\"isFoil\" boolean,\"lowPrice\" text,\"marketPrice\" text,\"midPrice\" text,\"highPrice\" text,\"avg1Day\" text,\"avg7Day\" text,\"avg30Day\" text,\"lastUpdated\" text,\"contentHash\" text)";
pub async fn persist(
    state: &AppState,
    rows: &[Value],
    products: usize,
    game: i64,
    created: &str,
) -> Result<Value> {
    let mut tuples: Vec<String> = rows
        .iter()
        .map(|row| {
            format!(
                "{}:{}:{}:{}",
                row["cardmarketId"],
                row["isFoil"],
                db::string(row, "lastUpdated"),
                row["marketPrice"].as_str().unwrap_or("")
            )
        })
        .collect();
    tuples.sort();
    let hash = hex::encode(Sha256::digest(tuples.join("|").as_bytes()));
    let tx = state.db.begin().await?;
    db::execute(&tx, "SELECT pg_advisory_xact_lock(1280472988)", vec![]).await?;
    let existing = db::rows(
        &tx,
        "SELECT content_hash AS hash,row_count AS count FROM sync_state WHERE key='prices'",
        vec![],
    )
    .await?
    .into_iter()
    .next();
    let changed = existing.as_ref().is_none_or(|old| old["hash"] != hash);
    if changed {
        for chunk in rows.chunks(200) {
            let input = json!(chunk);
            db::execute(&tx,&format!("INSERT INTO price_daily(cardmarket_id,is_foil,price_date,provider,currency,low_price,market_price,mid_price,high_price,synced_at) SELECT x.\"cardmarketId\",x.\"isFoil\",(now() AT TIME ZONE 'UTC')::date,'cardmarket','EUR',x.\"lowPrice\"::numeric,x.\"marketPrice\"::numeric,x.\"midPrice\"::numeric,x.\"highPrice\"::numeric,now() FROM {RECORD} ON CONFLICT(cardmarket_id,is_foil,price_date) DO UPDATE SET low_price=EXCLUDED.low_price,market_price=EXCLUDED.market_price,mid_price=EXCLUDED.mid_price,high_price=EXCLUDED.high_price,synced_at=EXCLUDED.synced_at"),vec![input.clone().into()]).await?;
            db::execute(&tx,&format!("INSERT INTO prices(id,cardmarket_id,is_foil,provider,currency,low_price,market_price,mid_price,high_price,avg_1_day,avg_7_day,avg_30_day,upstream_last_updated,content_hash,fetched_at) SELECT DISTINCT ON(x.\"cardmarketId\",x.\"isFoil\") x.\"id\"::uuid,x.\"cardmarketId\",x.\"isFoil\",'cardmarket','EUR',x.\"lowPrice\"::numeric,x.\"marketPrice\"::numeric,x.\"midPrice\"::numeric,x.\"highPrice\"::numeric,x.\"avg1Day\"::numeric,x.\"avg7Day\"::numeric,x.\"avg30Day\"::numeric,x.\"lastUpdated\"::timestamptz,x.\"contentHash\",now() FROM {RECORD} ON CONFLICT(cardmarket_id,is_foil) DO UPDATE SET provider=EXCLUDED.provider,currency=EXCLUDED.currency,low_price=EXCLUDED.low_price,market_price=EXCLUDED.market_price,mid_price=EXCLUDED.mid_price,high_price=EXCLUDED.high_price,avg_1_day=EXCLUDED.avg_1_day,avg_7_day=EXCLUDED.avg_7_day,avg_30_day=EXCLUDED.avg_30_day,upstream_last_updated=EXCLUDED.upstream_last_updated,content_hash=EXCLUDED.content_hash,fetched_at=EXCLUDED.fetched_at"),vec![input.clone().into()]).await?;
            db::execute(&tx,&format!("INSERT INTO price_history(cardmarket_id,is_foil,provider,currency,low_price,market_price,mid_price,high_price,avg_1_day,avg_7_day,avg_30_day,upstream_last_updated,content_hash) SELECT x.\"cardmarketId\",x.\"isFoil\",'cardmarket','EUR',x.\"lowPrice\"::numeric,x.\"marketPrice\"::numeric,x.\"midPrice\"::numeric,x.\"highPrice\"::numeric,x.\"avg1Day\"::numeric,x.\"avg7Day\"::numeric,x.\"avg30Day\"::numeric,x.\"lastUpdated\"::timestamptz,x.\"contentHash\" FROM {RECORD} ON CONFLICT DO NOTHING"),vec![input.into()]).await?;
        }
        if !rows.is_empty() {
            db::execute(&tx,"DELETE FROM prices p WHERE NOT EXISTS(SELECT 1 FROM jsonb_to_recordset($1::jsonb) AS x(\"cardmarketId\" integer,\"isFoil\" boolean) WHERE x.\"cardmarketId\"=p.cardmarket_id AND x.\"isFoil\"=p.is_foil)",vec![json!(rows).into()]).await?;
        }
    }
    db::execute(&tx,"INSERT INTO sync_state(key,status,content_hash,row_count,last_success_at,last_attempt_at) VALUES('prices','idle',$1,$2,now(),now()) ON CONFLICT(key) DO UPDATE SET status='idle',content_hash=EXCLUDED.content_hash,row_count=CASE WHEN $3 THEN EXCLUDED.row_count ELSE sync_state.row_count END,last_success_at=CASE WHEN $3 THEN now() ELSE sync_state.last_success_at END,last_attempt_at=now(),last_error=NULL",vec![hash.clone().into(),(rows.len() as i64).into(),changed.into()]).await?;
    tx.commit().await?;
    Ok(
        json!({"changed":changed,"rowCount":if changed{rows.len() as i64}else{existing.and_then(|row|row["count"].as_i64()).unwrap_or(rows.len() as i64)},"productCount":products,"hash":hash,"source":"cardmarket","gameId":game,"exportCreatedAt":created}),
    )
}
pub async fn sync(state: &AppState) -> Result<Value> {
    crate::sync::set_status(state, "prices", "running", None, None, None).await?;
    let result = async {
        let game = state
            .config
            .values
            .get("CARDMARKET_GAME_ID")
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(22);
        let input = download(state, &format!("/priceGuide/price_guide_{game}.json")).await?;
        let guide: Guide = serde_json::from_value(input)?;
        let rows = map(&guide)?;
        let mut result = persist(state, &rows, guide.prices.len(), game, &guide.created_at).await?;
        let unmapped = db::rows(
            &state.db,
            "SELECT count(*)::bigint AS count FROM variants WHERE cardmarket_id IS NULL",
            vec![],
        )
        .await?
        .first()
        .and_then(|row| row["count"].as_i64())
        .unwrap_or(0);
        result["cardmarketIdsBackfilled"] = if result["changed"] == true || unmapped > 0 {
            json!(super::backfill::run(state, game).await?)
        } else {
            json!(0)
        };
        if result["changed"] == true || result["cardmarketIdsBackfilled"].as_i64().unwrap_or(0) > 0
        {
            state.catalog.invalidate().await;
        }
        Ok::<_, AppError>(result)
    }
    .await;
    if result.is_err() {
        crate::sync::set_status(
            state,
            "prices",
            "failed",
            None,
            None,
            Some("Cardmarket synchronization failed"),
        )
        .await?;
    }
    result
}
pub async fn prune(state: &AppState, days: i64, snapshots: i64, dry_run: bool) -> Result<u64> {
    let query = "SELECT id FROM(SELECT id,captured_at,row_number() OVER(PARTITION BY cardmarket_id,is_foil ORDER BY captured_at DESC,id DESC) AS rn FROM price_history) ranked WHERE captured_at<now()-($1::text||' days')::interval OR rn>$2";
    if dry_run {
        return Ok(db::rows(
            &state.db,
            &format!("SELECT count(*)::bigint AS count FROM({query}) stale"),
            vec![days.into(), snapshots.into()],
        )
        .await?
        .first()
        .and_then(|row| row["count"].as_u64())
        .unwrap_or(0));
    }
    db::execute(
        &state.db,
        &format!("DELETE FROM price_history WHERE id IN({query})"),
        vec![days.into(), snapshots.into()],
    )
    .await
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn javascript_fixed_rounding() {
        for (value, expected) in [
            (1.125, "1.13"),
            (2.675, "2.67"),
            (-1.125, "-1.13"),
            (-0.0, "0.00"),
            (0.005, "0.01"),
        ] {
            assert_eq!(decimal(Some(value)), json!(expected));
        }
    }
}
