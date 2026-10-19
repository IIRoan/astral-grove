use super::{query, store};
use crate::{AppState, error::Result, http, upstream};
use astral_grove_api_types::{
    CardDetailResponse, CardsBatchRequest, CardsBatchResponse, CardsListResponse,
    CatalogIndexResponse, GlobalSearchResponse,
};
use axum::{
    Json,
    extract::{Path, RawQuery, State},
    http::HeaderMap,
};
use serde_json::{Value, json};
use std::sync::Arc;
use utoipa_axum::{router::OpenApiRouter, routes};
#[utoipa::path(get,path="/api/v1/cards",operation_id="listCards",responses((status=200,body=CardsListResponse)))]
async fn list(
    State(state): State<Arc<AppState>>,
    RawQuery(raw): RawQuery,
    headers: HeaderMap,
) -> Result<(HeaderMap, Json<CardsListResponse>)> {
    let mut input = http::value("CardsListQuery", &http::query(raw.as_deref()))?;
    let refresh = input["refresh"] == true && crate::middleware::admin(&state, &headers);
    input["refresh"] = json!(refresh);
    let result = query::search(&state, &input).await?;
    let total = result["total"].as_i64().unwrap_or(0);
    let page = input["page"].as_i64().unwrap_or(1);
    let limit = input["limit"].as_i64().unwrap_or(50);
    let pages = ((total + limit - 1) / limit).max(1);
    let mut headers = HeaderMap::new();
    if !refresh {
        headers.insert(
            "cache-control",
            axum::http::HeaderValue::from_static("public, max-age=300, stale-while-revalidate=60"),
        );
    }
    Ok((
        headers,
        http::respond(
            "CardsListResponse",
            json!({"data":result["items"],"meta":{"source":result["source"],"catalogHash":result["catalogHash"],"pagination":{"total":total,"page":page,"limit":limit,"totalPages":pages,"hasNext":page<pages,"hasPrevious":page>1}}}),
        )?,
    ))
}
#[utoipa::path(get,path="/api/v1/cards/index",operation_id="getCatalogIndex",responses((status=200,body=CatalogIndexResponse)))]
async fn index(
    State(state): State<Arc<AppState>>,
) -> Result<([(&'static str, &'static str); 2], axum::body::Bytes)> {
    Ok((
        [
            (
                "cache-control",
                "public, max-age=300, stale-while-revalidate=60",
            ),
            ("content-type", "application/json"),
        ],
        query::index_response(&state).await?,
    ))
}
#[utoipa::path(get,path="/api/v1/cards/{variantNumber}",operation_id="getCard",responses((status=200,body=CardDetailResponse)))]
async fn detail(
    State(state): State<Arc<AppState>>,
    Path(number): Path<String>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Result<Json<CardDetailResponse>> {
    http::value("VariantNumber", &json!(number))?;
    let input = http::value("CardsDetailQuery", &http::query(query.as_deref()))?;
    http::respond(
        "CardDetailResponse",
        store::detail(
            &state,
            &number,
            input["refresh"] == true && crate::middleware::admin(&state, &headers),
        )
        .await?,
    )
}
#[utoipa::path(post,path="/api/v1/cards/batch",operation_id="batchCards",request_body=CardsBatchRequest,responses((status=200,body=CardsBatchResponse)))]
async fn batch(
    State(state): State<Arc<AppState>>,
    crate::http::BodyJson(body): crate::http::BodyJson,
) -> Result<Json<CardsBatchResponse>> {
    let input: CardsBatchRequest = http::parse("CardsBatchRequest", &body)?;
    let mut found = Vec::new();
    let mut missing = Vec::new();
    for number in &input.variant_numbers {
        if let Some((card, _)) = store::logical(&state, number).await? {
            found.push(store::detail_value(&state, &card).await?);
        } else {
            missing.push(number.clone());
        }
    }
    let mut not_found = Vec::new();
    let mut source = "cache";
    if !missing.is_empty() {
        let result = upstream::request(
            &state,
            reqwest::Method::POST,
            "/v1/cards/batch",
            &Value::Null,
            Some(&json!({"variantNumbers":missing})),
            Some("PaCardsBatchResponse"),
            false,
        )
        .await?;
        for item in crate::db::array(&result, "data") {
            let card = upstream::card(&state, crate::db::string(item, "variantNumber")).await?;
            store::upsert(&state, &card).await?;
            found.push(store::detail_value(&state, &card).await?);
        }
        not_found = result["notFound"].as_array().cloned().unwrap_or_default();
        source = if found.len() == input.variant_numbers.len() {
            "upstream"
        } else {
            "mixed"
        };
    }
    http::respond(
        "CardsBatchResponse",
        json!({"meta":{"found":found.len(),"notFound":not_found,"source":source},"data":found}),
    )
}
#[utoipa::path(get,path="/api/v1/search",operation_id="globalSearch",responses((status=200,body=GlobalSearchResponse)))]
async fn search(
    State(state): State<Arc<AppState>>,
    RawQuery(raw): RawQuery,
) -> Result<(
    [(&'static str, &'static str); 1],
    Json<GlobalSearchResponse>,
)> {
    let start = std::time::Instant::now();
    let input = http::value("GlobalSearchQuery", &http::query(raw.as_deref()))?;
    let types = input["types"]
        .as_str()
        .unwrap_or("cards")
        .split(',')
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    let mut data = json!({});
    if types.is_empty() || types.iter().any(|value| value == "cards") {
        let query = http::value(
            "CardsListQuery",
            &json!({"q":input["q"],"page":input["page"],"limit":input["limit"],"sortBy":"name","dir":"asc","colorMode":"all"}),
        )?;
        let result = query::search(&state, &query).await?;
        let hits:Vec<_>=crate::db::array(&result, "items").iter().map(|item|json!({"kind":"card","variantNumber":item["variantNumber"],"name":item["name"],"imageUrl":item["imageUrl"],"setCode":item["setCode"],"type":item["type"],"rarity":item["rarity"]})).collect();
        data["cards"] = json!({"hits":hits,"total":result["total"]});
    }
    if types.iter().any(|value| value == "decks") {
        data["decks"] = json!({"hits":[],"total":0});
    }
    Ok((
        [(
            "cache-control",
            "public, max-age=60, stale-while-revalidate=30",
        )],
        http::respond(
            "GlobalSearchResponse",
            json!({"data":data,"meta":{"tookMs":(start.elapsed().as_secs_f64()*1000.0).round() as u64,"catalogHash":store::hashes(&state).await?.0}}),
        )?,
    ))
}
pub fn router() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(list))
        .routes(routes!(index))
        .routes(routes!(detail))
        .routes(routes!(batch))
        .routes(routes!(search))
}
