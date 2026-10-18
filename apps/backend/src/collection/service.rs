use crate::{
    AppState, db,
    error::{AppError, Result},
};
use sea_orm::TransactionTrait;
use serde_json::{Value, json};

const ITEM_SELECT: &str = "SELECT i.id::text AS id,i.variant_number AS \"variantNumber\",i.quantity,i.condition,i.language,i.is_foil AS \"isFoil\",i.notes,i.is_graded AS \"isGraded\",i.grade_company AS \"gradeCompany\",i.grade_score AS \"gradeScore\",to_char(i.acquired_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"acquiredAt\",i.acquired_price_cents AS \"acquiredPriceCents\",to_char(i.added_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"addedAt\",to_char(i.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"updatedAt\",c.name,v.image_url AS \"imageUrl\",s.code AS \"setCode\",v.rarity,c.type,v.variant_label AS \"variantLabel\" FROM collection_items i JOIN variants v ON v.variant_number=i.variant_number JOIN cards c ON c.id=v.card_id JOIN sets s ON s.id=v.set_id";

pub async fn list(state: &AppState, collection_id: &str) -> Result<Value> {
    let mut items = db::rows(
        &state.db,
        &format!("{ITEM_SELECT} WHERE i.collection_id=$1::uuid ORDER BY i.updated_at DESC"),
        vec![collection_id.into()],
    )
    .await?;
    for item in &mut items {
        crate::images::rewrite(state, &mut item["imageUrl"]);
    }
    let quantity: i64 = items
        .iter()
        .filter_map(|item| item["quantity"].as_i64())
        .sum();
    Ok(json!({"meta":{"total":items.len(),"totalQuantity":quantity},"data":items}))
}

pub enum Mutation {
    Set,
    Adjust(i64),
    Delete,
}

