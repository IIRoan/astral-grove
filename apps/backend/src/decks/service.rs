use super::upstream;
use crate::{
    AppState, db,
    error::{AppError, Result},
};
use sea_orm::{ConnectionTrait, DatabaseTransaction, TransactionTrait};
use serde_json::{Value, json};
use std::collections::HashSet;
pub fn missing(version: bool) -> AppError {
    AppError {
        status: axum::http::StatusCode::NOT_FOUND,
        body: json!({"error":if version{"Deck version not found"}else{"Deck not found"}}),
    }
}
fn readonly() -> AppError {
    AppError::new(
        403,
        "DECK_READ_ONLY",
        "Imported Piltover Archive decks are read-only",
    )
}
fn now() -> i64 {
    (time::OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000) as i64
}
fn id(prefix: &str) -> String {
    format!("{prefix}_{}", uuid::Uuid::new_v4().simple())
}
pub async fn row(db: &impl ConnectionTrait, user: &str, id: &str) -> Result<Option<Value>> {
    Ok(db::rows(
        db,
        "SELECT payload,active_version_id AS active,share_token FROM user_decks WHERE user_id=$1 AND id=$2",
        vec![user.into(), id.into()],
    )
    .await?
    .into_iter()
    .next())
}
async fn versions(db: &impl ConnectionTrait, user: &str, id: &str) -> Result<Vec<Value>> {
    db::rows(db,"SELECT id,name,payload,floor(extract(epoch FROM created_at)*1000)::bigint AS \"createdAt\",floor(extract(epoch FROM updated_at)*1000)::bigint AS \"updatedAt\" FROM user_deck_versions WHERE user_id=$1 AND deck_id=$2 ORDER BY updated_at DESC",vec![user.into(),id.into()]).await
}
fn owned(mut payload: Value) -> Value {
    payload["source"] = json!("owned");
    payload["readOnly"] = json!(false);
    payload
}
async fn detail(
    db: &impl ConnectionTrait,
    user: &str,
    payload: Value,
    active: Option<&str>,
    share_token: Option<&str>,
) -> Result<Value> {
    let records = versions(db, user, db::string(&payload, "id")).await?;
    let active = records
        .iter()
        .find(|row| Some(db::string(row, "id")) == active)
        .or_else(|| records.first());
    let mut payload = owned(payload);
    payload["shareToken"] = json!(share_token);
    if let Some(active) = active {
        payload["versionId"] = active["id"].clone();
        payload["versionName"] = active["name"].clone();
        let mut summaries:Vec<_>=records.iter().map(|row|json!({"id":row["id"],"name":row["name"],"createdAt":row["createdAt"],"updatedAt":row["updatedAt"],"isActive":row["id"]==active["id"]})).collect();
        summaries.sort_by(|left, right| {
            right["isActive"]
                .as_bool()
                .cmp(&left["isActive"].as_bool())
                .then_with(|| right["updatedAt"].as_i64().cmp(&left["updatedAt"].as_i64()))
        });
        payload["versions"] = json!(summaries);
    }
    Ok(payload)
}
async fn lock(state: &AppState, user: &str) -> Result<DatabaseTransaction> {
    let tx = state.db.begin().await?;
    db::execute(
        &tx,
        "SELECT pg_advisory_xact_lock(hashtextextended($1,1280472987))",
        vec![user.into()],
    )
    .await?;
    Ok(tx)
}
async fn assert_editable(state: &AppState, user: &str, id: &str, version: bool) -> Result<Value> {
    if let Some(row) = row(&state.db, user, id).await? {
        return Ok(row);
    }
    if upstream::get_stored(state, id).await.is_some() {
        return Err(readonly());
    }
    Err(missing(version))
}
fn persist(mut incoming: Value, stored: Option<&Value>, trusted: bool) -> Value {
    let stored = stored.unwrap_or(&Value::Null);
    for key in ["upstreamId", "importedFromId"] {
        let value = stored
            .get(key)
            .or_else(|| trusted.then(|| incoming.get(key)).flatten())
            .cloned();
        if let Some(map) = incoming.as_object_mut() {
            map.remove(key);
            if let Some(value) =
                value.filter(|value| value.as_str().is_some_and(|value| !value.is_empty()))
            {
                map.insert(key.into(), value);
            }
        }
    }
    if incoming.get("description").is_none() {
        incoming["description"] = json!("");
    }
    incoming
}
fn merge(family: &Value, version: &Value) -> Value {
    let mut result = version.clone();
    for key in ["id", "name", "createdAt"] {
        result[key] = family[key].clone();
    }
    result["description"] = family.get("description").cloned().unwrap_or(json!(""));
    for key in ["upstreamId", "importedFromId", "syncWarnings"] {
        if let Some(value) = family.get(key) {
            result[key] = value.clone();
        }
    }
    result
}
pub async fn list(state: &AppState, user: &str, query: &Value) -> Result<Value> {
    let rows=db::rows(&state.db,"SELECT d.payload,d.active_version_id AS active,d.share_token,v.name AS \"versionName\" FROM user_decks d LEFT JOIN user_deck_versions v ON v.user_id=d.user_id AND v.id=d.active_version_id WHERE d.user_id=$1 ORDER BY d.updated_at DESC",vec![user.into()]).await?;
    let needle = db::string(query, "q").trim().to_lowercase();
    let mut owned_items = Vec::new();
    let mut skip = HashSet::new();
    for row in &rows {
        let payload = &row["payload"];
        if let Some(upstream) = payload["upstreamId"]
            .as_str()
            .filter(|value| !value.is_empty())
        {
            skip.insert(upstream.into());
        }
        let id = db::string(payload, "id");
        if !id.starts_with("deck_") {
            skip.insert(id.into());
        }
        if query["source"] == "imported" {
            continue;
        }
        let haystack = format!(
            "{} {} {} {}",
            db::string(payload, "name"),
            db::string(payload, "description"),
            db::string(&payload["legend"], "name"),
            db::string(&payload["champion"], "name")
        )
        .to_lowercase();
        if !needle.is_empty() && !haystack.contains(&needle) {
            continue;
        }
        let mut item = owned(payload.clone());
        item["shareToken"] = row["share_token"].clone();
        if let (Some(active), Some(name)) = (
            row["active"].as_str().filter(|value| !value.is_empty()),
            row["versionName"]
                .as_str()
                .filter(|value| !value.is_empty()),
        ) {
            item["versionId"] = json!(active);
            item["versionName"] = json!(name);
        }
        owned_items.push(item);
    }
    // A community-only browse surfaces a PA outage; mixed lists still show owned decks.
    let imported = match query["source"].as_str() {
        Some("owned") => json!({"items":[]}),
        Some("imported") => upstream::list_imported(state, query, &skip).await?,
        _ => upstream::list_imported(state, query, &skip)
            .await
            .unwrap_or(json!({"items":[]})),
    };
    let imported_items = imported["items"].as_array().cloned().unwrap_or_default();
    let owned_count = owned_items.len();
    let imported_count = imported_items.len();
    owned_items.extend(imported_items);
    let mut meta = json!({"total":imported["pagination"]["total"].as_i64().unwrap_or(owned_items.len() as i64),"owned":owned_count,"imported":imported_count});
    if let Some(pagination) = imported.get("pagination") {
        meta["pagination"] = pagination.clone();
    }
    Ok(json!({"data":owned_items,"meta":meta}))
}
pub async fn get(state: &AppState, user: &str, id: &str) -> Result<Value> {
    if let Some(row) = row(&state.db, user, id).await? {
        return detail(
            &state.db,
            user,
            row["payload"].clone(),
            row["active"].as_str(),
            row["share_token"].as_str(),
        )
        .await;
    }
    upstream::get_item(state, id)
        .await
        .ok_or_else(|| missing(false))
}

