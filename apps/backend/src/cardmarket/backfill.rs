use super::{guide, matching};
use crate::{
    AppState, catalog, db,
    error::{AppError, Result},
};
use sea_orm::TransactionTrait;
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
#[derive(serde::Deserialize)]
struct Export {
    version: i64,
    #[serde(rename = "createdAt")]
    created_at: String,
    products: Vec<Product>,
}
#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Product {
    id_product: i64,
    name: String,
    id_category: i64,
    id_expansion: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    category_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    id_metacard: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    date_added: Option<String>,
}
const CATALOG: &str = "SELECT v.id::text AS id,v.card_id::text AS \"cardId\",v.variant_number AS \"variantNumber\",v.variant_label AS \"variantLabel\",v.variant_type AS \"variantType\",v.rarity,c.name AS \"cardName\",s.code AS \"setCode\",v.cardmarket_id AS \"cardmarketId\",(v.upstream_raw->>'cardmarketId')::integer AS \"upstreamCardmarketId\",v.upstream_raw AS raw FROM variants v JOIN cards c ON c.id=v.card_id JOIN sets s ON s.id=v.set_id";
pub async fn run(state: &AppState, game: i64) -> Result<usize> {
    let input =
        guide::download(state, &format!("/productList/products_singles_{game}.json")).await?;
    let export: Export = serde_json::from_value(input)?;
    let _ = (&export.version, &export.created_at);
    let products = export
        .products
        .into_iter()
        .map(serde_json::to_value)
        .collect::<std::result::Result<Vec<_>, _>>()?;
    let rows = db::rows(&state.db, CATALOG, vec![]).await?;
    let mut expansions = matching::expansion_map(&rows, &products, false);
    let upstream = matching::expansion_map(&rows, &products, true);
    for (set, variants) in matching::group(&rows, |row| db::string(row, "setCode").into()) {
        if let Some(id) = upstream
            .get(&set)
            .copied()
            .or_else(|| matching::infer_expansion(&variants, &products))
            .or_else(|| expansions.get(&set).copied())
        {
            expansions.insert(set, id);
        }
    }
    let pending: Vec<_> = rows
        .iter()
        .filter(|row| {
            let Some(id) = row["cardmarketId"].as_i64() else {
                return true;
            };
            if !row["upstreamCardmarketId"].is_null() || row["variantType"] == "Promo" {
                return false;
            }
            let product = products.iter().find(|product| product["idProduct"] == id);
            let expansion = expansions.get(db::string(row, "setCode"));
            match (product, expansion) {
                (Some(product), Some(expansion)) => {
                    db::string(product, "name").eq_ignore_ascii_case(db::string(row, "cardName"))
                        && product["idExpansion"] != *expansion
                }
                _ => false,
            }
        })
        .cloned()
        .collect();
    let pending_ids: HashSet<_> = pending.iter().map(|row| db::string(row, "id")).collect();
    let mut assignments = Vec::<Value>::new();
    let price_rows = db::rows(
        &state.db,
        "SELECT cardmarket_id AS id,market_price AS price FROM prices WHERE is_foil=true",
        vec![],
    )
    .await?;
    let ranks: HashMap<_, _> = price_rows
        .iter()
        .filter_map(|row| Some((row["id"].as_i64()?, row["price"].as_f64().unwrap_or(0.0))))
        .collect();
    for (set, set_rows) in matching::group(&pending, |row| db::string(row, "setCode").into()) {
        for (card, card_rows) in matching::group(&set_rows, |row| db::string(row, "cardId").into())
        {
            let mapped: Vec<_> = rows
                .iter()
                .filter(|row| {
                    row["cardId"] == card
                        && !row["cardmarketId"].is_null()
                        && !pending_ids.contains(db::string(row, "id"))
                })
                .collect();
            let mut reserved: HashSet<_> = mapped
                .iter()
                .filter_map(|row| row["cardmarketId"].as_i64())
                .collect();
            for promo in [false, true] {
                let variants: Vec<_> = card_rows
                    .iter()
                    .filter(|row| (row["variantType"] == "Promo") == promo)
                    .cloned()
                    .collect();
                let Some(first) = variants.first() else {
                    continue;
                };
                let products: Vec<_> = products
                    .iter()
                    .filter(|product| {
                        db::string(product, "name").to_lowercase()
                            == db::string(first, "cardName").to_lowercase()
                            && (promo
                                || product["idExpansion"].as_i64() == expansions.get(&set).copied())
                    })
                    .cloned()
                    .collect();
                if products.is_empty() {
                    continue;
                }
                let foil_base = variants
                    .iter()
                    .find(|row| {
                        db::string(row, "variantNumber")
                            .to_lowercase()
                            .ends_with("-foil")
                    })
                    .and_then(|foil| {
                        let number = db::string(foil, "variantNumber");
                        let base = &number[..number.len() - 5];
                        mapped
                            .iter()
                            .find(|row| db::string(row, "variantNumber").eq_ignore_ascii_case(base))
                            .and_then(|row| row["cardmarketId"].as_i64())
                    });
                let matches =
                    matching::match_unmapped(&variants, &products, &reserved, &ranks, foil_base);
                for variant in &variants {
                    if let Some(id) = matches.get(db::string(variant, "variantNumber")) {
                        assignments.push(json!({"id":variant["id"],"cardmarketId":id}));
                        reserved.insert(*id);
                    }
                }
            }
        }
    }
    for batch in assignments.chunks(100) {
        db::execute(&state.db,"UPDATE variants v SET cardmarket_id=x.\"cardmarketId\",updated_at=now() FROM jsonb_to_recordset($1::jsonb) AS x(id text,\"cardmarketId\" integer) WHERE v.id=x.id::uuid",vec![json!(batch).into()]).await?;
    }
    let rows = db::rows(&state.db, CATALOG, vec![]).await?;
    let mut synthetic_count = 0;
    for (_, variants) in matching::group(&rows, |row| db::string(row, "cardId").into()) {
        if variants.iter().any(matching::signed) {
            continue;
        }
        let parents: Vec<_> = variants
            .iter()
            .filter(|row| matching::unsigned(row))
            .collect();
        if parents.len() != 1 {
            continue;
        }
        let parent = parents[0];
        let Some(first) = variants.first() else {
            continue;
        };
        let Some(expansion) = expansions.get(db::string(first, "setCode")) else {
            continue;
        };
        let used: HashSet<_> = variants
            .iter()
            .filter_map(|row| row["cardmarketId"].as_i64())
            .collect();
        let mut leftover: Vec<_> = products
            .iter()
            .filter(|product| {
                product["idExpansion"] == *expansion
                    && product["name"] == first["cardName"]
                    && !used.contains(&product["idProduct"].as_i64().unwrap_or(0))
            })
            .collect();
        leftover.sort_by(|a, b| {
            let rank = |row: &Value| {
                ranks
                    .get(&row["idProduct"].as_i64().unwrap_or(0))
                    .copied()
                    .unwrap_or(row["idProduct"].as_i64().unwrap_or(0) as f64)
            };
            rank(b)
                .total_cmp(&rank(a))
                .then_with(|| b["idProduct"].as_i64().cmp(&a["idProduct"].as_i64()))
        });
        let Some(product) = leftover.first() else {
            continue;
        };
        let mut synthetic = crate::http::value("PaVariant", &parent["raw"])?;
        let number = db::string(&synthetic, "variantNumber").trim();
        let number = if number.ends_with('*') {
            number.to_owned()
        } else {
            format!("{number}*")
        };
        if variants
            .iter()
            .any(|row| db::string(row, "variantNumber").eq_ignore_ascii_case(&number))
        {
            continue;
        }
        synthetic["id"] = json!(uuid::Uuid::new_v4().to_string());
        synthetic["variantNumber"] = json!(number);
        synthetic["variantType"] = json!("Overnumbered");
        synthetic["variantLabel"] = json!("Overnumbered Signed");
        synthetic["cardmarketId"] = product["idProduct"].clone();
        synthetic["tcgplayerId"] = Value::Null;
        synthetic["parentVariantId"] = parent["id"].clone();
        for key in ["flavorText", "artist", "releaseDate"] {
            if synthetic.get(key).is_none() {
                synthetic[key] = Value::Null;
            }
        }
        if let Some(types) = synthetic["variantTypes"].as_array_mut()
            && !types.iter().any(|kind| kind == "Signed")
        {
            types.push(json!("Signed"));
        }
        if let Some(url) = signed_image(state, &number).await {
            synthetic["imageUrl"] = json!(url);
        }
        let tx = state.db.begin().await?;
        let card_id = db::string(parent, "cardId");
        let card = db::rows(
            &tx,
            "SELECT upstream_raw AS raw FROM cards WHERE id=$1::uuid FOR UPDATE",
            vec![card_id.into()],
        )
        .await?
        .into_iter()
        .next()
        .ok_or_else(AppError::internal)?;
        if catalog::store::write_variant(&tx, card_id, &synthetic, true).await? > 0 {
            let mut logical = card["raw"].clone();
            if let Some(variants) = logical["variants"].as_array_mut()
                && !variants.iter().any(|variant| {
                    db::string(variant, "variantNumber").eq_ignore_ascii_case(&number)
                })
            {
                variants.push(synthetic);
                variants.sort_by(|a, b| {
                    crate::search::compare(
                        db::string(a, "variantNumber"),
                        db::string(b, "variantNumber"),
                    )
                });
                db::execute(
                    &tx,
                    "UPDATE cards SET upstream_raw=$2,updated_at=now() WHERE id=$1::uuid",
                    vec![card_id.into(), logical.into()],
                )
                .await?;
            }
            synthetic_count += 1;
        }
        tx.commit().await?;
    }
    Ok(assignments.len() + synthetic_count)
}
async fn signed_image(state: &AppState, number: &str) -> Option<String> {
    let base = number.trim().trim_end_matches('*');
    let cdn = state
        .config
        .values
        .get("IMAGE_CDN_BASE_URL")
        .map(String::as_str)
        .unwrap_or("https://cdn.piltoverarchive.com")
        .trim_end_matches('/');
    for suffix in ["s", "S", "*"] {
        let path = format!("cards/{base}{suffix}.webp");
        let url = format!("{cdn}/{path}");
        if let Ok(response) = state
            .client
            .get(&url)
            .header("accept", "image/*,*/*")
            .timeout(std::time::Duration::from_secs(8))
            .send()
            .await
        {
            if !response.status().is_success() {
                continue;
            }
            let image_type = response
                .headers()
                .get("content-type")
                .and_then(|value| value.to_str().ok())
                .is_some_and(|value| value.starts_with("image/"));
            let valid = if image_type {
                true
            } else {
                crate::images::capped(response, 5 * 1024 * 1024)
                    .await
                    .is_some_and(|body| {
                        body.len() >= 8
                            && (body.starts_with(&[0xff, 0xd8])
                                || body.starts_with(&[0x89, 0x50])
                                || body.starts_with(b"RIFF"))
                    })
            };
            if valid {
                return Some(format!("https://cdn.piltoverarchive.com/{path}"));
            }
        }
    }
    None
}
