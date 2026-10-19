use crate::{AppState, db, prices, search};
use serde_json::{Value, json};
pub fn foil(variant: &Value) -> bool {
    ["variantNumber", "variantLabel", "variantType"]
        .iter()
        .any(|key| db::string(variant, key).to_lowercase().contains("foil"))
        || db::string(variant, "foilMode")
            .trim()
            .eq_ignore_ascii_case("foil_only")
}
pub fn dual(variant: &Value) -> bool {
    db::string(variant, "foilMode")
        .trim()
        .eq_ignore_ascii_case("both")
        && !["variantNumber", "variantLabel", "variantType"]
            .iter()
            .any(|key| db::string(variant, key).to_lowercase().contains("foil"))
}
pub fn group_key(variant: &Value) -> String {
    let number = db::string(variant, "variantNumber");
    let label = db::string(variant, "variantLabel");
    let foil = foil(variant);
    if !foil && !matches!(label, "Standard" | "Foil") {
        return number.into();
    }
    if number.to_lowercase().ends_with("-foil") {
        return number[..number.len() - 5].into();
    }
    if foil
        && label == "Foil"
        && number
            .chars()
            .last()
            .is_some_and(|ch| ch.is_ascii_alphabetic())
    {
        return number[..number.len() - 1].into();
    }
    number.into()
}
pub fn summaries(prices: &prices::Index, id: Option<i64>) -> Vec<Value> {
    id.and_then(|id| prices.get(&id)).map(Vec::as_slice).unwrap_or(&[]).iter().map(|row|json!({"currency":"EUR","low":row["lowPrice"],"market":row["marketPrice"],"avg7d":row["avg7Day"],"isFoil":row["isFoil"]})).collect()
}
fn display(rows: &[Value], foil: bool) -> Value {
    let trend = rows
        .iter()
        .filter(|row| row["market"].as_f64().is_some_and(|value| value > 0.0))
        .collect::<Vec<_>>();
    for finish in [foil, true, false] {
        if let Some(row) = trend.iter().find(|row| row["isFoil"] == finish) {
            return (*row).clone();
        }
    }
    let lows = rows
        .iter()
        .filter(|row| !row["low"].is_null())
        .collect::<Vec<_>>();
    for finish in [foil, true] {
        if let Some(row) = lows.iter().find(|row| row["isFoil"] == finish) {
            return (*row).clone();
        }
    }
    lows.first()
        .map(|row| (*row).clone())
        .unwrap_or(Value::Null)
}
fn printing(variant: &Value, foil: bool, prices: &prices::Index) -> Value {
    let label = db::string(variant, "variantLabel");
    let label = if foil {
        if !label.is_empty() && label != "Standard" && !label.to_lowercase().contains("foil") {
            label
        } else {
            "Foil"
        }
    } else if label.is_empty() {
        "Standard"
    } else {
        label
    };
    let price = display(&summaries(prices, variant["cardmarketId"].as_i64()), foil);
    json!({"variantNumber":variant["variantNumber"],"variantLabel":label,"isFoil":foil,"foilMode":variant["foilMode"],"priceEur":price})
}
pub fn banned(value: &Value) -> bool {
    let Some(value) = value.as_str() else {
        return false;
    };
    crate::instant::parse_js_date(value).is_some_and(|date| {
        i128::from(date) <= time::OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000
    })
}
pub fn item(state: &AppState, card: &Value, variant: &Value, prices: &prices::Index) -> Value {
    let printings = if dual(variant) {
        vec![
            printing(variant, false, prices),
            printing(variant, true, prices),
        ]
    } else {
        vec![printing(variant, foil(variant), prices)]
    };
    let primary = &printings[0];
    let mut result = json!({"cardId":card["id"],"variantNumber":primary["variantNumber"],"name":card["name"],"type":card["type"],"super":card["super"],"variantType":variant["variantType"],"energy":card["energy"],"might":card["might"],"power":card["power"],"rarity":variant["rarity"],"setCode":variant["set"]["prefix"],"colors":db::array(card,"colors").iter().map(|color|color["name"].clone()).collect::<Vec<_>>(),"imageUrl":variant["imageUrl"],"cardmarketId":variant["cardmarketId"],"priceEur":primary["priceEur"],"printings":printings,"isBanned":banned(&card["banEffectiveDate"])});
    crate::images::rewrite(state, &mut result["imageUrl"]);
    result
}
pub fn row_item(state: &AppState, row: &Value, prices: &prices::Index) -> Value {
    let mut card = row.clone();
    card["id"] = row["cardId"].clone();
    card["colors"] = json!(
        db::array(row, "colors")
            .iter()
            .map(|name| json!({"name":name}))
            .collect::<Vec<_>>()
    );
    let mut variant = row.clone();
    variant["set"] = json!({"prefix":row["setCode"]});
    item(state, &card, &variant, prices)
}
pub fn group(items: Vec<Value>) -> Vec<Value> {
    let mut grouped: Vec<(String, Value)> = Vec::new();
    let mut indexes = std::collections::HashMap::<String, usize>::new();
    for item in items {
        for printing in db::array(&item, "printings") {
            let key = format!("{}:{}", db::string(&item, "cardId"), group_key(printing));
            if let Some(index) = indexes.get(&key) {
                let existing = &mut grouped[*index].1;
                if item["isBanned"] == true {
                    existing["isBanned"] = json!(true);
                }
                if let Some(items) = existing["printings"].as_array_mut() {
                    items.push(printing.clone());
                }
            } else {
                let mut copy = item.clone();
                copy["variantNumber"] = printing["variantNumber"].clone();
                copy["priceEur"] = printing["priceEur"].clone();
                copy["printings"] = json!([printing]);
                indexes.insert(key.clone(), grouped.len());
                grouped.push((key, copy));
            }
        }
    }
    grouped
        .into_iter()
        .map(|(_, mut item)| {
            let prints = db::array(&item, "printings");
            let sibling = prints.iter().any(|printing| {
                printing["isFoil"] == true
                    && prints.iter().any(|other| {
                        other["isFoil"] == false
                            && other["variantNumber"] != printing["variantNumber"]
                    })
            });
            let mut unique = Vec::<Value>::new();
            for printing in prints {
                if sibling
                    && printing["isFoil"] == true
                    && prints.iter().any(|other| {
                        other["isFoil"] == false
                            && other["variantNumber"] == printing["variantNumber"]
                    })
                {
                    continue;
                }
                if !unique.iter().any(|stored| {
                    stored["variantNumber"] == printing["variantNumber"]
                        && stored["isFoil"] == printing["isFoil"]
                }) {
                    unique.push(printing.clone());
                }
            }
            unique.sort_by(|a, b| {
                a["isFoil"]
                    .as_bool()
                    .cmp(&b["isFoil"].as_bool())
                    .then_with(|| {
                        search::compare(
                            db::string(a, "variantNumber"),
                            db::string(b, "variantNumber"),
                        )
                    })
            });
            if let Some(primary) = unique
                .iter()
                .find(|row| row["isFoil"] == false)
                .or(unique.first())
            {
                item["variantNumber"] = primary["variantNumber"].clone();
                item["priceEur"] = primary["priceEur"].clone();
            }
            item["printings"] = json!(unique);
            item
        })
        .collect()
}
pub fn market_ids(card: &Value) -> Vec<i64> {
    db::array(card, "variants")
        .iter()
        .filter_map(|variant| variant["cardmarketId"].as_i64())
        .collect()
}
pub fn detail(state: &AppState, card: &Value, prices: &prices::Index) -> Value {
    let variants = db::array(card, "variants");
    let mut result = card.clone();
    result["super"] = card["super"].clone();
    result["banEffectiveDate"] = card["banEffectiveDate"].clone();
    result["variants"] = json!(
        variants
            .iter()
            .map(|variant| {
                let id = prices::resolve_id(db::string(variant, "variantNumber"), variants);
                let mut row = variant.clone();
                for key in ["tcgplayerId", "releaseDate", "artist"] {
                    row[key] = variant[key].clone();
                }
                row["cardmarketId"] = json!(id);
                row["prices"] = json!(summaries(prices, id));
                row
            })
            .collect::<Vec<_>>()
    );
    crate::images::rewrite_all(state, &mut result);
    result
}
