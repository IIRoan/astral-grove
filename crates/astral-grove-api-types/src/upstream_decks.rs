#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckDetail {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "description")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub description: Option<Option<String>>,
    #[serde(rename = "authorName")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub author_name: Option<Option<String>>,
    #[serde(rename = "views")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub views: Option<i64>,
    #[serde(rename = "likes")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub likes: Option<i64>,
    #[serde(rename = "videoUrl")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub video_url: Option<Option<String>>,
    #[serde(rename = "hasGuide")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_guide: Option<bool>,
    #[serde(rename = "hasMatchups")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_matchups: Option<bool>,
    #[serde(rename = "isLegal")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_legal: Option<bool>,
    #[serde(rename = "bannedCardNames")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub banned_card_names: Option<Vec<String>>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "editedAt")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub edited_at: Option<Option<String>>,
    #[serde(rename = "updatedAt")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub updated_at: Option<Option<String>>,
    #[serde(rename = "legend")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub legend: Option<Option<UpstreamDeckDetailLegend>>,
    #[serde(rename = "champions")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub champions: Option<Option<Vec<UpstreamDeckDetailChampionsItem>>>,
    #[serde(rename = "maindeck")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub maindeck: Option<Option<Vec<UpstreamDeckDetailMaindeckItem>>>,
    #[serde(rename = "runes")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub runes: Option<Option<Vec<UpstreamDeckDetailRunesItem>>>,
    #[serde(rename = "battlefields")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub battlefields: Option<Option<Vec<UpstreamDeckDetailBattlefieldsItem>>>,
    #[serde(rename = "sideboard")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub sideboard: Option<Option<Vec<UpstreamDeckDetailSideboardItem>>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckDetailLegend {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "tags")]
    pub tags: Vec<String>,
    #[serde(rename = "colors")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub colors: Option<Option<serde_json::Value>>,
    #[serde(rename = "imageUrl")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub image_url: Option<Option<serde_json::Value>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckDetailChampionsItem {
    #[serde(rename = "cardId")]
    pub card_id: String,
    #[serde(rename = "variantId")]
    pub variant_id: String,
    #[serde(rename = "quantity")]
    pub quantity: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckDetailMaindeckItem {
    #[serde(rename = "cardId")]
    pub card_id: String,
    #[serde(rename = "variantId")]
    pub variant_id: String,
    #[serde(rename = "quantity")]
    pub quantity: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckDetailRunesItem {
    #[serde(rename = "cardId")]
    pub card_id: String,
    #[serde(rename = "variantId")]
    pub variant_id: String,
    #[serde(rename = "quantity")]
    pub quantity: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckDetailBattlefieldsItem {
    #[serde(rename = "cardId")]
    pub card_id: String,
    #[serde(rename = "variantId")]
    pub variant_id: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckDetailSideboardItem {
    #[serde(rename = "cardId")]
    pub card_id: String,
    #[serde(rename = "variantId")]
    pub variant_id: String,
    #[serde(rename = "quantity")]
    pub quantity: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckListResponse {
    #[serde(rename = "data")]
    pub data: Vec<UpstreamDeckListResponseDataItem>,
    #[serde(rename = "pagination")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pagination: Option<UpstreamDeckListResponsePagination>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckListResponseDataItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "description")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub description: Option<Option<String>>,
    #[serde(rename = "authorName")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub author_name: Option<Option<String>>,
    #[serde(rename = "views")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub views: Option<i64>,
    #[serde(rename = "likes")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub likes: Option<i64>,
    #[serde(rename = "isLegal")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_legal: Option<bool>,
    #[serde(rename = "videoUrl")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub video_url: Option<Option<String>>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "editedAt")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub edited_at: Option<Option<String>>,
    #[serde(rename = "updatedAt")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub updated_at: Option<Option<String>>,
    #[serde(rename = "legend")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub legend: Option<Option<UpstreamDeckListResponseDataItemLegend>>,
    #[serde(rename = "bannedCardNames")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub banned_card_names: Option<Vec<String>>,
    #[serde(rename = "sets")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sets: Option<Vec<UpstreamDeckListResponseDataItemSetsItem>>,
    #[serde(rename = "contentFlags")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_flags: Option<UpstreamDeckListResponseDataItemContentFlags>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckListResponseDataItemLegend {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "tags")]
    pub tags: Vec<String>,
    #[serde(rename = "colors")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub colors: Option<Option<serde_json::Value>>,
    #[serde(rename = "imageUrl")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub image_url: Option<Option<serde_json::Value>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckListResponseDataItemSetsItem {
    #[serde(rename = "prefix")]
    pub prefix: String,
    #[serde(rename = "name")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckListResponseDataItemContentFlags {
    #[serde(rename = "hasVideo")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_video: Option<bool>,
    #[serde(rename = "hasGuide")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_guide: Option<bool>,
    #[serde(rename = "hasMatchups")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_matchups: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpstreamDeckListResponsePagination {
    #[serde(rename = "page")]
    pub page: i64,
    #[serde(rename = "pageSize")]
    pub page_size: i64,
    #[serde(rename = "total")]
    pub total: i64,
    #[serde(rename = "totalPages")]
    pub total_pages: i64,
}

#[derive(utoipa::OpenApi)]
#[openapi(components(schemas(
    UpstreamDeckDetail,
    UpstreamDeckDetailLegend,
    UpstreamDeckDetailChampionsItem,
    UpstreamDeckDetailMaindeckItem,
    UpstreamDeckDetailRunesItem,
    UpstreamDeckDetailBattlefieldsItem,
    UpstreamDeckDetailSideboardItem,
    UpstreamDeckListResponse,
    UpstreamDeckListResponseDataItem,
    UpstreamDeckListResponseDataItemLegend,
    UpstreamDeckListResponseDataItemSetsItem,
    UpstreamDeckListResponseDataItemContentFlags,
    UpstreamDeckListResponsePagination
)))]
pub struct ContractSchemas;
