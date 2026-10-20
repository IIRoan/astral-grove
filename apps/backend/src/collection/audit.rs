use crate::{AppState, db, error::Result, search::Sql};
use serde_json::{Value, json};
const FIELDS: &str = "e.id::text AS id,e.collection_id::text AS \"collectionId\",e.action,e.variant_number AS \"variantNumber\",CASE WHEN e.condition=ANY(ARRAY['mint','near_mint','lightly_played','moderately_played','heavily_played','damaged','unspecified']) THEN e.condition ELSE NULL END AS condition,e.language,e.is_foil AS \"isFoil\",e.quantity_before AS \"quantityBefore\",e.quantity_after AS \"quantityAfter\",e.quantity_delta AS \"quantityDelta\",e.metadata,to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"createdAt\",jsonb_build_object('userId',e.actor_user_id,'name',u.name,'email',u.email) AS actor";
pub async fn list(
    state: &AppState,
    collection: Option<&str>,
    viewer: &str,
    input: &Value,
) -> Result<Value> {
    let mut sql = Sql::default();
    let mut filters = Vec::new();
    if let Some(collection) = collection {
        let p = sql.bind(collection);
        filters.push(format!("e.collection_id={p}::uuid"));
        let actor = if input["mine"] == true {
            Some(viewer)
        } else {
            input["actorUserId"].as_str()
        };
        if let Some(actor) = actor {
            let p = sql.bind(actor);
            filters.push(format!("e.actor_user_id={p}"));
        }
    } else {
        let p = sql.bind(viewer);
        filters.push(format!("e.actor_user_id={p}"));
    }
    for (key, column) in [
        ("variantNumber", "e.variant_number"),
        ("action", "e.action"),
    ] {
        if let Some(value) = input[key].as_str() {
            let p = sql.bind(value);
            filters.push(format!("{column}={p}"));
        }
    }
    // An event id cursor keeps events that share the previous page's last timestamp.
    if let Some(id) = input["beforeId"].as_str() {
        // A cursor outside the viewer's events would compare as NULL and silently end the history.
        let visible = match collection {
            Some(collection) => db::rows(&state.db, "SELECT 1 FROM collection_audit_events WHERE id=$1::uuid AND collection_id=$2::uuid", vec![id.into(), collection.into()]).await?,
            None => db::rows(&state.db, "SELECT 1 FROM collection_audit_events WHERE id=$1::uuid AND actor_user_id=$2", vec![id.into(), viewer.into()]).await?,
        };
        if visible.is_empty() {
            return Err(crate::error::AppError::not_found("Audit cursor not found"));
        }
        let p = sql.bind(id);
        filters.push(format!(
            "(e.created_at,e.id)<(SELECT c.created_at,c.id FROM collection_audit_events c WHERE c.id={p}::uuid)"
        ));
    } else if let Some(before) = input["before"].as_str() {
        let p = sql.bind(before);
        filters.push(format!(
            "e.created_at<date_trunc('milliseconds',{p}::timestamptz)"
        ));
    }
    let filter = filters.join(" AND ");
    let total = db::rows(
        &state.db,
        &format!("SELECT count(*)::bigint AS total FROM collection_audit_events e WHERE {filter}"),
        sql.values.clone(),
    )
    .await?
    .first()
    .and_then(|row| row["total"].as_i64())
    .unwrap_or(0);
    let limit = input["limit"].as_i64().unwrap_or(50);
    let mut rows=db::rows(&state.db,&format!("SELECT {FIELDS} FROM collection_audit_events e LEFT JOIN \"user\" u ON u.id=e.actor_user_id AND (e.collection_id IS NULL OR EXISTS(SELECT 1 FROM collection_members m WHERE m.collection_id=e.collection_id AND m.user_id=e.actor_user_id)) WHERE {filter} ORDER BY e.created_at DESC,e.id DESC LIMIT {}",limit+1),sql.values).await?;
    let more = rows.len() > limit as usize;
    rows.truncate(limit as usize);
    Ok(json!({"data":rows,"meta":{"total":total,"limit":limit,"hasMore":more}}))
}
pub async fn activity(state: &AppState, collection: &str, input: &Value) -> Result<Value> {
    let mut numbers = Vec::<String>::new();
    for number in db::array(input, "variantNumbers")
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if !numbers.iter().any(|stored| stored == number) {
            numbers.push(number.into());
        }
    }
    numbers.truncate(5000);
    if numbers.is_empty() {
        return Ok(json!({"data":[],"meta":{"hasMore":false,"nextCursor":null}}));
    }
    let limit = input["limit"].as_i64().unwrap_or(20);
    let mut sql = Sql::default();
    let c = sql.bind(collection);
    let n = sql.bind(numbers);
    let mut filter = format!(
        "e.collection_id={c}::uuid AND e.variant_number=ANY({n}::text[]) AND e.quantity_delta IS NOT NULL AND e.quantity_delta<>0"
    );
    if let (Some(at), Some(id)) = (
        input["cursor"]["at"].as_str(),
        input["cursor"]["id"].as_str(),
    ) {
        let at = sql.bind(at);
        let id = sql.bind(id);
        filter.push_str(&format!(
            " AND (e.created_at,e.id)<({at}::timestamptz,{id}::uuid)"
        ));
    }
    let mut rows=db::rows(&state.db,&format!("SELECT {FIELDS},to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cursor FROM collection_audit_events e LEFT JOIN \"user\" u ON u.id=e.actor_user_id AND (e.collection_id IS NULL OR EXISTS(SELECT 1 FROM collection_members m WHERE m.collection_id=e.collection_id AND m.user_id=e.actor_user_id)) WHERE {filter} ORDER BY e.created_at DESC,e.id DESC LIMIT {}",limit+1),sql.values).await?;
    let more = rows.len() > limit as usize;
    rows.truncate(limit as usize);
    let cursor = if more {
        rows.last()
            .map(|row| json!({"id":row["id"],"at":row["cursor"]}))
            .unwrap_or(Value::Null)
    } else {
        Value::Null
    };
    let data:Vec<_>=rows.into_iter().filter(|row|crate::http::schemas::schema("CollectionAuditAction").parse(row.get("action")).is_ok()).map(|row|json!({"id":row["id"],"at":row["createdAt"],"action":row["action"],"quantityDelta":row["quantityDelta"],"quantityAfter":row["quantityAfter"],"isFoil":row["isFoil"],"actor":row["actor"]})).collect();
    Ok(json!({"data":data,"meta":{"hasMore":more,"nextCursor":cursor}}))
}
