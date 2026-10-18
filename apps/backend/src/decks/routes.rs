use super::service::{self, VersionAction};
use crate::{AppState, auth::RouteUser, error::Result, http};
use astral_grove_api_types::{
    CreateDeckVersionRequest, DeckDetailResponse, DeckListResponse, DeckUpsertRequest, IdResponse,
    RenameDeckVersionRequest,
};
use axum::{
    Json,
    extract::{Path, RawQuery, State},
};
use serde_json::{Value, json};
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};
fn deck_input(id: &str, body: Value) -> Result<Value> {
    let mut fields = body.as_object().cloned().unwrap_or_default();
    fields.insert("id".into(), json!(id));
    http::value("DeckUpsertRequest", &Value::Object(fields))
}
#[utoipa::path(get,path="/api/v1/decks",operation_id="listDecks",responses((status=200,body=DeckListResponse)))]
async fn list(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    RawQuery(query): RawQuery,
) -> Result<Json<DeckListResponse>> {
    let input = http::value("DecksListQuery", &http::query(query.as_deref()))?;
    http::respond(
        "DeckListResponse",
        service::list(&state, &session.user.id, &input).await?,
    )
}
#[utoipa::path(get,path="/api/v1/decks/{id}",operation_id="getDeck",responses((status=200,body=DeckDetailResponse)))]
async fn get(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<DeckDetailResponse>> {
    http::respond(
        "DeckDetailResponse",
        json!({"data":service::get(&state,&session.user.id,&id).await?}),
    )
}
#[utoipa::path(put,path="/api/v1/decks/{id}",operation_id="saveDeck",request_body=DeckUpsertRequest,responses((status=200,body=DeckDetailResponse)))]
async fn put(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<DeckDetailResponse>> {
    let input = deck_input(&id, body)?;
    http::respond(
        "DeckDetailResponse",
        json!({"data":service::upsert(&state,&session.user.id,input,false,false,None).await?}),
    )
}
#[utoipa::path(delete,path="/api/v1/decks/{id}",operation_id="deleteDeck",responses((status=200,body=IdResponse)))]
async fn delete(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<IdResponse>> {
    http::respond(
        "IdResponse",
        service::delete(&state, &session.user.id, &id).await?,
    )
}
#[utoipa::path(post,path="/api/v1/decks/{id}/import",operation_id="importDeck",responses((status=200,body=DeckDetailResponse)))]
async fn import(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<DeckDetailResponse>> {
    http::respond(
        "DeckDetailResponse",
        json!({"data":service::import(&state,&session.user.id,&id).await?}),
    )
}
#[utoipa::path(post,path="/api/v1/decks/{id}/versions",operation_id="createDeckVersion",request_body=CreateDeckVersionRequest,responses((status=200,body=DeckDetailResponse)))]
async fn create_version(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<DeckDetailResponse>> {
    let input: CreateDeckVersionRequest = http::parse("CreateDeckVersionRequest", &body)?;
    http::respond(
        "DeckDetailResponse",
        json!({"data":service::version(&state,&session.user.id,&id,VersionAction::Create(input.name)).await?}),
    )
}
#[utoipa::path(put,path="/api/v1/decks/{id}/versions/{versionId}",operation_id="saveDeckVersion",request_body=DeckUpsertRequest,responses((status=200,body=DeckDetailResponse)))]
async fn save_version(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path((id, version)): Path<(String, String)>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<DeckDetailResponse>> {
    let input = deck_input(&id, body)?;
    http::respond(
        "DeckDetailResponse",
        json!({"data":service::version(&state,&session.user.id,&id,VersionAction::Save(version,input)).await?}),
    )
}
#[utoipa::path(patch,path="/api/v1/decks/{id}/versions/{versionId}",operation_id="renameDeckVersion",request_body=RenameDeckVersionRequest,responses((status=200,body=DeckDetailResponse)))]
async fn rename_version(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path((id, version)): Path<(String, String)>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<DeckDetailResponse>> {
    let input: RenameDeckVersionRequest = http::parse("RenameDeckVersionRequest", &body)?;
    http::respond(
        "DeckDetailResponse",
        json!({"data":service::version(&state,&session.user.id,&id,VersionAction::Rename(version,input.name)).await?}),
    )
}
#[utoipa::path(post,path="/api/v1/decks/{id}/versions/{versionId}/activate",operation_id="activateDeckVersion",responses((status=200,body=DeckDetailResponse)))]
async fn activate_version(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path((id, version)): Path<(String, String)>,
) -> Result<Json<DeckDetailResponse>> {
    http::respond(
        "DeckDetailResponse",
        json!({"data":service::version(&state,&session.user.id,&id,VersionAction::Activate(version)).await?}),
    )
}
#[utoipa::path(delete,path="/api/v1/decks/{id}/versions/{versionId}",operation_id="deleteDeckVersion",responses((status=200,body=DeckDetailResponse)))]
async fn delete_version(
    RouteUser(session): RouteUser,
    State(state): State<Arc<AppState>>,
    Path((id, version)): Path<(String, String)>,
) -> Result<Json<DeckDetailResponse>> {
    http::respond(
        "DeckDetailResponse",
        json!({"data":service::version(&state,&session.user.id,&id,VersionAction::Delete(version)).await?}),
    )
}
pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(list))
        .routes(routes!(get))
        .routes(routes!(put))
        .routes(routes!(delete))
        .routes(routes!(import))
        .routes(routes!(create_version))
        .routes(routes!(save_version))
        .routes(routes!(rename_version))
        .routes(routes!(activate_version))
        .routes(routes!(delete_version))
}
