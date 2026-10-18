use crate::{AppState, error::Result, http};
use astral_grove_api_types::{
    DeckRulesResponse, DeckValidateInput, DeckValidateResponse, deck_validation,
};
use axum::Json;
use serde_json::json;
use utoipa_axum::{router::OpenApiRouter, routes};
#[utoipa::path(get,path="/api/v1/deck-rules",operation_id="getDeckRules",responses((status=200,body=DeckRulesResponse)))]
async fn rules() -> Result<Json<DeckRulesResponse>> {
    http::respond(
        "DeckRulesResponse",
        json!({"data":{"version":"2026.1","rules":deck_validation::rules("constructed")}}),
    )
}
#[utoipa::path(post,path="/api/v1/deck-rules/validate",operation_id="validateDeck",request_body=DeckValidateInput,responses((status=200,body=DeckValidateResponse)))]
async fn validate(
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<DeckValidateResponse>> {
    let input: DeckValidateInput = http::parse("DeckValidateInput", &body)?;
    let messages = deck_validation::validate(&serde_json::to_value(input)?);
    http::respond(
        "DeckValidateResponse",
        json!({"data":{"valid":messages.iter().any(|message|message["type"]=="valid"),"hasErrors":messages.iter().any(|message|message["type"]=="error"),"messages":messages}}),
    )
}
pub fn router() -> OpenApiRouter<std::sync::Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(rules))
        .routes(routes!(validate))
}