pub async fn mutate(
    state: &AppState,
    collection_id: &str,
    user_id: &str,
    variant: &str,
    input: &Value,
    mutation: Mutation,
    action: &str,
) -> Result<Value> {
    let tx = state.db.begin().await?;
    db::rows(
        &tx,
        "SELECT id FROM collections WHERE id=$1::uuid FOR UPDATE",
        vec![collection_id.into()],
    )
    .await?;
    let member = db::rows(
        &tx,
        "SELECT id FROM collection_members WHERE collection_id=$1::uuid AND user_id=$2",
        vec![collection_id.into(), user_id.into()],
    )
    .await?;
    if member.is_empty() {
        return Err(AppError::unauthorized());
    }
    let catalog = db::rows(&tx,"SELECT variant_number,foil_mode,variant_label,variant_type FROM variants WHERE variant_number=$1",vec![variant.into()]).await?;
    let fallback = serde_json::json!({});
    let card = catalog.first().unwrap_or(&fallback);
    let foil = input
        .get("isFoil")
        .and_then(Value::as_bool)
        .unwrap_or_else(|| {
            db::string(card, "foil_mode").eq_ignore_ascii_case("foil_only")
                || [
                    variant,
                    db::string(card, "variant_label"),
                    db::string(card, "variant_type"),
                ]
                .iter()
                .any(|text| text.to_lowercase().contains("foil"))
        });
    let condition = input
        .get("condition")
        .and_then(Value::as_str)
        .unwrap_or("near_mint");
    let language = input
        .get("language")
        .and_then(Value::as_str)
        .unwrap_or("en");
    let keys: Vec<sea_orm::Value> = vec![
        collection_id.into(),
        variant.into(),
        condition.into(),
        language.into(),
        foil.into(),
    ];
    let existing = db::rows(&tx,"SELECT quantity FROM collection_items WHERE collection_id=$1::uuid AND variant_number=$2 AND condition=$3 AND language=$4 AND is_foil=$5 FOR UPDATE",keys.clone()).await?;
    let before = existing
        .first()
        .and_then(|row| row["quantity"].as_i64())
        .unwrap_or(0);
    let after = match mutation {
        Mutation::Set => input["quantity"]
            .as_i64()
            .ok_or_else(AppError::validation)?,
        Mutation::Adjust(delta) => before
            .checked_add(delta)
            .ok_or_else(AppError::validation)?
            .max(0),
        Mutation::Delete => 0,
    };
    if after <= 0 {
        db::execute(&tx,"DELETE FROM collection_items WHERE collection_id=$1::uuid AND variant_number=$2 AND condition=$3 AND language=$4 AND is_foil=$5",keys.clone()).await?;
    } else if matches!(mutation, Mutation::Set) {
        let mut values = keys.clone();
        values.extend([
            after.into(),
            input
                .get("notes")
                .and_then(Value::as_str)
                .map(str::to_owned)
                .into(),
            input
                .get("isGraded")
                .and_then(Value::as_bool)
                .unwrap_or(false)
                .into(),
            input
                .get("gradeCompany")
                .and_then(Value::as_str)
                .map(str::to_owned)
                .into(),
            input
                .get("gradeScore")
                .and_then(Value::as_str)
                .map(str::to_owned)
                .into(),
            input
                .get("acquiredAt")
                .and_then(Value::as_str)
                .map(|value| crate::instant::milliseconds_only(value).into_owned())
                .into(),
            input
                .get("acquiredPriceCents")
                .and_then(Value::as_i64)
                .into(),
        ]);
        db::execute(&tx,"INSERT INTO collection_items(collection_id,variant_number,condition,language,is_foil,quantity,notes,is_graded,grade_company,grade_score,acquired_at,acquired_price_cents) VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,date_trunc('milliseconds',$11::timestamptz),$12) ON CONFLICT(collection_id,variant_number,condition,language,is_foil) DO UPDATE SET quantity=EXCLUDED.quantity,notes=EXCLUDED.notes,is_graded=EXCLUDED.is_graded,grade_company=EXCLUDED.grade_company,grade_score=EXCLUDED.grade_score,acquired_at=EXCLUDED.acquired_at,acquired_price_cents=EXCLUDED.acquired_price_cents,updated_at=now()",values).await?;
    } else {
        let mut values = keys.clone();
        values.push(after.into());
        db::execute(&tx,"INSERT INTO collection_items(collection_id,variant_number,condition,language,is_foil,quantity) VALUES($1::uuid,$2,$3,$4,$5,$6) ON CONFLICT(collection_id,variant_number,condition,language,is_foil) DO UPDATE SET quantity=EXCLUDED.quantity,updated_at=now()",values).await?;
    }
    if before != after {
        db::execute(&tx,"INSERT INTO collection_audit_events(collection_id,actor_user_id,action,variant_number,condition,language,is_foil,quantity_before,quantity_after,quantity_delta) VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10)",vec![collection_id.into(),user_id.into(),(if action=="upsert"&&after==0 {"delete"}else{action}).into(),variant.into(),condition.into(),language.into(),foil.into(),before.into(),after.into(),(after-before).into()]).await?;
    }
    let mut item = if after > 0 {
        db::rows(&tx,&format!("{ITEM_SELECT} WHERE i.collection_id=$1::uuid AND i.variant_number=$2 AND i.condition=$3 AND i.language=$4 AND i.is_foil=$5"),keys).await?.into_iter().next().unwrap_or(Value::Null)
    } else {
        Value::Null
    };
    tx.commit().await?;
    if !item.is_null() {
        crate::images::rewrite(state, &mut item["imageUrl"]);
    }
    Ok(json!({"data":item}))
}

pub async fn quantities(
    state: &AppState,
    collection_id: &str,
    numbers: Vec<String>,
) -> Result<Value> {
    let mut unique = Vec::new();
    for number in numbers {
        if !unique.contains(&number) {
            unique.push(number);
        }
    }
    let mut result = Vec::new();
    for chunk in unique.chunks(200) {
        let rows = db::rows(&state.db,"SELECT variant_number AS \"variantNumber\",is_foil AS \"isFoil\",sum(quantity)::bigint AS quantity FROM collection_items WHERE collection_id=$1::uuid AND variant_number=ANY($2::text[]) GROUP BY variant_number,is_foil",vec![collection_id.into(),chunk.to_vec().into()]).await?;
        for number in chunk {
            let mut matching: Vec<_> = rows
                .iter()
                .filter(|row| row["variantNumber"] == *number)
                .cloned()
                .collect();
            matching.sort_by_key(|row| row["isFoil"].as_bool().unwrap_or(false));
            if matching.is_empty() {
                result.push(json!({"variantNumber":number,"isFoil":false,"quantity":0}));
            } else {
                result.extend(matching);
            }
        }
    }
    Ok(json!({"data":result}))
}
