use super::{mapper, store};
use crate::{AppState, db, error::Result, search, upstream};
use serde_json::{Value, json};
use std::time::Duration;
use tokio::sync::Mutex;
pub struct Cache {
    checks: Mutex<crate::cache::TtlCache<bool>>,
    results: Mutex<crate::cache::TtlCache<Value>>,
    hashes: std::sync::Mutex<(u64, Option<(String, String)>)>,
}
impl Default for Cache {
    fn default() -> Self {
        Self {
            checks: Mutex::new(crate::cache::TtlCache::new(
                Duration::from_secs(900),
                200,
                None,
            )),
            results: Mutex::new(crate::cache::TtlCache::new(
                Duration::from_secs(300),
                100,
                None,
            )),
            hashes: Default::default(),
        }
    }
}
impl Cache {
    pub async fn invalidate(&self) {
        if let Ok(mut hashes) = self.hashes.lock() {
            *hashes = (hashes.0.wrapping_add(1), None);
        }
        self.results.lock().await.clear();
    }
    pub fn hashes(&self) -> (u64, Option<(String, String)>) {
        self.hashes
            .lock()
            .map(|hashes| hashes.clone())
            .unwrap_or_default()
    }
    // A concurrent invalidate bumps the generation, so hashes read before it are not memoized.
    pub fn remember_hashes(&self, generation: u64, value: (String, String)) {
        if let Ok(mut hashes) = self.hashes.lock()
            && hashes.0 == generation
        {
            hashes.1 = Some(value);
        }
    }
}
const JOINS: &str = "FROM variants v JOIN cards c ON c.id=v.card_id JOIN sets s ON s.id=v.set_id";
const COLUMNS: &str = "c.id::text AS \"cardId\",c.name,c.type,c.super,c.energy,c.might,c.power,to_char(c.ban_effective_date AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"banEffectiveDate\",v.id::text AS \"variantId\",v.variant_number AS \"variantNumber\",v.rarity,v.variant_type AS \"variantType\",v.foil_mode AS \"foilMode\",v.variant_label AS \"variantLabel\",v.image_url AS \"imageUrl\",v.cardmarket_id AS \"cardmarketId\",v.tcgplayer_id AS \"tcgplayerId\",s.code AS \"setCode\",coalesce((SELECT jsonb_agg(co.name) FROM card_colors cc JOIN colors co ON co.id=cc.color_id WHERE cc.card_id=c.id),'[]'::jsonb) AS colors";
fn number(query: &Value, key: &str, default: i64) -> i64 {
    query[key].as_i64().unwrap_or(default)
}
fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    db::string(value, key)
}
fn bool_value(value: &Value, key: &str) -> bool {
    value[key] == true
}
fn paged(query: &Value) -> bool {
    query["sortBy"] != "price"
        && text(query, "q").trim().is_empty()
        && ["types", "colors", "sets", "super", "variants", "rarities"]
            .iter()
            .all(|key| text(query, key).is_empty())
        && !bool_value(query, "excludeTokens")
}
pub(crate) fn candidate_query(query: &Value) -> (String, Vec<sea_orm::Value>, bool) {
    let mut sql = search::Sql::new();
    let filter = search::filters(query, &mut sql);
    let page = number(query, "page", 1);
    let limit = number(query, "limit", 50);
    let offset = (page - 1).saturating_mul(limit);
    let direct = paged(query);
    let order = match text(query, "sortBy") {
        "energy" => "c.energy",
        "variantNumber" => "v.variant_number",
        _ => "c.name",
    };
    let dir = if query["dir"] == "desc" {
        "DESC"
    } else {
        "ASC"
    };
    let tail = if direct {
        format!("ORDER BY {order} {dir},c.name ASC LIMIT {limit} OFFSET {offset}")
    } else {
        String::new()
    };
    (
        format!("SELECT {COLUMNS} {JOINS} WHERE {filter} {tail}"),
        sql.values,
        direct,
    )
}
pub(crate) async fn local_without_upstream(state: &AppState, query: &Value) -> Result<Value> {
    let (hash, _) = store::hashes(state).await?;
    local(state, query, &hash).await
}
async fn local(state: &AppState, query: &Value, hash: &str) -> Result<Value> {
    let (statement, values, direct) = candidate_query(query);
    let page = number(query, "page", 1);
    let limit = number(query, "limit", 50);
    let offset = (page - 1).saturating_mul(limit);
    let mut sql = search::Sql::new();
    let filter = search::filters(query, &mut sql);
    let mut rows = db::rows(&state.db, &statement, values).await?;
    let null_card_ids: Vec<String> = rows
        .iter()
        .filter(|row| row["cardmarketId"].is_null())
        .filter_map(|row| row["cardId"].as_str().map(str::to_owned))
        .collect();
    if !null_card_ids.is_empty() {
        let siblings=db::rows(&state.db,"SELECT card_id::text AS \"cardId\",variant_number AS \"variantNumber\",cardmarket_id AS \"cardmarketId\" FROM variants WHERE card_id=ANY($1::text[]::uuid[]) AND cardmarket_id IS NOT NULL",vec![null_card_ids.into()]).await?;
        for row in &mut rows {
            if row["cardmarketId"].is_null() {
                let siblings: Vec<_> = siblings
                    .iter()
                    .filter(|sibling| sibling["cardId"] == row["cardId"])
                    .cloned()
                    .collect();
                row["cardmarketId"] = json!(crate::prices::resolve_id(
                    text(row, "variantNumber"),
                    &siblings
                ));
            }
        }
    }
    let ids = rows
        .iter()
        .filter_map(|row| row["cardmarketId"].as_i64())
        .collect();
    let prices = crate::prices::index(state, Some(ids)).await?;
    let mut items = mapper::group(
        rows.iter()
            .map(|row| mapper::row_item(state, row, &prices))
            .collect(),
    );
    let total = if direct {
        db::rows(
            &state.db,
            &format!("SELECT count(*)::bigint AS total {JOINS} WHERE {filter}"),
            sql.values,
        )
        .await?
        .first()
        .and_then(|row| row["total"].as_i64())
        .unwrap_or(0)
    } else {
        let sign = if query["dir"] == "desc" {
            std::cmp::Ordering::Greater
        } else {
            std::cmp::Ordering::Less
        };
        let parsed = search::parse(text(query, "q"));
        let price = |item: &Value| {
            let mut maximum = item["priceEur"]["market"].as_f64().unwrap_or(0.0).max(0.0);
            if let Some(prints) = item["printings"].as_array() {
                for printing in prints {
                    maximum = maximum.max(printing["priceEur"]["market"].as_f64().unwrap_or(0.0));
                }
            }
            maximum
        };
        items.sort_by(|left, right| {
            if query["sortBy"] == "price" {
                let diff = price(left).total_cmp(&price(right));
                let diff = if sign == std::cmp::Ordering::Greater {
                    diff.reverse()
                } else {
                    diff
                };
                return diff.then_with(|| search::compare(text(left, "name"), text(right, "name")));
            }
            if !text(query, "q").trim().is_empty() {
                return search::score(left, &parsed)
                    .cmp(&search::score(right, &parsed))
                    .then_with(|| {
                        search::hits(text(right, "name"), &parsed)
                            .cmp(&search::hits(text(left, "name"), &parsed))
                    })
                    .then_with(|| search::compare(text(left, "name"), text(right, "name")))
                    .then_with(|| {
                        search::compare(text(left, "variantNumber"), text(right, "variantNumber"))
                    });
            }
            let diff = match text(query, "sortBy") {
                "energy" => number(left, "energy", 0).cmp(&number(right, "energy", 0)),
                "variantNumber" => {
                    search::compare(text(left, "variantNumber"), text(right, "variantNumber"))
                }
                _ => search::compare(text(left, "name"), text(right, "name")),
            };
            let diff = if sign == std::cmp::Ordering::Greater {
                diff.reverse()
            } else {
                diff
            };
            diff.then_with(|| search::compare(text(left, "name"), text(right, "name")))
        });
        let total = items.len() as i64;
        items = items
            .into_iter()
            .skip(usize::try_from(offset).unwrap_or(usize::MAX))
            .take(limit as usize)
            .collect();
        total
    };
    Ok(json!({"items":items,"total":total,"catalogHash":hash}))
}
fn upstream_params(query: &Value, page: i64) -> Value {
    let mut params = json!({"page":page,"limit":number(query,"limit",50).min(100),"sortBy":query["sortBy"],"dir":query["dir"]});
    for key in [
        "q",
        "types",
        "variants",
        "sets",
        "rarities",
        "energyMin",
        "energyMax",
        "mightMin",
        "mightMax",
        "powerMin",
        "powerMax",
    ] {
        if let Some(value) = query.get(key)
            && !value.is_null()
            && value != ""
        {
            params[key] = value.clone();
        }
    }
    if query.get("super").is_some() {
        params["supertypes"] = query["super"].clone();
    }
    if query["colorMode"] != "within"
        && let Some(value) = query.get("colors")
    {
        params["colors"] = value.clone();
    }
    params
}
pub async fn search(state: &AppState, query: &Value) -> Result<Value> {
    let (hash, price_hash) = store::hashes(state).await?;
    let key = super::hash(&json!({"query":query,"catalog":hash,"prices":price_hash}));
    let refresh = bool_value(query, "refresh");
    let text_search = text(query, "q").trim().encode_utf16().count() >= 2;
    if !refresh
        && !text_search
        && let Some(value) = state.catalog.results.lock().await.get(&key)
        && number(value, "total", 0) > 0
    {
        return Ok(value.clone());
    }
    let mut result = local(state, query, &hash).await?;
    let empty =
        number(&result, "total", 0) == 0 || result["items"].as_array().is_none_or(Vec::is_empty);
    let check = super::hash(query);
    let checked = state.catalog.checks.lock().await.contains(&check);
    let mut source = "cache";
    if refresh || empty || !checked && (text_search || number(query, "page", 1) == 1) {
        let incomparable = query["colorMode"] == "within" && !text(query, "colors").is_empty()
            || query["sortBy"] == "energy"
            || query.get("energyMin").is_some()
            || query.get("energyMax").is_some();
        let first_page = number(query, "page", 1);
        let mut changed = 0;
        let mut clean = 0;
        let mut upstream_total = 0;
        let mut failed = false;
        for page in (first_page..).take(if text_search { 20 } else { 100 }) {
            let upstream = match upstream::list_cards(state, &upstream_params(query, page)).await {
                Ok(value) => value,
                Err(_) => {
                    failed = true;
                    break;
                }
            };
            upstream_total = number(&upstream["pagination"], "total", 0);
            let entries = upstream["data"]
                .as_array()
                .map(Vec::as_slice)
                .unwrap_or(&[]);
            let numbers: Vec<String> = entries
                .iter()
                .filter_map(|item| item["variantNumber"].as_str().map(str::to_lowercase))
                .collect();
            let existing=db::rows(&state.db,"SELECT lower(variant_number) AS number FROM variants WHERE lower(variant_number)=ANY($1::text[])",vec![numbers.into()]).await?;
            let missing: Vec<_> = entries
                .iter()
                .filter(|item| {
                    !existing.iter().any(|row| {
                        text(row, "number") == text(item, "variantNumber").to_lowercase()
                    })
                })
                .collect();
            for item in &missing {
                if let Ok(card) = upstream::card(state, text(item, "variantNumber")).await
                    && store::upsert(state, &card).await.is_ok()
                {
                    changed += 1;
                }
            }
            if missing.is_empty() {
                clean += 1;
            } else {
                clean = 0;
            }
            let local_total = number(&result, "total", 0) + changed;
            if !empty
                && changed == 0
                && missing.is_empty()
                && !incomparable
                && local_total >= upstream_total
            {
                break;
            }
            let caught = if incomparable {
                clean >= 5
            } else {
                local_total >= upstream_total
            };
            if caught
                || upstream["pagination"]["hasNext"] != true
                || page >= number(&upstream["pagination"], "totalPages", page)
            {
                break;
            }
        }
        if changed > 0 {
            state.catalog.invalidate().await;
            result = local(state, query, &hash).await?;
            source = "mixed";
        } else if !failed && empty && upstream_total == 0 {
            source = "upstream";
        }
        let mut checks = state.catalog.checks.lock().await;
        if !failed && (incomparable || upstream_total <= number(&result, "total", 0) || changed > 0)
        {
            checks.insert(check, true, 0);
        } else {
            checks.remove(&check);
        }
    }
    result["source"] = json!(source);
    if number(&result, "total", 0) > 0 || source == "upstream" {
        let mut cache = state.catalog.results.lock().await;
        cache.insert(key, result.clone(), 0);
    } else {
        state.catalog.results.lock().await.remove(&key);
    }
    Ok(result)
}
pub async fn index(state: &AppState) -> Result<Value> {
    let rows=db::rows(&state.db,&format!("SELECT c.upstream_raw AS card,v.upstream_raw AS variant,v.cardmarket_id AS \"cardmarketId\",v.tcgplayer_id AS \"tcgplayerId\" {JOINS} ORDER BY c.name,v.variant_number"),vec![]).await?;
    let prices = crate::prices::index(state, None).await?;
    let items = mapper::group(
        rows.iter()
            .map(|row| {
                let mut variant = row["variant"].clone();
                for key in ["cardmarketId", "tcgplayerId"] {
                    if variant[key].is_null() {
                        variant[key] = row[key].clone();
                    }
                }
                mapper::item(state, &row["card"], &variant, &prices)
            })
            .collect(),
    );
    let (hash, price_hash) = store::hashes(state).await?;
    Ok(
        json!({"meta":{"total":items.len(),"catalogHash":hash,"pricesCatalogHash":price_hash,"source":"cache"},"data":items}),
    )
}
