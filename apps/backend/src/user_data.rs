use crate::{
    AppState,
    auth::RouteUser,
    db,
    error::{AppError, Result},
    http,
};
use astral_grove_api_types::{
    OkResponse, UserSettingsResponse, UserSettingsUpsertRequest, WishlistItemResponse,
    WishlistListResponse, WishlistUpsertRequest,
};
use axum::{
    Json,
    extract::{Path, State},
};
use serde_json::{Value, json};
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};

const WISHLIST_SELECT: &str = "SELECT i.id::text AS id,i.variant_number AS \"variantNumber\",i.priority,i.target_price_cents AS \"targetPriceCents\",i.notes,to_char(i.added_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"addedAt\",c.name,v.image_url AS \"imageUrl\",s.code AS \"setCode\",v.rarity,v.variant_label AS \"variantLabel\" FROM wishlist_items i JOIN variants v ON v.variant_number=i.variant_number JOIN cards c ON c.id=v.card_id JOIN sets s ON s.id=v.set_id";
#[utoipa::path(get,path="/api/v1/wishlist",operation_id="listWishlist",responses((status=200,body=WishlistListResponse)))]
async fn wishlist(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<WishlistListResponse>> {
    let mut items = db::rows(
        &state.db,
        &format!("{WISHLIST_SELECT} WHERE i.user_id=$1 ORDER BY i.priority,i.added_at"),
        vec![session.user.id.into()],
    )
    .await?;
    for item in &mut items {
        crate::images::rewrite(&state, &mut item["imageUrl"]);
    }
    http::respond(
        "WishlistListResponse",
        json!({"meta":{"total":items.len()},"data":items}),
    )
}
#[utoipa::path(put,path="/api/v1/wishlist/{variantNumber}",operation_id="setWishlistItem",request_body=WishlistUpsertRequest,responses((status=200,body=WishlistItemResponse)))]
async fn set_wishlist(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(variant): Path<String>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<WishlistItemResponse>> {
    let mut body = body.as_object().cloned().unwrap_or_default();
    body.insert("variantNumber".into(), variant.clone().into());
    let input: WishlistUpsertRequest = http::parse("WishlistUpsertRequest", &Value::Object(body))?;
    if db::rows(
        &state.db,
        "SELECT id FROM variants WHERE variant_number=$1",
        vec![variant.clone().into()],
    )
    .await?
    .is_empty()
    {
        return Err(AppError::not_found(&format!("Variant {variant} not found")));
    }
    db::execute(&state.db,"INSERT INTO wishlist_items(user_id,variant_number,priority,target_price_cents,notes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,variant_number) DO UPDATE SET priority=EXCLUDED.priority,target_price_cents=EXCLUDED.target_price_cents,notes=EXCLUDED.notes",vec![session.user.id.clone().into(),variant.clone().into(),input.priority.into(),input.target_price_cents.flatten().into(),input.notes.flatten().into()]).await?;
    let mut item = db::rows(
        &state.db,
        &format!("{WISHLIST_SELECT} WHERE i.user_id=$1 AND i.variant_number=$2"),
        vec![session.user.id.into(), variant.into()],
    )
    .await?
    .into_iter()
    .next()
    .ok_or_else(AppError::internal)?;
    crate::images::rewrite(&state, &mut item["imageUrl"]);
    http::respond("WishlistItemResponse", json!({"data":item}))
}
#[utoipa::path(delete,path="/api/v1/wishlist/{variantNumber}",operation_id="deleteWishlistItem",responses((status=200,body=OkResponse)))]
async fn delete_wishlist(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(variant): Path<String>,
) -> Result<Json<OkResponse>> {
    db::execute(
        &state.db,
        "DELETE FROM wishlist_items WHERE user_id=$1 AND variant_number=$2",
        vec![session.user.id.into(), variant.into()],
    )
    .await?;
    http::respond("OkResponse", json!({"data":{"ok":true}}))
}
fn device(value: &str) -> Result<()> {
    if !matches!(value, "phone" | "desktop") {
        return Err(AppError::new(
            422,
            "VALIDATION_ERROR",
            "device must be phone or desktop",
        ));
    }
    Ok(())
}
fn default_settings() -> Value {
    json!({"theme":"dark","defaultLayout":"list","gridCardSize":"large"})
}
fn stored_settings(value: Option<&Value>) -> Value {
    let Some(value) = value else {
        return default_settings();
    };
    if let Ok(Some(parsed)) = http::schemas::schema("UserSettingsPayload").parse(Some(value)) {
        return parsed;
    }
    if let Ok(Some(Value::Object(patch))) =
        http::schemas::schema("UserSettingsPatch").parse(Some(value))
    {
        let mut defaults = default_settings();
        if let Some(map) = defaults.as_object_mut() {
            map.extend(patch);
        }
        return defaults;
    }
    default_settings()
}
#[utoipa::path(get,path="/api/v1/settings/{device}",operation_id="getUserSettings",responses((status=200,body=UserSettingsResponse)))]
async fn settings(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(profile): Path<String>,
) -> Result<Json<UserSettingsResponse>> {
    device(&profile)?;
    let row=db::rows(&state.db,"SELECT settings,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"updatedAt\" FROM user_settings WHERE user_id=$1 AND device=$2",vec![session.user.id.into(),profile.clone().into()]).await?.into_iter().next();
    http::respond(
        "UserSettingsResponse",
        json!({"data":{"device":profile,"settings":stored_settings(row.as_ref().map(|r|&r["settings"])),"updatedAt":row.map(|r|r["updatedAt"].clone()).unwrap_or(Value::Null)}}),
    )
}
#[utoipa::path(put,path="/api/v1/settings/{device}",operation_id="setUserSettings",request_body=UserSettingsUpsertRequest,responses((status=200,body=UserSettingsResponse)))]
async fn set_settings(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(profile): Path<String>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<UserSettingsResponse>> {
    use sea_orm::TransactionTrait;
    device(&profile)?;
    let body = if body.is_null() {
        serde_json::json!({})
    } else {
        body
    };
    let patch: UserSettingsUpsertRequest = http::parse("UserSettingsUpsertRequest", &body)?;
    let tx = state.db.begin().await?;
    db::rows(
        &tx,
        "SELECT id FROM \"user\" WHERE id=$1 FOR UPDATE",
        vec![session.user.id.clone().into()],
    )
    .await?;
    let previous = db::rows(
        &tx,
        "SELECT settings FROM user_settings WHERE user_id=$1 AND device=$2",
        vec![session.user.id.clone().into(), profile.clone().into()],
    )
    .await?
    .into_iter()
    .next();
    let mut settings = stored_settings(previous.as_ref().map(|row| &row["settings"]));
    if let (Some(settings), Value::Object(patch)) =
        (settings.as_object_mut(), serde_json::to_value(patch)?)
    {
        settings.extend(patch);
    }
    let row=db::rows(&tx,"INSERT INTO user_settings(user_id,device,settings) VALUES($1,$2,$3) ON CONFLICT(user_id,device) DO UPDATE SET settings=EXCLUDED.settings,updated_at=now() RETURNING to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS \"updatedAt\"",vec![session.user.id.into(),profile.clone().into(),settings.clone().into()]).await?.into_iter().next().ok_or_else(AppError::internal)?;
    tx.commit().await?;
    http::respond(
        "UserSettingsResponse",
        json!({"data":{"device":profile,"settings":settings,"updatedAt":row["updatedAt"]}}),
    )
}
pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(wishlist))
        .routes(routes!(set_wishlist))
        .routes(routes!(delete_wishlist))
        .routes(routes!(settings))
        .routes(routes!(set_settings))
}