pub async fn set_sharing(state: &AppState, user: &str, deck: &str, enabled: bool) -> Result<Value> {
    let tx = lock(state, user).await?;
    let token = enabled.then(|| id("dshare"));
    let records = db::rows(
        &tx,
        "UPDATE user_decks SET share_token=CASE WHEN $3::text IS NULL THEN NULL ELSE COALESCE(share_token,$3) END WHERE user_id=$1 AND id=$2 RETURNING payload,active_version_id AS active,share_token",
        vec![user.into(), deck.into(), token.into()],
    )
    .await?;
    let record = records.first().ok_or_else(|| missing(false))?;
    let result = detail(
        &tx,
        user,
        record["payload"].clone(),
        record["active"].as_str(),
        record["share_token"].as_str(),
    )
    .await?;
    tx.commit().await?;
    Ok(result)
}

fn shared_payload(payload: &Value, token: &str) -> Result<Value> {
    let mut public = crate::http::value("DeckUpsertRequest", payload)?;
    if let Some(fields) = public.as_object_mut() {
        for key in ["upstreamId", "importedFromId", "syncWarnings"] {
            fields.remove(key);
        }
    }
    public["id"] = json!(token);
    public["source"] = json!("owned");
    public["readOnly"] = json!(true);
    public["shareToken"] = json!(token);
    Ok(public)
}

