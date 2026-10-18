use astral_grove_server::{
    cardmarket::{guide, matching},
    catalog,
    collection::formats,
    prices, search,
};
use serde_json::{Value, json};
use std::{
    collections::{HashMap, HashSet},
    io::{BufRead, Write},
};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut writer = std::io::BufWriter::new(std::io::stdout().lock());
    for line in std::io::stdin().lock().lines() {
        let row: Value = serde_json::from_str(&line?)?;
        let input = &row["input"];
        let empty = Vec::new();
        let array = |key: &str| input[key].as_array().unwrap_or(&empty).clone();
        let value = match row["function"].as_str().ok_or("function")? {
            "search" => {
                let query = search::parse(input.as_str().unwrap_or(""));
                json!({"normalized":query.normalized,"squashed":query.squashed,"identityTokens":query.identity,"typeIntents":query.intents})
            }
            "csv" => formats::csv(input.as_str().unwrap_or("")),
            "tts" => formats::tts(input.as_str().unwrap_or("")),
            "guide" => json!(guide::map(&serde_json::from_value(input.clone())?)?),
            "candidates" => json!(prices::candidates(input.as_str().unwrap_or(""))),
            "match" | "unmapped" => {
                let ranks: HashMap<i64, f64> = input["ranks"]
                    .as_object()
                    .map(|ranks| {
                        ranks
                            .iter()
                            .filter_map(|(key, value)| Some((key.parse().ok()?, value.as_f64()?)))
                            .collect()
                    })
                    .unwrap_or_default();
                let variants = array("variants");
                let products = array("products");
                if row["function"] == "match" {
                    json!(matching::match_variants(&variants, &products, &ranks))
                } else {
                    let reserved: HashSet<i64> =
                        array("reserved").iter().filter_map(Value::as_i64).collect();
                    json!(matching::match_unmapped(
                        &variants,
                        &products,
                        &reserved,
                        &ranks,
                        input["foilBase"].as_i64()
                    ))
                }
            }
            "expansion" => json!(matching::expansion_map(
                &array("variants"),
                &array("products"),
                false
            )),
            "inferExpansion" => json!(matching::infer_expansion(
                &array("variants"),
                &array("products")
            )),
            "deck" => json!(astral_grove_api_types::deck_validation::validate(input)),
            "statistics" => {
                let mut result = prices::statistics(
                    "X-001",
                    None,
                    false,
                    30,
                    None,
                    input.as_array().unwrap_or(&empty).clone(),
                );
                let map = result.as_object_mut().ok_or("statistics")?;
                let keys = [
                    "currentPrice",
                    "baselinePrice",
                    "minPrice",
                    "maxPrice",
                    "avgPrice",
                    "listingLow",
                    "changePercent",
                    "trend",
                    "points",
                ];
                map.retain(|key, _| keys.contains(&key.as_str()));
                result
            }
            "total" => json!(catalog::metadata::total(
                &input["filters"],
                input["count"].as_i64().unwrap_or(0)
            )),
            _ => return Err("Unknown business function".into()),
        };
        serde_json::to_writer(&mut writer, &value)?;
        writeln!(writer)?;
    }
    Ok(())
}
