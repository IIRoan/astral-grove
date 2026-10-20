use crate::{
    AppState, catalog, db,
    error::{AppError, Result},
    http, upstream,
};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
fn checked(name: &str, value: &Value) -> Result<Value> {
    http::upstream_decks::schema(name)
        .parse(Some(value))
        .map_err(|_| AppError::internal())?
        .ok_or_else(AppError::internal)
}
pub fn millis(value: &Value) -> i64 {
    value
        .as_str()
        .and_then(crate::instant::parse_js_date)
        .unwrap_or(0)
}
fn image(value: &Value) -> Value {
    let Some(text) = value.as_str().filter(|value| !value.is_empty()) else {
        return Value::Null;
    };
    let path = url::Url::parse(text)
        .ok()
        .map(|url| url.path().to_owned())
        .unwrap_or_else(|| text.into());
    if let Some(key) = path.strip_prefix("/api/v1/images/")
        && crate::images::safe_key(key)
    {
        return json!(format!("https://cdn.piltoverarchive.com/{key}"));
    }
    json!(text)
}
fn legend_fallback(legend: &Value) -> Value {
    json!({"cardId":legend["id"],"variantNumber":legend["variantNumber"],"name":legend["name"],"type":"Legend","super":null,"tags":legend.get("tags").cloned().unwrap_or(json!([])),"colors":db::array(legend,"colors").iter().filter_map(|color|color["name"].as_str()).filter(|name|!name.is_empty()).collect::<Vec<_>>(),"energy":0,"power":0,"setCode":db::string(legend,"variantNumber").split('-').next().unwrap_or(""),"rarity":"Rare","variantType":"Standard","isSignature":false,"imageUrl":image(&legend["imageUrl"])})
}
fn placeholder(reference: &Value) -> Value {
    json!({"cardId":reference["cardId"],"variantNumber":format!("unknown:{}",db::string(reference,"variantId")),"name":"Card not in catalog","type":"Unit","super":null,"tags":[],"colors":[],"energy":0,"power":0,"setCode":"???","rarity":"Unknown","variantType":"Unknown","isSignature":false,"imageUrl":null})
}
// Catalog marks Signature cards via `super`; older printings only via rarity/variant text.
fn is_signature(detail: &Value, variant: &Value) -> bool {
    format!(
        "{} {} {}",
        db::string(detail, "super"),
        db::string(variant, "rarity"),
        db::string(variant, "variantType")
    )
    .to_lowercase()
    .contains("signature")
}
pub async fn deck_card(state: &AppState, number: &str) -> Result<Value> {
    let response = catalog::store::detail(state, number, false).await?;
    let detail = &response["data"];
    let variant = db::array(detail, "variants")
        .iter()
        .find(|variant| variant["variantNumber"] == number)
        .ok_or_else(AppError::internal)?;
    let signature = is_signature(detail, variant);
    http::value(
        "DeckCardInput",
        &json!({"cardId":detail["id"],"variantNumber":number,"name":detail["name"],"type":detail["type"],"super":detail["super"],"tags":detail["tags"],"colors":db::array(detail,"colors").iter().map(|color|color["name"].clone()).collect::<Vec<_>>(),"energy":detail["energy"],"power":detail["power"],"setCode":number.split('-').next().unwrap_or(""),"rarity":variant["rarity"],"variantType":variant["variantType"],"isSignature":signature,"imageUrl":image(&variant["imageUrl"]),"banEffectiveDate":detail["banEffectiveDate"]}),
    )
}
fn payload(detail: &Value) -> Value {
    let created = millis(&detail["createdAt"]);
    let updated = millis(&detail["editedAt"]).max(millis(&detail["updatedAt"]));
    let mut value = json!({"id":detail["id"],"name":detail["name"],"format":"constructed","createdAt":created,"updatedAt":if updated==0{created}else{updated},"legend":null,"champion":null,"mainDeck":[],"runes":[],"battlefields":[],"sideboard":[]});
    if let Some(description) = detail["description"].as_str() {
        value["description"] = json!(description);
    }
    value
}
async fn resolve_refs(state: &AppState, refs: &[Value]) -> Result<HashMap<String, String>> {
    let ids: Vec<String> = refs
        .iter()
        .filter_map(|row| row["variantId"].as_str().map(str::to_owned))
        .collect();
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = db::rows(
        &state.db,
        "SELECT id::text AS id,variant_number AS number FROM variants WHERE id=ANY($1::uuid[])",
        vec![ids.into()],
    )
    .await?;
    let mut resolved: HashMap<_, _> = rows
        .into_iter()
        .map(|row| {
            (
                db::string(&row, "id").to_owned(),
                db::string(&row, "number").to_owned(),
            )
        })
        .collect();
    for reference in refs {
        let id = db::string(reference, "variantId");
        if resolved.contains_key(id) {
            continue;
        }
        let card_id = db::string(reference, "cardId");
        let card = db::rows(
            &state.db,
            "SELECT upstream_raw AS raw FROM cards WHERE id=$1::uuid",
            vec![card_id.into()],
        )
        .await?
        .into_iter()
        .next();
        if let Some(card) = card {
            let raw = &card["raw"];
            if let Some(variant) = db::array(raw, "variants")
                .iter()
                .find(|variant| variant["id"] == id)
            {
                catalog::store::upsert(state, raw).await?;
                resolved.insert(id.into(), db::string(variant, "variantNumber").into());
                continue;
            }
            if let Some(seed) = db::array(raw, "variants").first()
                && let Ok(detail) =
                    catalog::store::detail(state, db::string(seed, "variantNumber"), true).await
                && let Some(variant) = db::array(&detail["data"], "variants")
                    .iter()
                    .find(|variant| variant["id"] == id)
            {
                resolved.insert(id.into(), db::string(variant, "variantNumber").into());
                continue;
            }
        }
        if let Some(row) = db::rows(
            &state.db,
            "SELECT variant_number AS number FROM variants WHERE card_id=$1::uuid LIMIT 1",
            vec![card_id.into()],
        )
        .await?
        .first()
            && let Ok(detail) = catalog::store::detail(state, db::string(row, "number"), true).await
            && let Some(variant) = db::array(&detail["data"], "variants")
                .iter()
                .find(|variant| variant["id"] == id)
        {
            resolved.insert(id.into(), db::string(variant, "variantNumber").into());
        }
    }
    let mut pending: HashSet<String> = refs
        .iter()
        .filter_map(|row| row["variantId"].as_str())
        .filter(|id| !resolved.contains_key(*id))
        .map(str::to_owned)
        .collect();
    let pending_cards: HashSet<_> = refs
        .iter()
        .filter(|row| {
            row["variantId"]
                .as_str()
                .is_some_and(|id| pending.contains(id))
        })
        .filter_map(|row| row["cardId"].as_str())
        .collect();
    let mut fetched = HashSet::new();
    if !pending.is_empty() {
        for page in 1..=500 {
            // Unresolved references fall back to placeholders when upstream is busy or failing.
            let Ok(response) = upstream::list_cards(state, &json!({"page":page,"limit":100})).await
            else {
                break;
            };
            for item in db::array(&response, "data") {
                let id = db::string(item, "id");
                let card_id = db::string(&item["card"], "id");
                let wanted = pending.contains(id)
                    || !card_id.is_empty()
                        && pending_cards.contains(card_id)
                        && fetched.insert(card_id.to_owned());
                if !wanted {
                    continue;
                }
                if let Ok(card) = upstream::card(state, db::string(item, "variantNumber")).await
                    && catalog::store::upsert(state, &card).await.is_ok()
                {
                    if pending.remove(id) {
                        resolved.insert(id.into(), db::string(item, "variantNumber").into());
                    }
                    for variant in db::array(&card, "variants") {
                        let id = db::string(variant, "id");
                        if pending.remove(id) {
                            resolved.insert(id.into(), db::string(variant, "variantNumber").into());
                        }
                    }
                }
            }
            if pending.is_empty()
                || response["pagination"]["hasNext"] != true
                || page
                    >= response["pagination"]["totalPages"]
                        .as_i64()
                        .unwrap_or(page)
            {
                break;
            }
        }
    }
    Ok(resolved)
}
pub async fn transform(state: &AppState, detail: &Value) -> Result<Value> {
    let detail = checked("UpstreamDeckDetail", detail)?;
    let refs: Vec<Value> = [
        "champions",
        "maindeck",
        "runes",
        "battlefields",
        "sideboard",
    ]
    .iter()
    .flat_map(|section| db::array(&detail, section).to_vec())
    .collect();
    let resolved = resolve_refs(state, &refs).await?;
    let mut warnings = Vec::new();
    let mut value = payload(&detail);
    let mut cache = HashMap::<String, Value>::new();
    let mut missing = HashSet::new();
    if let Some(legend) = detail["legend"].as_object().map(|_| &detail["legend"])
        && !db::string(legend, "variantNumber").is_empty()
    {
        value["legend"] = match deck_card(state, db::string(legend, "variantNumber")).await {
            Ok(card) => card,
            Err(_) => {
                warnings.push("Legend card could not be loaded from the local catalog.".to_owned());
                legend_fallback(legend)
            }
        };
    }
    for (from, to) in [
        ("champions", "champion"),
        ("maindeck", "mainDeck"),
        ("runes", "runes"),
        ("battlefields", "battlefields"),
        ("sideboard", "sideboard"),
    ] {
        let mut mapped = Vec::new();
        for reference in db::array(&detail, from) {
            if from == "champions" && !mapped.is_empty() {
                break;
            }
            let id = db::string(reference, "variantId");
            let mut card = None;
            if let Some(number) = resolved.get(id) {
                card = cache.get(number).cloned();
                if card.is_none()
                    && let Ok(loaded) = deck_card(state, number).await
                {
                    cache.insert(number.clone(), loaded.clone());
                    card = Some(loaded);
                }
            }
            let card = card.unwrap_or_else(|| {
                missing.insert(id.to_owned());
                placeholder(reference)
            });
            mapped.push(if from=="champions"{card}else{http::value("DeckEntryInput",&json!({"card":card,"count":if from=="battlefields"{json!(1)}else{reference["quantity"].clone()}}))?});
        }
        value[to] = if from == "champions" {
            mapped.into_iter().next().unwrap_or(Value::Null)
        } else {
            json!(mapped)
        };
    }
    if !missing.is_empty() {
        warnings.push(format!("{} card variant{} not in the local catalog yet. Counts match Piltover Archive; sync the card catalog for names and images.",missing.len(),if missing.len()==1{""}else{"s"}));
    }
    if !warnings.is_empty() {
        value["syncWarnings"] = json!(warnings);
    }
    http::value("StoredDeckPayload", &value)
}
async fn private(state: &AppState, id: &str) -> Result<bool> {
    Ok(private_ids(state, vec![id.to_owned()]).await?.contains(id))
}
async fn private_ids(state: &AppState, ids: Vec<String>) -> Result<HashSet<String>> {
    let rows = db::rows(
        &state.db,
        "SELECT upstream_id AS id FROM private_upstream_decks WHERE upstream_id=ANY($1::text[])",
        vec![ids.into()],
    )
    .await?;
    Ok(rows
        .iter()
        .map(|row| db::string(row, "id").to_owned())
        .collect())
}
// Every legacy mirror was written under the shared key, so its PA author is the service account.
fn service_authored(state: &AppState, detail: &Value) -> bool {
    state
        .config
        .values
        .get("UPSTREAM_SERVICE_AUTHOR")
        .map(|name| name.trim())
        .filter(|name| !name.is_empty())
        .is_some_and(|name| {
            db::string(detail, "authorName")
                .trim()
                .eq_ignore_ascii_case(name)
        })
}
async fn community_detail(state: &AppState, id: &str) -> Option<Value> {
    if private(state, id).await.ok()? {
        return None;
    }
    let detail = upstream::request(
        state,
        reqwest::Method::GET,
        &format!("/v1/decks/{}", crate::auth::cookies::encode(id)),
        &Value::Null,
        None,
        None,
    )
    .await
    .ok()?;
    (!service_authored(state, &detail)).then_some(detail)
}
pub async fn get_stored(state: &AppState, id: &str) -> Option<Value> {
    let detail = community_detail(state, id).await?;
    transform(state, &detail).await.ok()
}
fn meta(detail: &Value, is_list: bool) -> Value {
    let mut meta = json!({});
    for key in ["authorName", "videoUrl"] {
        if !db::string(detail, key).is_empty() {
            meta[key] = detail[key].clone();
        }
    }
    for key in ["views", "likes", "isLegal"] {
        if let Some(value) = detail.get(key) {
            meta[key] = value.clone();
        }
    }
    if !db::array(detail, "bannedCardNames").is_empty() {
        meta["bannedCardNames"] = detail["bannedCardNames"].clone();
    }
    if is_list {
        for key in ["hasGuide", "hasVideo", "hasMatchups"] {
            if let Some(value) = detail["contentFlags"].get(key) {
                meta[key] = value.clone();
            }
        }
    } else {
        for key in ["hasGuide", "hasMatchups"] {
            if let Some(value) = detail.get(key) {
                meta[key] = value.clone();
            }
        }
    }
    if !db::string(detail, "videoUrl").is_empty() && (!is_list || meta.get("hasVideo").is_none()) {
        meta["hasVideo"] = json!(true);
    }
    meta
}
pub async fn get_item(state: &AppState, id: &str) -> Option<Value> {
    let detail = community_detail(state, id).await?;
    let detail = checked("UpstreamDeckDetail", &detail).ok()?;
    let mut item = transform(state, &detail).await.ok()?;
    let detail_meta = meta(&detail, false);
    let mut merged = detail_meta.as_object()?.clone();
    if let Ok(response) = upstream::request(
        state,
        reqwest::Method::GET,
        "/v1/decks",
        &json!({"q":detail["name"],"limit":50}),
        None,
        None,
    )
    .await
        && let Ok(response) = checked("UpstreamDeckListResponse", &response)
        && let Some(entry) = db::array(&response, "data")
            .iter()
            .find(|entry| entry["id"] == id)
    {
        merged.extend(meta(entry, true).as_object()?.clone());
    }
    if detail_meta.get("videoUrl").is_some() {
        merged.insert("videoUrl".into(), detail_meta["videoUrl"].clone());
    }
    item.as_object_mut()?.extend(merged);
    item["source"] = json!("imported");
    item["readOnly"] = json!(true);
    Some(item)
}
pub async fn list_imported(
    state: &AppState,
    query: &Value,
    skip: &HashSet<String>,
) -> Result<Value> {
    let mut parts = Vec::new();
    for (key, prefix) in [("q", ""), ("legend", "legend:")] {
        if let Some(value) = query[key]
            .as_str()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            parts.push(format!("{prefix}{value}"));
        }
    }
    if let Some(sets) = query["sets"].as_str() {
        parts.extend(
            sets.split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| format!("set:{value}")),
        );
    }
    let mut params = json!({"page":query["page"],"limit":query["limit"].as_i64().unwrap_or(25).min(50),"sort":query["sort"],"dir":query["dir"]});
    if !parts.is_empty() {
        params["q"] = json!(parts.join(" "));
    }
    if let Some(value) = query.get("isLegal") {
        params["isLegal"] = value.clone();
    }
    for key in ["hasGuide", "hasVideo", "hasMatchups"] {
        if query[key] == true {
            params[key] = json!(true);
        }
    }
    let response = upstream::request(
        state,
        reqwest::Method::GET,
        "/v1/decks",
        &params,
        None,
        None,
    )
    .await?;
    let response = checked("UpstreamDeckListResponse", &response)?;
    let hidden = private_ids(
        state,
        db::array(&response, "data")
            .iter()
            .map(|entry| db::string(entry, "id").to_owned())
            .collect(),
    )
    .await?;
    let mut items = Vec::new();
    let mut legends = HashMap::<String, Value>::new();
    for entry in db::array(&response, "data") {
        if skip.contains(db::string(entry, "id"))
            || hidden.contains(db::string(entry, "id"))
            || service_authored(state, entry)
        {
            continue;
        }
        let mut item = payload(entry);
        if let Some(legend) = entry["legend"].as_object().map(|_| &entry["legend"]) {
            let number = db::string(legend, "variantNumber");
            if !number.is_empty() {
                let card = if let Some(card) = legends.get(number) {
                    card.clone()
                } else {
                    let card = deck_card(state, number)
                        .await
                        .unwrap_or_else(|_| legend_fallback(legend));
                    legends.insert(number.into(), card.clone());
                    card
                };
                item["legend"] = card;
            }
        }
        if let (Some(item), Value::Object(meta)) = (item.as_object_mut(), meta(entry, true)) {
            item.extend(meta);
        }
        item["source"] = json!("imported");
        item["readOnly"] = json!(true);
        if !db::array(entry, "sets").is_empty() {
            item["setPrefixes"] = json!(
                db::array(entry, "sets")
                    .iter()
                    .map(|set| set["prefix"].clone())
                    .collect::<Vec<_>>()
            );
        }
        items.push(item);
    }
    if query["preview"] == true {
        use futures_util::StreamExt;
        items = futures_util::stream::iter(items.into_iter().map(|mut item| async move {
            if let Some(payload) = get_stored(state, db::string(&item, "id")).await {
                for section in [
                    "legend",
                    "champion",
                    "mainDeck",
                    "runes",
                    "battlefields",
                    "sideboard",
                ] {
                    if section != "legend" || !payload[section].is_null() {
                        item[section] = payload[section].clone();
                    }
                }
            }
            item
        }))
        .buffered(6)
        .collect()
        .await;
    }
    let mut result = json!({"items":items});
    if let Some(pagination) = response.get("pagination") {
        let page = pagination["page"].as_i64().unwrap_or(1);
        let pages = pagination["totalPages"].as_i64().unwrap_or(1);
        result["pagination"] = json!({"total":pagination["total"],"page":page,"limit":pagination["pageSize"],"totalPages":pages,"hasNext":page<pages,"hasPrevious":page>1});
    }
    Ok(result)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    #[test]
    fn signature_cards_are_detected_from_super() {
        assert!(is_signature(
            &json!({"super":"Signature"}),
            &json!({"rarity":"Epic"})
        ));
        assert!(is_signature(
            &json!({}),
            &json!({"variantType":"Signature"})
        ));
        assert!(!is_signature(
            &json!({"super":"Champion"}),
            &json!({"rarity":"Epic"})
        ));
    }
    #[test]
    fn signature_detection_matches_the_shared_fixture() {
        let fixture = crate::search::tests::fixture();
        for case in fixture["signature"].as_array().unwrap() {
            assert_eq!(
                is_signature(case, case),
                case["expected"].as_bool().unwrap(),
                "{case}"
            );
        }
    }
    #[test]
    fn legend_fallback_is_typed_as_a_legend() {
        let card = legend_fallback(&json!({"id":"c1","variantNumber":"OGN-001","name":"Jinx"}));
        assert_eq!(card["type"], "Legend");
        assert_eq!(card["super"], Value::Null);
    }
}
