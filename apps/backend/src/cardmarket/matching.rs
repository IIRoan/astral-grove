use crate::{db, search};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
fn number(row: &Value) -> i64 {
    row["idProduct"].as_i64().unwrap_or(0)
}
pub fn signed(row: &Value) -> bool {
    db::string(row, "variantNumber").trim().ends_with('*') || {
        let text = format!(
            "{} {}",
            db::string(row, "variantType"),
            db::string(row, "variantLabel")
        )
        .to_lowercase();
        text.contains("overnumbered") && text.contains("signed")
    }
}
pub fn unsigned(row: &Value) -> bool {
    let text = format!(
        "{} {}",
        db::string(row, "variantType"),
        db::string(row, "variantLabel")
    )
    .to_lowercase();
    text.contains("overnumbered") && !text.contains("signed")
}
fn premium(row: &Value) -> bool {
    let text = format!(
        "{} {} {}",
        db::string(row, "variantType"),
        db::string(row, "variantLabel"),
        db::string(row, "rarity")
    )
    .to_lowercase();
    [
        "alt art",
        "showcase",
        "overnumbered",
        "promo",
        "signed",
        "textured",
        "borderless",
    ]
    .iter()
    .any(|needle| text.contains(needle))
}
fn rank(row: &Value, ranks: &HashMap<i64, f64>) -> f64 {
    ranks
        .get(&number(row))
        .copied()
        .unwrap_or(number(row) as f64)
}
pub fn match_variants(
    variants: &[Value],
    products: &[Value],
    ranks: &HashMap<i64, f64>,
) -> HashMap<String, i64> {
    let mut variants = variants.to_vec();
    variants.sort_by(|a, b| {
        search::compare(
            db::string(a, "variantNumber"),
            db::string(b, "variantNumber"),
        )
    });
    let mut products = products.to_vec();
    products.sort_by_key(number);
    let mut result = HashMap::new();
    if products.len() > variants.len() {
        products.sort_by(|left, right| {
            rank(left, ranks)
                .total_cmp(&rank(right, ranks))
                .then_with(|| number(left).cmp(&number(right)))
        });
        let mut used = HashSet::new();
        for variant in variants.iter().filter(|variant| !premium(variant)).chain(
            variants
                .iter()
                .filter(|variant| premium(variant) && !signed(variant)),
        ) {
            if let Some(product) = products
                .iter()
                .find(|product| !used.contains(&number(product)))
            {
                let product = number(product);
                result.insert(db::string(variant, "variantNumber").into(), product);
                used.insert(product);
            }
        }
        let mut remaining: Vec<_> = products
            .iter()
            .filter(|product| !used.contains(&number(product)))
            .collect();
        remaining.sort_by(|left, right| {
            rank(right, ranks)
                .total_cmp(&rank(left, ranks))
                .then_with(|| number(right).cmp(&number(left)))
        });
        for (variant, product) in variants
            .iter()
            .filter(|variant| premium(variant) && signed(variant))
            .zip(remaining)
        {
            result.insert(db::string(variant, "variantNumber").into(), number(product));
        }
    } else {
        for (variant, product) in variants.iter().zip(&products) {
            result.insert(db::string(variant, "variantNumber").into(), number(product));
        }
    }
    result
}
pub fn match_unmapped(
    variants: &[Value],
    products: &[Value],
    reserved: &HashSet<i64>,
    ranks: &HashMap<i64, f64>,
    foil_base: Option<i64>,
) -> HashMap<String, i64> {
    if variants.is_empty() || products.is_empty() {
        return HashMap::new();
    }
    let available: Vec<_> = products
        .iter()
        .filter(|product| !reserved.contains(&number(product)))
        .cloned()
        .collect();
    let pool = if available.is_empty() {
        products
    } else {
        available.as_slice()
    };
    if variants.len() == 1 {
        let variant = &variants[0];
        let number = db::string(variant, "variantNumber");
        let foil = number.to_lowercase().ends_with("-foil");
        let shared = if foil {
            foil_base
                .or_else(|| (pool.len() == 1).then(|| self::number(&pool[0])))
                .or_else(|| {
                    if reserved.len() == 1 {
                        reserved
                            .iter()
                            .copied()
                            .find(|id| products.iter().any(|product| self::number(product) == *id))
                    } else {
                        None
                    }
                })
        } else {
            (pool.len() == 1).then(|| self::number(&pool[0]))
        };
        if let Some(id) = shared {
            return HashMap::from([(number.into(), id)]);
        }
    }
    match_variants(variants, pool, ranks)
}
pub fn group(rows: &[Value], key: impl Fn(&Value) -> String) -> Vec<(String, Vec<Value>)> {
    let mut groups: Vec<(String, Vec<Value>)> = Vec::new();
    for row in rows {
        let key = key(row);
        if let Some((_, items)) = groups.iter_mut().find(|(stored, _)| *stored == key) {
            items.push(row.clone());
        } else {
            groups.push((key, vec![row.clone()]));
        }
    }
    groups
}
pub fn expansion_map(rows: &[Value], products: &[Value], upstream: bool) -> HashMap<String, i64> {
    let mut counts: Vec<(String, Vec<(i64, usize)>)> = Vec::new();
    for row in rows {
        if upstream && row["variantType"] == "Promo" {
            continue;
        }
        let Some(id) = row[if upstream {
            "upstreamCardmarketId"
        } else {
            "cardmarketId"
        }]
        .as_i64() else {
            continue;
        };
        let Some(product) = products.iter().find(|product| number(product) == id) else {
            continue;
        };
        let expansion = product["idExpansion"].as_i64().unwrap_or(-1);
        let set = db::string(row, "setCode");
        let index = if let Some(index) = counts.iter().position(|(stored, _)| stored == set) {
            index
        } else {
            counts.push((set.into(), Vec::new()));
            counts.len() - 1
        };
        let entries = &mut counts[index].1;
        if let Some((_, count)) = entries.iter_mut().find(|(id, _)| *id == expansion) {
            *count += 1;
        } else {
            entries.push((expansion, 1));
        }
    }
    counts
        .into_iter()
        .filter_map(|(set, entries)| {
            let mut best = None;
            let mut count = 0;
            for (id, hits) in entries {
                if hits > count {
                    best = Some(id);
                    count = hits;
                }
            }
            best.filter(|id| *id >= 0).map(|id| (set, id))
        })
        .collect()
}
pub fn infer_expansion(rows: &[Value], products: &[Value]) -> Option<i64> {
    if rows.is_empty() {
        return None;
    }
    let names: HashSet<_> = rows
        .iter()
        .map(|row| db::string(row, "cardName").to_lowercase())
        .collect();
    let mut best = None;
    let mut score = 0;
    let mut tied = false;
    for (key, products) in group(products, |product| product["idExpansion"].to_string()) {
        let product_names: HashSet<_> = products
            .iter()
            .map(|product| db::string(product, "name").to_lowercase())
            .collect();
        let hits = names.intersection(&product_names).count();
        if hits > score {
            score = hits;
            best = key.parse().ok();
            tied = false;
        } else if hits == score {
            tied = true;
        }
    }
    let minimum = names.len().min(3.max(names.len().div_ceil(2)));
    if !tied && score >= minimum {
        best
    } else {
        None
    }
}
