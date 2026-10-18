use super::{
    formats,
    service::{self, Mutation},
};
use crate::{
    AppState, catalog, db,
    error::{AppError, Result},
    upstream,
};
use serde_json::{Value, json};
fn items(value: &Value) -> &[Value] {
    value.as_array().map(Vec::as_slice).unwrap_or(&[])
}
pub async fn resolve(
    state: &AppState,
    input: Vec<Value>,
) -> Result<(Vec<Value>, Vec<Value>, usize)> {
    let mut numbers = Vec::<String>::new();
    for item in &input {
        let number = db::string(item, "variantNumber").trim();
        if !number.is_empty() && !numbers.iter().any(|stored| stored == number) {
            numbers.push(number.into());
        }
    }
    let before = db::rows(
        &state.db,
        "SELECT variant_number AS number FROM variants WHERE variant_number=ANY($1::text[])",
        vec![numbers.clone().into()],
    )
    .await?;
    let mut known = std::collections::HashMap::<String, String>::new();
    for row in &before {
        let number = db::string(row, "number");
        known.insert(number.to_lowercase(), number.into());
    }
    let missing: Vec<_> = numbers
        .iter()
        .filter(|number| !known.contains_key(&number.to_lowercase()))
        .cloned()
        .collect();
    for batch in missing.chunks(50) {
        let result = upstream::request(
            state,
            reqwest::Method::POST,
            "/v1/cards/batch",
            &Value::Null,
            Some(&json!({"variantNumbers":batch})),
            Some("PaCardsBatchResponse"),
            false,
        )
        .await?;
        for number in items(&result["data"])
            .iter()
            .filter_map(|item| item["variantNumber"].as_str())
            .chain(items(&result["notFound"]).iter().filter_map(Value::as_str))
        {
            if let Ok(card) = upstream::card(state, number).await {
                catalog::store::upsert(state, &card).await?;
                for variant in items(&card["variants"]) {
                    let number = db::string(variant, "variantNumber");
                    known.insert(number.to_lowercase(), number.into());
                }
            }
        }
    }
    let mut errors = Vec::new();
    let mut valid = Vec::new();
    for mut item in input {
        let number = db::string(&item, "variantNumber").trim();
        if let Some(canonical) = known.get(&number.to_lowercase()) {
            item["variantNumber"] = json!(canonical);
            valid.push(item);
        } else {
            errors.push(json!({"row":0,"message":format!("Could not resolve variant: {}",db::string(&item,"variantNumber"))}));
        }
    }
    let resolved = numbers
        .iter()
        .filter(|number| {
            !before
                .iter()
                .any(|row| db::string(row, "number").eq_ignore_ascii_case(number))
                && known.contains_key(&number.to_lowercase())
        })
        .count();
    Ok((formats::aggregate(valid), errors, resolved))
}
pub async fn import(
    state: &AppState,
    collection: &str,
    user: &str,
    input: &Value,
) -> Result<Value> {
    let (parsed, mode, csv) =
        if let Some(input) = input["items"].as_array().filter(|items| !items.is_empty()) {
            (json!({"items":input,"errors":[]}), "set".to_owned(), false)
        } else if let Some(tts) = input["tts"].as_str().filter(|value| !value.is_empty()) {
            let mut parsed = formats::tts(tts);
            parsed["errors"] = json!(
                items(&parsed["errors"])
                    .iter()
                    .enumerate()
                    .map(|(index, error)| json!({"row":index+1,"message":error["message"]}))
                    .collect::<Vec<_>>()
            );
            (parsed, "add".into(), false)
        } else if let Some(csv) = input["csv"].as_str().filter(|value| !value.is_empty()) {
            (formats::csv(csv), "set".into(), true)
        } else {
            return Err(AppError {
                status: axum::http::StatusCode::BAD_REQUEST,
                body: json!({"error":"Provide csv, tts, or items"}),
            });
        };
    let mode = if input["items"]
        .as_array()
        .is_some_and(|items| !items.is_empty())
    {
        input["mode"].as_str().unwrap_or("set")
    } else {
        mode.as_str()
    };
    let (valid, mut errors, resolved) = if items(&parsed["items"]).is_empty() {
        (Vec::new(), Vec::new(), 0)
    } else {
        resolve(state, formats::aggregate(items(&parsed["items"]).to_vec())).await?
    };
    let mut prefix = items(&parsed["errors"]).to_vec();
    prefix.append(&mut errors);
    errors = prefix;
    let mut total = 0_i64;
    for item in &valid {
        let quantity = item["quantity"].as_i64().unwrap_or(0);
        service::mutate(
            state,
            collection,
            user,
            db::string(item, "variantNumber"),
            item,
            if mode == "add" {
                Mutation::Adjust(quantity)
            } else {
                Mutation::Set
            },
            "import",
        )
        .await?;
        total = total.saturating_add(quantity);
    }
    let mut response = json!({"data":{"imported":valid.len(),"totalCopies":total,"resolvedFromUpstream":resolved,"failedRows":errors.len(),"errors":errors}});
    if csv {
        response["data"]["rowsProcessed"] = parsed["rowsProcessed"].clone();
    }
    Ok(response)
}
pub async fn preview(state: &AppState, collection: &str, input: &Value) -> Result<Value> {
    let parsed = if let Some(tts) = input["tts"].as_str() {
        formats::tts(tts)
    } else {
        json!({"items":input["items"],"errors":[],"totalTokens":items(&input["items"]).iter().filter_map(|item|item["quantity"].as_i64()).sum::<i64>()})
    };
    let (valid, errors, _) = if items(&parsed["items"]).is_empty() {
        (Vec::new(), Vec::new(), 0)
    } else {
        resolve(state, items(&parsed["items"]).to_vec()).await?
    };
    let mut unresolved = items(&parsed["errors"]).to_vec();
    unresolved.extend(errors.into_iter().map(|error|json!({"token":db::string(&error,"message").strip_prefix("Could not resolve variant: ").unwrap_or(db::string(&error,"message")),"message":error["message"]})));
    let numbers: Vec<String> = valid
        .iter()
        .map(|item| db::string(item, "variantNumber").into())
        .collect();
    let catalog=db::rows(&state.db,"SELECT v.variant_number AS \"variantNumber\",v.foil_mode AS \"foilMode\",v.variant_label AS \"variantLabel\",v.variant_type AS \"variantType\",c.name,s.code AS \"setCode\",v.image_url AS \"imageUrl\" FROM variants v JOIN cards c ON c.id=v.card_id JOIN sets s ON s.id=v.set_id WHERE v.variant_number=ANY($1::text[])",vec![numbers.into()]).await?;
    let stacks=db::rows(&state.db,"SELECT variant_number AS \"variantNumber\",quantity,condition,language,is_foil AS \"isFoil\" FROM collection_items WHERE collection_id=$1::uuid",vec![collection.into()]).await?;
    let mut changes = Vec::new();
    for item in &valid {
        let number = db::string(item, "variantNumber");
        let meta = catalog.iter().find(|row| row["variantNumber"] == number);
        let foil = item["isFoil"]
            .as_bool()
            .unwrap_or_else(|| meta.is_some_and(catalog::mapper::foil));
        let before = stacks
            .iter()
            .find(|row| {
                row["variantNumber"] == number
                    && row["condition"] == item["condition"]
                    && row["language"] == item["language"]
                    && row["isFoil"] == foil
            })
            .and_then(|row| row["quantity"].as_i64())
            .unwrap_or(0);
        let delta = item["quantity"].as_i64().unwrap_or(0);
        let after = before.saturating_add(delta);
        let mut change = json!({"variantNumber":number,"name":meta.map(|row|row["name"].clone()),"setCode":meta.map(|row|row["setCode"].clone()),"imageUrl":meta.map(|row|row["imageUrl"].clone()),"quantityBefore":before,"quantityAfter":after,"quantityDelta":delta,"status":if before==0&&after>0{"new"}else if after>before{"increase"}else if after<before{"decrease"}else{"unchanged"}});
        crate::images::rewrite(state, &mut change["imageUrl"]);
        changes.push(change);
    }
    changes.sort_by(|a, b| {
        crate::search::compare(
            db::string(a, "variantNumber"),
            db::string(b, "variantNumber"),
        )
    });
    Ok(
        json!({"data":{"totalTokens":parsed["totalTokens"],"totalCopies":changes.iter().filter_map(|change|change["quantityDelta"].as_i64()).sum::<i64>(),"uniquePrintings":changes.len(),"unresolvedCount":unresolved.len(),"newCount":changes.iter().filter(|change|change["status"]=="new").count(),"increasedCount":changes.iter().filter(|change|change["status"]=="increase").count(),"decreasedCount":changes.iter().filter(|change|change["status"]=="decrease").count(),"unchangedCount":changes.iter().filter(|change|change["status"]=="unchanged").count(),"changes":changes,"unresolved":unresolved,"items":valid}}),
    )
}
pub async fn export(state: &AppState, collection: &str) -> Result<String> {
    let rows=db::rows(&state.db,"SELECT i.variant_number AS \"variantNumber\",i.quantity,i.condition,i.language,i.is_foil AS \"isFoil\",i.notes,i.grade_company AS \"gradeCompany\",i.grade_score AS \"gradeScore\",c.name,v.rarity,v.variant_type AS \"variantType\",v.variant_label AS \"variantLabel\",s.name AS \"setName\",s.code AS \"setCode\" FROM collection_items i JOIN variants v ON v.variant_number=i.variant_number JOIN cards c ON c.id=v.card_id JOIN sets s ON s.id=v.set_id WHERE i.collection_id=$1::uuid ORDER BY s.code,i.variant_number,i.condition",vec![collection.into()]).await?;
    Ok(formats::export(&rows))
}