pub async fn get_shared(state: &AppState, token: &str) -> Result<Value> {
    let records = db::rows(
        &state.db,
        "SELECT payload FROM user_decks WHERE share_token=$1",
        vec![token.into()],
    )
    .await?;
    let record = records.first().ok_or_else(|| missing(false))?;
    shared_payload(&record["payload"], token)
}
pub async fn upsert(
    state: &AppState,
    user: &str,
    incoming: Value,
    trusted: bool,
    deduplicate: Option<&str>,
) -> Result<Value> {
    let deck_id = db::string(&incoming, "id").to_owned();
    if row(&state.db, user, &deck_id).await?.is_none()
        && upstream::get_stored(state, &deck_id).await.is_some()
    {
        return Err(readonly());
    }
    let tx = lock(state, user).await?;
    if let Some(source) = deduplicate
        && let Some(existing)=db::rows(&tx,"SELECT payload FROM user_decks WHERE user_id=$1 AND (payload->>'importedFromId'=$2 OR payload->>'upstreamId'=$2 OR id=$2) LIMIT 1",vec![user.into(),source.into()]).await?.first(){return Ok(owned(existing["payload"].clone()));}
    let existing = row(&tx, user, &deck_id).await?;
    let mut next = persist(
        incoming,
        existing.as_ref().map(|row| &row["payload"]),
        trusted,
    );
    let version = existing
        .as_ref()
        .and_then(|row| row["active"].as_str())
        .map(str::to_owned)
        .unwrap_or_else(|| id("dver"));
    let timestamp = now();
    next["updatedAt"] = json!(timestamp);
    db::execute(&tx,"INSERT INTO user_decks(id,user_id,name,description,payload,active_version_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,to_timestamp($7::double precision/1000.0),to_timestamp($8::double precision/1000.0)) ON CONFLICT(user_id,id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,payload=EXCLUDED.payload,active_version_id=EXCLUDED.active_version_id,updated_at=EXCLUDED.updated_at",vec![deck_id.clone().into(),user.into(),db::string(&next,"name").into(),db::string(&next,"description").into(),next.clone().into(),version.clone().into(),next["createdAt"].as_i64().unwrap_or(0).into(),timestamp.into()]).await?;
    if existing
        .as_ref()
        .and_then(|row| row["active"].as_str())
        .is_none()
    {
        db::execute(&tx,"INSERT INTO user_deck_versions(id,user_id,deck_id,name,payload,created_at,updated_at) VALUES($1,$2,$3,'Current',$4,to_timestamp($5::double precision/1000.0),to_timestamp($6::double precision/1000.0))",vec![version.clone().into(),user.into(),deck_id.into(),next.clone().into(),next["createdAt"].as_i64().unwrap_or(0).into(),timestamp.into()]).await?;
    } else {
        db::execute(&tx,"UPDATE user_deck_versions SET payload=$3,updated_at=to_timestamp($4::double precision/1000.0) WHERE user_id=$1 AND id=$2",vec![user.into(),version.clone().into(),next.clone().into(),timestamp.into()]).await?;
    }
    let result = detail(
        &tx,
        user,
        next,
        Some(&version),
        existing
            .as_ref()
            .and_then(|row| row["share_token"].as_str()),
    )
    .await?;
    tx.commit().await?;
    Ok(result)
}
pub async fn import(state: &AppState, user: &str, source: &str) -> Result<Value> {
    if let Some(existing)=db::rows(&state.db,"SELECT payload FROM user_decks WHERE user_id=$1 AND (payload->>'importedFromId'=$2 OR payload->>'upstreamId'=$2 OR id=$2) LIMIT 1",vec![user.into(),source.into()]).await?.first(){return Ok(owned(existing["payload"].clone()));}
    let mut payload = upstream::get_stored(state, source)
        .await
        .ok_or_else(|| missing(false))?;
    if !db::array(&payload, "syncWarnings").is_empty() {
        return Err(AppError::new(
            503,
            "DECK_CATALOG_INCOMPLETE",
            "Some card details are unavailable. Please try importing this deck again later.",
        ));
    }
    let timestamp = now();
    payload["id"] = json!(id("deck"));
    payload["createdAt"] = json!(timestamp);
    payload["updatedAt"] = json!(timestamp);
    payload["upstreamId"] = json!(source);
    payload["importedFromId"] = json!(source);
    upsert(state, user, payload, true, Some(source)).await
}
pub enum VersionAction {
    Create(String),
    Rename(String, String),
    Activate(String),
    Delete(String),
    Save(String, Value),
}
pub async fn version(
    state: &AppState,
    user: &str,
    deck: &str,
    action: VersionAction,
) -> Result<Value> {
    assert_editable(state, user, deck, true).await?;
    let tx = lock(state, user).await?;
    let family = row(&tx, user, deck).await?.ok_or_else(|| missing(true))?;
    let mut records = versions(&tx, user, deck).await?;
    let active = db::string(&family, "active");
    let timestamp = now();
    let mut payload = family["payload"].clone();
    let mut active_id = active.to_owned();
    match action {
        VersionAction::Create(name) => {
            if records.len() >= 25 {
                return Err(AppError::new(
                    409,
                    "DECK_VERSION_LIMIT",
                    "A deck can have at most 25 versions",
                ));
            }
            let source = records
                .iter()
                .find(|row| row["id"] == active)
                .or_else(|| records.first())
                .map(|row| &row["payload"])
                .unwrap_or(&payload);
            let mut copy = merge(&payload, source);
            copy["updatedAt"] = json!(timestamp);
            active_id = id("dver");
            db::execute(&tx,"INSERT INTO user_deck_versions(id,user_id,deck_id,name,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,to_timestamp($6::double precision/1000.0),to_timestamp($6::double precision/1000.0))",vec![active_id.clone().into(),user.into(),deck.into(),name.into(),copy.clone().into(),timestamp.into()]).await?;
            payload = copy;
            db::execute(&tx,"UPDATE user_decks SET name=$3,description=$4,payload=$5,active_version_id=$6,updated_at=to_timestamp($7::double precision/1000.0) WHERE user_id=$1 AND id=$2",vec![user.into(),deck.into(),db::string(&payload,"name").into(),db::string(&payload,"description").into(),payload.clone().into(),active_id.clone().into(),timestamp.into()]).await?;
        }
        VersionAction::Rename(id, name) => {
            if !records.iter().any(|row| row["id"] == id) {
                return Err(missing(true));
            }
            db::execute(&tx,"UPDATE user_deck_versions SET name=$4,updated_at=to_timestamp($5::double precision/1000.0) WHERE user_id=$1 AND deck_id=$2 AND id=$3",vec![user.into(),deck.into(),id.into(),name.into(),timestamp.into()]).await?;
        }
        VersionAction::Activate(id) => {
            let record = records
                .iter()
                .find(|row| row["id"] == id)
                .ok_or_else(|| missing(true))?;
            payload = merge(&payload, &record["payload"]);
            payload["updatedAt"] = json!(timestamp);
            active_id = id;
            db::execute(&tx,"UPDATE user_decks SET payload=$3,active_version_id=$4,updated_at=to_timestamp($5::double precision/1000.0) WHERE user_id=$1 AND id=$2",vec![user.into(),deck.into(),payload.clone().into(),active_id.clone().into(),timestamp.into()]).await?;
        }
        VersionAction::Delete(id) => {
            if !records.iter().any(|row| row["id"] == id) {
                return Err(missing(true));
            }
            if records.len() <= 1 {
                return Err(AppError::new(
                    409,
                    "DECK_LAST_VERSION",
                    "Cannot delete the last remaining deck version",
                ));
            }
            records.retain(|row| row["id"] != id);
            let next = if active == id {
                records.first()
            } else {
                records
                    .iter()
                    .find(|row| row["id"] == active)
                    .or_else(|| records.first())
            }
            .ok_or_else(|| missing(true))?;
            active_id = db::string(next, "id").into();
            if active == id {
                payload = merge(&payload, &next["payload"]);
                payload["updatedAt"] = json!(timestamp);
                db::execute(&tx,"UPDATE user_decks SET payload=$3,active_version_id=$4,updated_at=to_timestamp($5::double precision/1000.0) WHERE user_id=$1 AND id=$2",vec![user.into(),deck.into(),payload.clone().into(),active_id.clone().into(),timestamp.into()]).await?;
            }
            db::execute(
                &tx,
                "DELETE FROM user_deck_versions WHERE user_id=$1 AND deck_id=$2 AND id=$3",
                vec![user.into(), deck.into(), id.into()],
            )
            .await?;
        }
        VersionAction::Save(id, incoming) => {
            if !records.iter().any(|row| row["id"] == id) {
                return Err(missing(true));
            }
            let mut next = persist(incoming, Some(&family["payload"]), false);
            next["updatedAt"] = json!(timestamp);
            db::execute(&tx,"UPDATE user_deck_versions SET payload=$4,updated_at=to_timestamp($5::double precision/1000.0) WHERE user_id=$1 AND deck_id=$2 AND id=$3",vec![user.into(),deck.into(),id.clone().into(),next.clone().into(),timestamp.into()]).await?;
            if active == id {
                db::execute(&tx,"UPDATE user_decks SET name=$3,description=$4,payload=$5,updated_at=to_timestamp($6::double precision/1000.0) WHERE user_id=$1 AND id=$2",vec![user.into(),deck.into(),db::string(&next,"name").into(),db::string(&next,"description").into(),next.clone().into(),timestamp.into()]).await?;
                payload = next;
            }
        }
    }
    let result = detail(
        &tx,
        user,
        payload,
        Some(&active_id),
        family["share_token"].as_str(),
    )
    .await?;
    tx.commit().await?;
    Ok(result)
}
pub async fn delete(state: &AppState, user: &str, id: &str) -> Result<Value> {
    let owned = assert_editable(state, user, id, false).await?;
    if let Some(upstream) = owned["payload"]["upstreamId"]
        .as_str()
        .filter(|id| !id.is_empty())
        && owned["payload"]["importedFromId"] != upstream
    {
        db::execute(
            &state.db,
            "INSERT INTO private_upstream_decks(upstream_id) VALUES($1) ON CONFLICT DO NOTHING",
            vec![upstream.into()],
        )
        .await?;
    }
    let tx = lock(state, user).await?;
    let deleted = db::execute(
        &tx,
        "DELETE FROM user_decks WHERE user_id=$1 AND id=$2",
        vec![user.into(), id.into()],
    )
    .await?;
    tx.commit().await?;
    if deleted == 0 {
        return Err(missing(false));
    }
    Ok(json!({"data":{"id":id}}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_deck_only_exposes_the_active_list() -> Result<()> {
        let public = shared_payload(
            &json!({
                "id":"private-id", "name":"Deck", "createdAt":1, "updatedAt":2,
                "legend":null, "champion":null, "mainDeck":[], "runes":[], "battlefields":[], "sideboard":[],
                "upstreamId":"private-upstream", "importedFromId":"private-source", "syncWarnings":["private warning"],
                "userId":"private-owner", "versions":[{"name":"Private version"}], "share_token":"private-token"
            }),
            "public-token",
        )?;
        assert_eq!(public["id"], "public-token");
        assert_eq!(public["source"], "owned");
        assert_eq!(public["shareToken"], "public-token");
        assert_eq!(public["readOnly"], true);
        assert_eq!(public["format"], "constructed");
        for key in [
            "upstreamId",
            "importedFromId",
            "syncWarnings",
            "userId",
            "versions",
            "share_token",
        ] {
            assert!(public.get(key).is_none(), "{key} must stay private");
        }
        Ok(())
    }

    #[test]
    fn persistence_preserves_stored_provenance_and_only_trusts_server_imports() {
        let incoming = json!({"name":"Edited","upstreamId":"incoming","importedFromId":"incoming"});
        let stored = json!({"upstreamId":"stored","importedFromId":"stored"});
        for trusted in [false, true] {
            let saved = persist(incoming.clone(), Some(&stored), trusted);
            assert_eq!(saved["name"], "Edited");
            assert_eq!(saved["description"], "");
            assert_eq!(saved["upstreamId"], "stored");
            assert_eq!(saved["importedFromId"], "stored");
        }
        let untrusted = persist(incoming.clone(), None, false);
        assert!(untrusted.get("upstreamId").is_none());
        assert!(untrusted.get("importedFromId").is_none());
        let imported = persist(incoming, None, true);
        assert_eq!(imported["upstreamId"], "incoming");
        assert_eq!(imported["importedFromId"], "incoming");
    }
}
