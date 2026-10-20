use super::{
    membership,
    service::{self, Mutation},
};
use crate::{AppState, auth::RouteUser, error::Result, http};
use astral_grove_api_types::collection::CollectionMutationResponse;
use astral_grove_api_types::{
    CollectionAdjustRequest, CollectionDeleteQuery, CollectionListResponse,
    CollectionQuantitiesResponse, CollectionUpsertRequest, CollectionVariantNumbersRequest,
};
use axum::{
    Json,
    extract::{Path, RawQuery, State},
};
use serde_json::Value;
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};

#[utoipa::path(get,path="/api/v1/collection",operation_id="listCollection",responses((status=200,body=CollectionListResponse)))]
async fn list(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<CollectionListResponse>> {
    let collection = membership::ensure(&state, &session.user.id).await?;
    http::respond(
        "CollectionListResponse",
        service::list(&state, &collection).await?,
    )
}
#[utoipa::path(put,path="/api/v1/collection/{variantNumber}",operation_id="setCollectionItem",request_body=CollectionUpsertRequest,responses((status=200,body=CollectionMutationResponse)))]
async fn set(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(variant): Path<String>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<CollectionMutationResponse>> {
    let mut body = body.as_object().cloned().unwrap_or_default();
    body.insert("variantNumber".into(), Value::String(variant.clone()));
    let input: CollectionUpsertRequest =
        http::parse("CollectionUpsertRequest", &Value::Object(body))?;
    let collection = membership::ensure(&state, &session.user.id).await?;
    let result = service::mutate(
        &state,
        &collection,
        &session.user.id,
        &variant,
        &serde_json::to_value(input)?,
        Mutation::Set,
        "upsert",
    )
    .await?;
    state.live.publish(&collection, "upsert", &session.user.id);
    mutation_response(result)
}
#[utoipa::path(post,path="/api/v1/collection/{variantNumber}/add",operation_id="addCollectionItem",request_body=CollectionAdjustRequest,responses((status=200,body=CollectionMutationResponse)))]
async fn add(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(variant): Path<String>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<CollectionMutationResponse>> {
    adjust(&state, &session.user.id, &variant, body, 1).await
}
#[utoipa::path(post,path="/api/v1/collection/{variantNumber}/remove",operation_id="removeCollectionItem",request_body=CollectionAdjustRequest,responses((status=200,body=CollectionMutationResponse)))]
async fn remove(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(variant): Path<String>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<CollectionMutationResponse>> {
    adjust(&state, &session.user.id, &variant, body, -1).await
}
async fn adjust(
    state: &AppState,
    user: &str,
    variant: &str,
    body: Value,
    sign: i64,
) -> Result<Json<CollectionMutationResponse>> {
    let body = if body.is_null() {
        serde_json::json!({})
    } else {
        body
    };
    let input: CollectionAdjustRequest = http::parse("CollectionAdjustRequest", &body)?;
    let collection = membership::ensure(state, user).await?;
    let delta = input.delta;
    let reason = if sign > 0 { "add" } else { "remove" };
    let result = service::mutate(
        state,
        &collection,
        user,
        variant,
        &serde_json::to_value(input)?,
        Mutation::Adjust(
            sign.checked_mul(delta)
                .ok_or_else(crate::error::AppError::internal)?,
        ),
        reason,
    )
    .await?;
    state.live.publish(&collection, reason, user);
    mutation_response(result)
}
#[utoipa::path(delete,path="/api/v1/collection/{variantNumber}",operation_id="deleteCollectionItem",responses((status=200,body=astral_grove_api_types::OkResponse)))]
async fn delete(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(variant): Path<String>,
    RawQuery(query): RawQuery,
) -> Result<Json<Value>> {
    let input: CollectionDeleteQuery =
        http::parse("CollectionDeleteQuery", &http::query(query.as_deref()))?;
    let collection = membership::ensure(&state, &session.user.id).await?;
    service::mutate(
        &state,
        &collection,
        &session.user.id,
        &variant,
        &serde_json::to_value(input)?,
        Mutation::Delete,
        "delete",
    )
    .await?;
    state.live.publish(&collection, "delete", &session.user.id);
    Ok(Json(serde_json::json!({"data":{"ok":true}})))
}
#[utoipa::path(post,path="/api/v1/collection/quantities",operation_id="collectionQuantities",request_body=CollectionVariantNumbersRequest,responses((status=200,body=CollectionQuantitiesResponse)))]
async fn quantities(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<CollectionQuantitiesResponse>> {
    let input: CollectionVariantNumbersRequest =
        http::parse("CollectionVariantNumbersRequest", &body)?;
    let collection = membership::ensure(&state, &session.user.id).await?;
    http::respond(
        "CollectionQuantitiesResponse",
        service::quantities(&state, &collection, input.variant_numbers).await?,
    )
}
pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(list))
        .routes(routes!(set))
        .routes(routes!(add))
        .routes(routes!(remove))
        .routes(routes!(delete))
        .routes(routes!(quantities))
        .routes(routes!(audit))
        .routes(routes!(audit_me))
        .routes(routes!(recent))
        .routes(routes!(history))
        .routes(routes!(batch))
        .routes(routes!(export))
        .routes(routes!(preview))
        .routes(routes!(import))
        .routes(routes!(events))
}

#[utoipa::path(get,path="/api/v1/collection/audit",operation_id="listCollectionAudit",responses((status=200,body=astral_grove_api_types::CollectionAuditListResponse)))]
async fn audit(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    RawQuery(query): RawQuery,
) -> Result<Json<astral_grove_api_types::CollectionAuditListResponse>> {
    let collection = membership::ensure(&state, &session.user.id).await?;
    let input = http::value("CollectionAuditListQuery", &http::query(query.as_deref()))?;
    http::respond(
        "CollectionAuditListResponse",
        super::audit::list(&state, Some(&collection), &session.user.id, &input).await?,
    )
}
#[utoipa::path(get,path="/api/v1/collection/audit/me",operation_id="listPersonalCollectionAudit",responses((status=200,body=astral_grove_api_types::CollectionAuditListResponse)))]
async fn audit_me(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    RawQuery(query): RawQuery,
) -> Result<Json<astral_grove_api_types::CollectionAuditListResponse>> {
    let input = http::value("CollectionAuditListQuery", &http::query(query.as_deref()))?;
    http::respond(
        "CollectionAuditListResponse",
        super::audit::list(&state, None, &session.user.id, &input).await?,
    )
}
#[utoipa::path(post,path="/api/v1/collection/recent-adds",operation_id="recentCollectionActivity",request_body=CollectionVariantNumbersRequest,responses((status=200,body=astral_grove_api_types::CollectionRecentAddsResponse)))]
async fn recent(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<astral_grove_api_types::CollectionRecentAddsResponse>> {
    let mut input = http::value("CollectionVariantNumbersRequest", &body)?;
    input["limit"] = serde_json::json!(3);
    let collection = membership::ensure(&state, &session.user.id).await?;
    let result = super::audit::activity(&state, &collection, &input).await?;
    http::respond(
        "CollectionRecentAddsResponse",
        serde_json::json!({"data":result["data"]}),
    )
}
#[utoipa::path(post,path="/api/v1/collection/activity-history",operation_id="collectionActivityHistory",request_body=astral_grove_api_types::CollectionActivityHistoryRequest,responses((status=200,body=astral_grove_api_types::CollectionActivityHistoryResponse)))]
async fn history(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<astral_grove_api_types::CollectionActivityHistoryResponse>> {
    let input = http::value("CollectionActivityHistoryRequest", &body)?;
    let collection = membership::ensure(&state, &session.user.id).await?;
    http::respond(
        "CollectionActivityHistoryResponse",
        super::audit::activity(&state, &collection, &input).await?,
    )
}
#[utoipa::path(post,path="/api/v1/collection/batch",operation_id="syncCollectionBatch",request_body=astral_grove_api_types::CollectionBatchSyncRequest,responses((status=200,body=astral_grove_api_types::CollectionBatchSyncResponse)))]
async fn batch(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<astral_grove_api_types::CollectionBatchSyncResponse>> {
    let input = http::value("CollectionBatchSyncRequest", &body)?;
    let collection = membership::ensure(&state, &session.user.id).await?;
    let items = crate::db::array(&input, "items");
    let result = async {
        for item in items {
            service::mutate(
                &state,
                &collection,
                &session.user.id,
                crate::db::string(item, "variantNumber"),
                item,
                Mutation::Set,
                "batch",
            )
            .await?;
        }
        Ok::<_, crate::error::AppError>(())
    }
    .await;
    // Items commit one by one, so a failure part-way still leaves changes other devices must load.
    state.live.publish(&collection, "batch", &session.user.id);
    result?;
    http::respond(
        "CollectionBatchSyncResponse",
        serde_json::json!({"data":{"synced":items.len()}}),
    )
}
#[utoipa::path(get,path="/api/v1/collection/export",operation_id="exportCollection",responses((status=200,body=String,content_type="text/csv")))]
async fn export(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
) -> Result<([(&'static str, &'static str); 2], String)> {
    let collection = membership::ensure(&state, &session.user.id).await?;
    Ok((
        [
            ("content-type", "text/csv; charset=utf-8"),
            (
                "content-disposition",
                "attachment; filename=\"piltover-collection-export.csv\"",
            ),
        ],
        super::imports::export(&state, &collection).await?,
    ))
}
#[utoipa::path(post,path="/api/v1/collection/import/preview",operation_id="previewCollectionImport",request_body=astral_grove_api_types::CollectionImportPreviewRequest,responses((status=200,body=astral_grove_api_types::CollectionImportPreviewResponse)))]
async fn preview(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<astral_grove_api_types::CollectionImportPreviewResponse>> {
    let input = http::value("CollectionImportPreviewRequest", &body)?;
    let collection = membership::ensure(&state, &session.user.id).await?;
    http::respond(
        "CollectionImportPreviewResponse",
        super::imports::preview(&state, &collection, &input).await?,
    )
}
#[utoipa::path(post,path="/api/v1/collection/import",operation_id="importCollection",request_body=astral_grove_api_types::CollectionImportRequest,responses((status=200,body=astral_grove_api_types::CollectionImportResponse)))]
async fn import(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<astral_grove_api_types::CollectionImportResponse>> {
    let input = http::value("CollectionImportRequest", &body)?;
    let collection = membership::ensure(&state, &session.user.id).await?;
    let result = super::imports::import(&state, &collection, &session.user.id, &input).await;
    // Rows commit one by one, so a failure part-way still leaves changes other devices must load.
    state.live.publish(&collection, "import", &session.user.id);
    http::respond("CollectionImportResponse", result?)
}
#[utoipa::path(get,path="/api/v1/collection/events",operation_id="collectionEvents",responses((status=200,content_type="text/event-stream")))]
async fn events(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
) -> Result<impl axum::response::IntoResponse> {
    let collection = membership::ensure(&state, &session.user.id).await?;
    let subscription = state.live.subscribe(&collection)?;
    Ok((
        [("x-accel-buffering", "no"), ("cache-control", "no-cache")],
        axum::response::Sse::new(super::live::authenticated_stream(
            subscription,
            state.shutdown.subscribe(),
            state.clone(),
            session.user.id,
            session.session.id,
        )),
    ))
}

fn mutation_response(mut value: Value) -> Result<Json<CollectionMutationResponse>> {
    // The mutation is already committed, so an unparseable item degrades to data:null instead of an error.
    if !value["data"].is_null() {
        value["data"] = http::value("CollectionItem", &value["data"]).unwrap_or_else(|_| {
            tracing::warn!(
                category = "collection",
                "Mutated item failed response schema"
            );
            Value::Null
        });
    }
    http::output(value)
}
