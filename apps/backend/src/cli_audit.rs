use crate::{AppState, catalog, db, upstream};
use futures_util::{StreamExt, stream};
use serde_json::{Value, json};
use std::{
    collections::{BTreeMap, HashSet},
    sync::Arc,
};

fn distance(left: &str, right: &str) -> usize {
    let a = left.encode_utf16().collect::<Vec<_>>();
    let b = right.encode_utf16().collect::<Vec<_>>();
    let mut row = (0..=b.len()).collect::<Vec<_>>();
    for (i, a) in a.iter().enumerate() {
        let mut previous = i;
        row[0] = i + 1;
        for (j, b) in b.iter().enumerate() {
            let old = row[j + 1];
            row[j + 1] = (old + 1)
                .min(row[j] + 1)
                .min(previous + usize::from(a != b));
            previous = old;
        }
    }
    row[b.len()]
}
fn matches(filter: Option<&str>, names: &[&str]) -> bool {
    let Some(filter) = filter else { return true };
    names.iter().any(|name| {
        let name = name.to_lowercase();
        let name = name.trim();
        name.contains(filter)
            || distance(name, filter) <= 2
            || name
                .split_whitespace()
                .any(|word| word.encode_utf16().count() >= 4 && distance(word, filter) <= 2)
    })
}
fn differences(local: &Value, remote: &Value) -> Vec<Value> {
    let mut result = Vec::new();
    let mut push = |path: String, a: Value, b: Value| {
        if a != b {
            result.push(json!({"path":path,"local":a,"upstream":b}))
        }
    };
    for key in [
        "name",
        "type",
        "super",
        "description",
        "energy",
        "might",
        "power",
        "attachText",
        "effect",
        "mightBonus",
        "maxCopies",
        "banEffectiveDate",
    ] {
        let default = if key == "mightBonus" {
            json!(0)
        } else {
            Value::Null
        };
        push(
            key.into(),
            local.get(key).cloned().unwrap_or(default.clone()),
            remote.get(key).cloned().unwrap_or(default),
        );
    }
    for key in ["tags", "colors"] {
        let normalized = |value: &Value| {
            let mut values = value.as_array().cloned().unwrap_or_default();
            if key == "colors" {
                values = values
                    .into_iter()
                    .map(|v| json!({"id":v["id"],"name":v["name"]}))
                    .collect();
            }
            values.sort_by_key(Value::to_string);
            json!(values)
        };
        push(
            key.into(),
            normalized(&local[key]),
            normalized(&remote[key]),
        );
    }
    let variants = |card: &Value| {
        card["variants"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|v| (db::string(v, "variantNumber").to_owned(), v.clone()))
            .collect::<BTreeMap<_, _>>()
    };
    let a = variants(local);
    let b = variants(remote);
    let keys = a
        .keys()
        .chain(b.keys())
        .collect::<std::collections::BTreeSet<_>>();
    for number in keys {
        let (Some(a), Some(b)) = (a.get(number), b.get(number)) else {
            push(
                format!("variants.{number}"),
                a.get(number)
                    .map(|v| json!({"rarity":v["rarity"],"variantType":v["variantType"]}))
                    .unwrap_or(Value::Null),
                b.get(number)
                    .map(|v| json!({"rarity":v["rarity"],"variantType":v["variantType"]}))
                    .unwrap_or(Value::Null),
            );
            continue;
        };
        if catalog::hash(a) != catalog::hash(b) {
            let mut changed = false;
            for key in [
                "rarity",
                "variantType",
                "foilMode",
                "variantLabel",
                "imageUrl",
                "cardmarketId",
            ] {
                changed |= a[key] != b[key];
                push(
                    format!("variants.{number}.{key}"),
                    a[key].clone(),
                    b[key].clone(),
                );
            }
            changed |= a["set"]["prefix"] != b["set"]["prefix"];
            push(
                format!("variants.{number}.set.prefix"),
                a["set"]["prefix"].clone(),
                b["set"]["prefix"].clone(),
            );
            if !changed {
                push(
                    format!("variants.{number}.contentHash"),
                    json!(catalog::hash(a)),
                    json!(catalog::hash(b)),
                );
            }
        }
    }
    result
}
#[derive(Default)]
struct Audit {
    local: BTreeMap<String, Value>,
    checked: HashSet<String>,
    covered: HashSet<String>,
    matching: usize,
    mismatches: Vec<Value>,
    missing: Vec<Value>,
    errors: Vec<Value>,
    fixed: usize,
    verify: Vec<(String, String)>,
}
impl Audit {
    async fn process(
        &mut self,
        state: &AppState,
        number: &str,
        fetched: Result<Value, upstream::PaError>,
        filter: Option<&str>,
        fix: bool,
    ) -> anyhow::Result<()> {
        let remote = match fetched {
            Ok(value) => value,
            Err(_) => {
                self.errors
                    .push(json!({"probeVariant":number,"error":"Upstream card fetch failed"}));
                return Ok(());
            }
        };
        let id = db::string(&remote, "id").to_owned();
        for v in remote["variants"].as_array().into_iter().flatten() {
            self.covered
                .insert(db::string(v, "variantNumber").to_uppercase());
        }
        if !self.checked.insert(id.clone()) {
            return Ok(());
        }
        let local = self.local.get(&id);
        if !matches(
            filter,
            &[
                local.map(|v| db::string(v, "name")).unwrap_or(""),
                db::string(&remote, "name"),
            ],
        ) {
            return Ok(());
        }
        let digest = catalog::hash(&remote);
        if let Some(local) = local {
            if local["hash"] == digest {
                self.matching += 1;
                return Ok(());
            }
            let mut before = crate::http::value("PaLogicalCard", &local["raw"])
                .unwrap_or_else(|_| json!({"tags":[],"colors":[],"variants":[]}));
            before["name"] = local["name"].clone();
            before["id"] = local["id"].clone();
            self.mismatches.push(json!({"cardId":id,"probeVariant":number,"localName":local["name"],"upstreamName":remote["name"],"diffs":differences(&before,&remote)}));
        } else {
            self.missing.push(json!({"cardId":id,"name":remote["name"],"probeVariant":number,"variantCount":remote["variants"].as_array().map_or(0,Vec::len)}));
        }
        if fix {
            if catalog::store::upsert(state, &remote).await? {
                self.fixed += 1;
            }
            self.verify.push((id, digest));
        }
        Ok(())
    }
}
pub async fn run(state: &Arc<AppState>, args: &[String]) -> anyhow::Result<(Value, bool)> {
    let options = super::cli::options(
        args,
        &["--fix", "--json"],
        &["--name", "--variant", "--limit", "--concurrency"],
    )?;
    let name = options.get("--name").map(|v| v.trim().to_lowercase());
    let variant = options.get("--variant").map(|v| v.trim().to_uppercase());
    anyhow::ensure!(
        name.as_ref().is_none_or(|v| !v.is_empty())
            && variant.as_ref().is_none_or(|v| !v.is_empty()),
        "Audit filters cannot be empty"
    );
    let limit = super::cli::integer(&options, "--limit", i64::MAX, i64::MAX)? as usize;
    let concurrency = super::cli::integer(&options, "--concurrency", 6, 256)? as usize;
    let fix = options.contains_key("--fix");
    let scoped = name.is_some() || variant.is_some();
    let local=db::rows(&state.db,"SELECT c.id::text AS id,c.name,c.content_hash AS hash,c.upstream_raw AS raw,coalesce(jsonb_agg(v.variant_number ORDER BY v.variant_number) FILTER(WHERE v.id IS NOT NULL),'[]'::jsonb) AS variants FROM cards c LEFT JOIN variants v ON v.card_id=c.id GROUP BY c.id ORDER BY c.id",vec![]).await?;
    let local_variants = local
        .iter()
        .flat_map(|card| card["variants"].as_array().into_iter().flatten())
        .filter_map(Value::as_str)
        .map(str::to_uppercase)
        .collect::<HashSet<_>>();
    let mut audit = Audit {
        local: local
            .into_iter()
            .map(|row| (db::string(&row, "id").to_owned(), row))
            .collect(),
        ..Default::default()
    };
    let mut upstream_numbers = Vec::new();
    if !scoped {
        let mut page = 1;
        loop {
            let result = upstream::list_cards(state, &json!({"page":page,"limit":100})).await?;
            upstream_numbers.extend(
                result["data"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|v| v["variantNumber"].as_str().map(str::to_owned)),
            );
            if result["pagination"]["hasNext"] != true
                || page >= result["pagination"]["totalPages"].as_i64().unwrap_or(0)
            {
                break;
            }
            page += 1;
        }
    }
    let upstream_set = upstream_numbers
        .iter()
        .map(|v| v.to_uppercase())
        .collect::<HashSet<_>>();
    let probes = audit
        .local
        .values()
        .filter(|card| matches(name.as_deref(), &[db::string(card, "name")]))
        .filter(|card| {
            variant.as_ref().is_none_or(|v| {
                card["variants"].as_array().is_some_and(|values| {
                    values
                        .iter()
                        .any(|n| n.as_str().is_some_and(|n| n.to_uppercase() == *v))
                })
            })
        })
        .filter_map(|card| {
            let numbers = card["variants"].as_array()?;
            numbers
                .iter()
                .find(|v| {
                    !scoped
                        && v.as_str()
                            .is_some_and(|v| upstream_set.contains(&v.to_uppercase()))
                })
                .or_else(|| numbers.first())?
                .as_str()
                .map(str::to_owned)
        })
        .take(limit)
        .collect::<Vec<_>>();
    let local_count = probes.len();
    let results = stream::iter(probes.into_iter().map(|number| async move {
        let fetched = upstream::card(state, &number).await;
        (number, fetched)
    }))
    .buffered(concurrency)
    .collect::<Vec<_>>()
    .await;
    for (number, fetched) in results {
        audit
            .process(state, &number, fetched, name.as_deref(), fix)
            .await?;
    }
    if !scoped {
        let mut count = 0;
        for number in &upstream_numbers {
            let upper = number.to_uppercase();
            if local_variants.contains(&upper) || audit.covered.contains(&upper) {
                continue;
            }
            if count >= limit.saturating_sub(local_count) {
                break;
            }
            count += 1;
            audit
                .process(
                    state,
                    number,
                    upstream::card(state, number).await,
                    name.as_deref(),
                    fix,
                )
                .await?;
        }
    } else if let Some(number) = variant.as_ref().filter(|v| !local_variants.contains(*v)) {
        audit
            .process(
                state,
                number,
                upstream::card(state, number).await,
                name.as_deref(),
                fix,
            )
            .await?;
    }
    let mut post_fix = 0;
    for (id, hash) in &audit.verify {
        let row = db::rows(
            &state.db,
            "SELECT content_hash AS hash FROM cards WHERE id=$1::uuid",
            vec![id.clone().into()],
        )
        .await?;
        if !row.first().is_some_and(|v| v["hash"] == *hash) {
            post_fix += 1;
        }
    }
    let failed = (!fix && (!audit.mismatches.is_empty() || !audit.missing.is_empty()))
        || !audit.errors.is_empty()
        || post_fix > 0;
    let mut local_only = if scoped {
        Vec::new()
    } else {
        local_variants
            .difference(&upstream_set)
            .cloned()
            .collect::<Vec<_>>()
    };
    local_only.sort();
    Ok((
        json!({"checked":audit.checked.len(),"matching":audit.matching,"mismatches":audit.mismatches,"missingLocally":audit.missing,"localOnlyVariants":local_only,"fetchErrors":audit.errors,"fixed":audit.fixed,"postFixMismatches":post_fix}),
        failed,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn audit_name_filters_tolerate_the_same_small_typos() {
        assert!(matches(Some("stargazer"), &["Stagazer"]));
        assert!(matches(Some("jinx"), &["Jinx, Loose Cannon"]));
        assert!(!matches(Some("stargazer"), &["Jinx"]));
    }
    #[test]
    fn audit_compares_variant_identity_and_changed_fields() {
        let a = json!({"name":"A","variants":[{"variantNumber":"OGN-001","rarity":"Common"}]});
        let b = json!({"name":"B","variants":[{"variantNumber":"OGN-001","rarity":"Rare"},{"variantNumber":"OGN-002"}]});
        let diffs = differences(&a, &b);
        assert!(diffs.iter().any(|v| v["path"] == "name"));
        assert!(diffs.iter().any(|v| v["path"] == "variants.OGN-001.rarity"));
        assert!(diffs.iter().any(|v| v["path"] == "variants.OGN-002"));
    }
}
