//! Wire DTOs initialized from the pinned API baseline; evolve Rust DTOs and regenerate OpenAPI together.

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CardCondition {
    #[serde(rename = "mint")]
    Mint,
    #[serde(rename = "near_mint")]
    NearMint,
    #[serde(rename = "lightly_played")]
    LightlyPlayed,
    #[serde(rename = "moderately_played")]
    ModeratelyPlayed,
    #[serde(rename = "heavily_played")]
    HeavilyPlayed,
    #[serde(rename = "damaged")]
    Damaged,
    #[serde(rename = "unspecified")]
    Unspecified,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardDetail {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "super")]
    #[schema(required = true, nullable = true)]
    pub super_: Option<String>,
    #[serde(rename = "description")]
    pub description: String,
    #[serde(rename = "energy")]
    pub energy: i64,
    #[serde(rename = "might")]
    pub might: i64,
    #[serde(rename = "power")]
    pub power: i64,
    #[serde(rename = "tags")]
    pub tags: Vec<String>,
    #[serde(rename = "colors")]
    pub colors: Vec<ColorRef>,
    #[serde(rename = "variants")]
    pub variants: Vec<VariantDetail>,
    #[serde(rename = "banEffectiveDate")]
    #[schema(required = true, nullable = true)]
    pub ban_effective_date: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardDetailResponse {
    #[serde(rename = "data")]
    pub data: CardDetail,
    #[serde(rename = "meta")]
    pub meta: CardDetailResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardDetailResponseMeta {
    #[serde(rename = "source")]
    pub source: CardDetailResponseMetaSource,
    #[serde(rename = "contentHash")]
    pub content_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CardDetailResponseMetaSource {
    #[serde(rename = "cache")]
    Cache,
    #[serde(rename = "upstream")]
    Upstream,
    #[serde(rename = "cache-refreshed")]
    CacheRefreshed,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardListItem {
    #[serde(rename = "cardId")]
    pub card_id: String,
    #[serde(rename = "variantNumber")]
    pub variant_number: VariantNumber,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "super")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub super_: Option<Option<String>>,
    #[serde(rename = "variantType")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_type: Option<String>,
    #[serde(rename = "energy")]
    pub energy: i64,
    #[serde(rename = "might")]
    pub might: i64,
    #[serde(rename = "power")]
    pub power: i64,
    #[serde(rename = "rarity")]
    pub rarity: String,
    #[serde(rename = "setCode")]
    pub set_code: String,
    #[serde(rename = "colors")]
    pub colors: Vec<String>,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    #[serde(rename = "cardmarketId")]
    #[schema(required = true, nullable = true)]
    pub cardmarket_id: Option<i64>,
    #[serde(rename = "priceEur")]
    #[schema(required = true, nullable = true)]
    pub price_eur: Option<PriceSummary>,
    #[serde(rename = "printings")]
    pub printings: Vec<CardListPrinting>,
    #[serde(rename = "isBanned")]
    pub is_banned: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardListPrinting {
    #[serde(rename = "variantNumber")]
    pub variant_number: VariantNumber,
    #[serde(rename = "variantLabel")]
    pub variant_label: String,
    #[serde(rename = "isFoil")]
    pub is_foil: bool,
    #[serde(rename = "foilMode")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub foil_mode: Option<String>,
    #[serde(rename = "priceEur")]
    #[schema(required = true, nullable = true)]
    pub price_eur: Option<PriceSummary>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardsBatchRequest {
    #[serde(rename = "variantNumbers")]
    pub variant_numbers: Vec<VariantNumber>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardsBatchResponse {
    #[serde(rename = "data")]
    pub data: Vec<CardDetail>,
    #[serde(rename = "meta")]
    pub meta: CardsBatchResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardsBatchResponseMeta {
    #[serde(rename = "found")]
    pub found: i64,
    #[serde(rename = "notFound")]
    pub not_found: Vec<String>,
    #[serde(rename = "source")]
    pub source: CardsBatchResponseMetaSource,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CardsBatchResponseMetaSource {
    #[serde(rename = "cache")]
    Cache,
    #[serde(rename = "mixed")]
    Mixed,
    #[serde(rename = "upstream")]
    Upstream,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardsDetailQuery {
    #[serde(rename = "refresh")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh: Option<QueryBooleanString>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardsListQuery {
    #[serde(rename = "q")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub q: Option<String>,
    #[serde(rename = "sets")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sets: Option<String>,
    #[serde(rename = "colors")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub colors: Option<String>,
    #[serde(rename = "colorMode")]
    pub color_mode: CardsListQueryColorMode,
    #[serde(rename = "types")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub types: Option<String>,
    #[serde(rename = "super")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub super_: Option<String>,
    #[serde(rename = "variants")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variants: Option<String>,
    #[serde(rename = "rarities")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rarities: Option<String>,
    #[serde(rename = "energyMin")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub energy_min: Option<Option<i64>>,
    #[serde(rename = "energyMax")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub energy_max: Option<Option<i64>>,
    #[serde(rename = "powerMin")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub power_min: Option<Option<i64>>,
    #[serde(rename = "powerMax")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub power_max: Option<Option<i64>>,
    #[serde(rename = "mightMin")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub might_min: Option<Option<i64>>,
    #[serde(rename = "mightMax")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub might_max: Option<Option<i64>>,
    #[serde(rename = "page")]
    pub page: i64,
    #[serde(rename = "limit")]
    pub limit: i64,
    #[serde(rename = "sortBy")]
    pub sort_by: CardsListQuerySortBy,
    #[serde(rename = "dir")]
    pub dir: CardsListQueryDir,
    #[serde(rename = "refresh")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh: Option<QueryBooleanString>,
    #[serde(rename = "excludeTokens")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exclude_tokens: Option<QueryBooleanString>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CardsListQueryColorMode {
    #[serde(rename = "all")]
    All,
    #[serde(rename = "within")]
    Within,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CardsListQuerySortBy {
    #[serde(rename = "name")]
    Name,
    #[serde(rename = "energy")]
    Energy,
    #[serde(rename = "variantNumber")]
    VariantNumber,
    #[serde(rename = "releaseDate")]
    ReleaseDate,
    #[serde(rename = "price")]
    Price,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CardsListQueryDir {
    #[serde(rename = "asc")]
    Asc,
    #[serde(rename = "desc")]
    Desc,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardsListResponse {
    #[serde(rename = "data")]
    pub data: Vec<CardListItem>,
    #[serde(rename = "meta")]
    pub meta: CardsListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardsListResponseMeta {
    #[serde(rename = "pagination")]
    pub pagination: Pagination,
    #[serde(rename = "source")]
    pub source: CardsListResponseMetaSource,
    #[serde(rename = "catalogHash")]
    pub catalog_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CardsListResponseMetaSource {
    #[serde(rename = "cache")]
    Cache,
    #[serde(rename = "mixed")]
    Mixed,
    #[serde(rename = "upstream")]
    Upstream,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CatalogIndexResponse {
    #[serde(rename = "data")]
    pub data: Vec<CardListItem>,
    #[serde(rename = "meta")]
    pub meta: CatalogIndexResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CatalogIndexResponseMeta {
    #[serde(rename = "catalogHash")]
    pub catalog_hash: String,
    #[serde(rename = "pricesCatalogHash")]
    pub prices_catalog_hash: String,
    #[serde(rename = "total")]
    pub total: i64,
    #[serde(rename = "source")]
    pub source: CatalogIndexResponseMetaSource,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CatalogIndexResponseMetaSource {
    #[serde(rename = "cache")]
    Cache,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CatalogLayout {
    #[serde(rename = "grid")]
    Grid,
    #[serde(rename = "list")]
    List,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionActivityCursor {
    #[serde(rename = "at")]
    pub at: String,
    #[serde(rename = "id")]
    pub id: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionActivityEvent {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "at")]
    pub at: String,
    #[serde(rename = "action")]
    pub action: CollectionAuditAction,
    #[serde(rename = "quantityDelta")]
    pub quantity_delta: i64,
    #[serde(rename = "quantityAfter")]
    #[schema(required = true, nullable = true)]
    pub quantity_after: Option<i64>,
    #[serde(rename = "isFoil")]
    #[schema(required = true, nullable = true)]
    pub is_foil: Option<bool>,
    #[serde(rename = "actor")]
    pub actor: CollectionAuditActor,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionActivityHistoryRequest {
    #[serde(rename = "variantNumbers")]
    pub variant_numbers: Vec<String>,
    #[serde(rename = "limit")]
    pub limit: i64,
    #[serde(rename = "cursor")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<CollectionActivityCursor>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionActivityHistoryResponse {
    #[serde(rename = "data")]
    pub data: Vec<CollectionActivityEvent>,
    #[serde(rename = "meta")]
    pub meta: CollectionActivityHistoryResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionActivityHistoryResponseMeta {
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    #[serde(rename = "nextCursor")]
    #[schema(required = true, nullable = true)]
    pub next_cursor: Option<CollectionActivityCursor>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionAdjustRequest {
    #[serde(rename = "delta")]
    pub delta: i64,
    #[serde(rename = "condition")]
    pub condition: CardCondition,
    #[serde(rename = "language")]
    pub language: String,
    #[serde(rename = "isFoil")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CollectionAuditAction {
    #[serde(rename = "add")]
    Add,
    #[serde(rename = "remove")]
    Remove,
    #[serde(rename = "upsert")]
    Upsert,
    #[serde(rename = "delete")]
    Delete,
    #[serde(rename = "clear")]
    Clear,
    #[serde(rename = "batch")]
    Batch,
    #[serde(rename = "import")]
    Import,
    #[serde(rename = "share_merge")]
    ShareMerge,
    #[serde(rename = "share_discard")]
    ShareDiscard,
    #[serde(rename = "share_leave")]
    ShareLeave,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionAuditActor {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "name")]
    #[schema(required = true, nullable = true)]
    pub name: Option<String>,
    #[serde(rename = "email")]
    #[schema(required = true, nullable = true)]
    pub email: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionAuditEvent {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "collectionId")]
    #[schema(required = true, nullable = true)]
    pub collection_id: Option<String>,
    #[serde(rename = "action")]
    pub action: CollectionAuditAction,
    #[serde(rename = "variantNumber")]
    #[schema(required = true, nullable = true)]
    pub variant_number: Option<String>,
    #[serde(rename = "condition")]
    #[schema(required = true, nullable = true)]
    pub condition: Option<CardCondition>,
    #[serde(rename = "language")]
    #[schema(required = true, nullable = true)]
    pub language: Option<String>,
    #[serde(rename = "isFoil")]
    #[schema(required = true, nullable = true)]
    pub is_foil: Option<bool>,
    #[serde(rename = "quantityBefore")]
    #[schema(required = true, nullable = true)]
    pub quantity_before: Option<i64>,
    #[serde(rename = "quantityAfter")]
    #[schema(required = true, nullable = true)]
    pub quantity_after: Option<i64>,
    #[serde(rename = "quantityDelta")]
    #[schema(required = true, nullable = true)]
    pub quantity_delta: Option<i64>,
    #[serde(rename = "metadata")]
    #[schema(required = true, nullable = true)]
    pub metadata: Option<std::collections::BTreeMap<String, serde_json::Value>>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "actor")]
    pub actor: CollectionAuditActor,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionAuditListQuery {
    #[serde(rename = "limit")]
    pub limit: i64,
    #[serde(rename = "before")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<String>,
    #[serde(rename = "variantNumber")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_number: Option<String>,
    #[serde(rename = "actorUserId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    #[serde(rename = "mine")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mine: Option<bool>,
    #[serde(rename = "action")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<CollectionAuditAction>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionAuditListResponse {
    #[serde(rename = "data")]
    pub data: Vec<CollectionAuditEvent>,
    #[serde(rename = "meta")]
    pub meta: CollectionAuditListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionAuditListResponseMeta {
    #[serde(rename = "total")]
    pub total: i64,
    #[serde(rename = "limit")]
    pub limit: i64,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionBatchSyncRequest {
    #[serde(rename = "items")]
    pub items: Vec<CollectionUpsertRequest>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionBatchSyncResponse {
    #[serde(rename = "data")]
    pub data: CollectionBatchSyncResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionBatchSyncResponseData {
    #[serde(rename = "synced")]
    pub synced: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionDeleteQuery {
    #[serde(rename = "condition")]
    pub condition: CardCondition,
    #[serde(rename = "language")]
    pub language: String,
    #[serde(rename = "isFoil")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<QueryBooleanString>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CollectionImportMode {
    #[serde(rename = "set")]
    Set,
    #[serde(rename = "add")]
    Add,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportPreviewChange {
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "name")]
    #[schema(required = true, nullable = true)]
    pub name: Option<String>,
    #[serde(rename = "setCode")]
    #[schema(required = true, nullable = true)]
    pub set_code: Option<String>,
    #[serde(rename = "imageUrl")]
    #[schema(required = true, nullable = true)]
    pub image_url: Option<String>,
    #[serde(rename = "quantityBefore")]
    pub quantity_before: i64,
    #[serde(rename = "quantityAfter")]
    pub quantity_after: i64,
    #[serde(rename = "quantityDelta")]
    pub quantity_delta: i64,
    #[serde(rename = "status")]
    pub status: CollectionImportPreviewStatus,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportPreviewItem {
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "quantity")]
    pub quantity: i64,
    #[serde(rename = "condition")]
    pub condition: CardCondition,
    #[serde(rename = "language")]
    pub language: String,
    #[serde(rename = "isFoil")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportPreviewRequestVariant0 {
    #[serde(rename = "tts")]
    pub tts: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportPreviewRequestVariant1 {
    #[serde(rename = "items")]
    pub items: Vec<CollectionImportPreviewItem>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(untagged)]
pub enum CollectionImportPreviewRequest {
    Variant0(CollectionImportPreviewRequestVariant0),
    Variant1(CollectionImportPreviewRequestVariant1),
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportPreviewResponse {
    #[serde(rename = "data")]
    pub data: CollectionImportPreviewResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportPreviewResponseData {
    #[serde(rename = "totalTokens")]
    pub total_tokens: i64,
    #[serde(rename = "totalCopies")]
    pub total_copies: i64,
    #[serde(rename = "uniquePrintings")]
    pub unique_printings: i64,
    #[serde(rename = "unresolvedCount")]
    pub unresolved_count: i64,
    #[serde(rename = "newCount")]
    pub new_count: i64,
    #[serde(rename = "increasedCount")]
    pub increased_count: i64,
    #[serde(rename = "decreasedCount")]
    pub decreased_count: i64,
    #[serde(rename = "unchangedCount")]
    pub unchanged_count: i64,
    #[serde(rename = "changes")]
    pub changes: Vec<CollectionImportPreviewChange>,
    #[serde(rename = "unresolved")]
    pub unresolved: Vec<CollectionImportPreviewResponseDataUnresolvedItem>,
    #[serde(rename = "items")]
    pub items: Vec<CollectionImportPreviewItem>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportPreviewResponseDataUnresolvedItem {
    #[serde(rename = "token")]
    pub token: String,
    #[serde(rename = "message")]
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CollectionImportPreviewStatus {
    #[serde(rename = "new")]
    New,
    #[serde(rename = "increase")]
    Increase,
    #[serde(rename = "decrease")]
    Decrease,
    #[serde(rename = "unchanged")]
    Unchanged,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportRequest {
    #[serde(rename = "csv")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub csv: Option<String>,
    #[serde(rename = "tts")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tts: Option<String>,
    #[serde(rename = "mode")]
    pub mode: CollectionImportMode,
    #[serde(rename = "items")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<CollectionImportRequestItemsItem>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportRequestItemsItem {
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "quantity")]
    pub quantity: i64,
    #[serde(rename = "condition")]
    pub condition: CardCondition,
    #[serde(rename = "language")]
    pub language: String,
    #[serde(rename = "isFoil")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<bool>,
    #[serde(rename = "notes")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub notes: Option<Option<String>>,
    #[serde(rename = "isGraded")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_graded: Option<bool>,
    #[serde(rename = "gradeCompany")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub grade_company: Option<Option<String>>,
    #[serde(rename = "gradeScore")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub grade_score: Option<Option<String>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportResponse {
    #[serde(rename = "data")]
    pub data: CollectionImportResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportResponseData {
    #[serde(rename = "imported")]
    pub imported: i64,
    #[serde(rename = "totalCopies")]
    pub total_copies: i64,
    #[serde(rename = "rowsProcessed")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rows_processed: Option<i64>,
    #[serde(rename = "resolvedFromUpstream")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_from_upstream: Option<i64>,
    #[serde(rename = "failedRows")]
    pub failed_rows: i64,
    #[serde(rename = "errors")]
    pub errors: Vec<CollectionImportResponseDataErrorsItem>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportResponseDataErrorsItem {
    #[serde(rename = "row")]
    pub row: i64,
    #[serde(rename = "message")]
    pub message: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "quantity")]
    pub quantity: i64,
    #[serde(rename = "condition")]
    pub condition: CardCondition,
    #[serde(rename = "language")]
    pub language: String,
    #[serde(rename = "isFoil")]
    pub is_foil: bool,
    #[serde(rename = "notes")]
    #[schema(required = true, nullable = true)]
    pub notes: Option<String>,
    #[serde(rename = "isGraded")]
    pub is_graded: bool,
    #[serde(rename = "gradeCompany")]
    #[schema(required = true, nullable = true)]
    pub grade_company: Option<String>,
    #[serde(rename = "gradeScore")]
    #[schema(required = true, nullable = true)]
    pub grade_score: Option<String>,
    #[serde(rename = "acquiredAt")]
    #[schema(required = true, nullable = true)]
    pub acquired_at: Option<String>,
    #[serde(rename = "acquiredPriceCents")]
    #[schema(required = true, nullable = true)]
    pub acquired_price_cents: Option<i64>,
    #[serde(rename = "addedAt")]
    pub added_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    #[serde(rename = "setCode")]
    pub set_code: String,
    #[serde(rename = "rarity")]
    pub rarity: String,
    #[serde(rename = "type")]
    #[schema(required = true, nullable = true)]
    pub type_: Option<String>,
    #[serde(rename = "variantLabel")]
    pub variant_label: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionItemResponse {
    #[serde(rename = "data")]
    pub data: CollectionItem,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionListResponse {
    #[serde(rename = "data")]
    pub data: Vec<CollectionItem>,
    #[serde(rename = "meta")]
    pub meta: CollectionListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionListResponseMeta {
    #[serde(rename = "total")]
    pub total: i64,
    #[serde(rename = "totalQuantity")]
    pub total_quantity: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CollectionLiveChangeReason {
    #[serde(rename = "upsert")]
    Upsert,
    #[serde(rename = "add")]
    Add,
    #[serde(rename = "remove")]
    Remove,
    #[serde(rename = "delete")]
    Delete,
    #[serde(rename = "clear")]
    Clear,
    #[serde(rename = "batch")]
    Batch,
    #[serde(rename = "import")]
    Import,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionLiveChangedEvent {
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "collectionId")]
    pub collection_id: String,
    #[serde(rename = "reason")]
    pub reason: CollectionLiveChangeReason,
    #[serde(rename = "actorUserId")]
    pub actor_user_id: String,
    #[serde(rename = "at")]
    pub at: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(untagged)]
pub enum CollectionLiveEvent {
    Variant0(CollectionLiveChangedEvent),
    Variant1(CollectionLiveReadyEvent),
    Variant2(CollectionLiveHeartbeatEvent),
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionLiveHeartbeatEvent {
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "at")]
    pub at: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionLiveReadyEvent {
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "collectionId")]
    pub collection_id: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionQuantitiesRequest {
    #[serde(rename = "variantNumbers")]
    pub variant_numbers: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionQuantitiesResponse {
    #[serde(rename = "data")]
    pub data: Vec<CollectionQuantityRow>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionQuantityRow {
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "isFoil")]
    pub is_foil: bool,
    #[serde(rename = "quantity")]
    pub quantity: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionRecentAddsResponse {
    #[serde(rename = "data")]
    pub data: Vec<CollectionActivityEvent>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CollectionShareAcceptMode {
    #[serde(rename = "use_theirs")]
    UseTheirs,
    #[serde(rename = "merge")]
    Merge,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareAcceptRequest {
    #[serde(rename = "mode")]
    pub mode: CollectionShareAcceptMode,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareAcceptResponse {
    #[serde(rename = "data")]
    pub data: CollectionShareStatus,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareInviteCreate {
    #[serde(rename = "token")]
    pub token: String,
    #[serde(rename = "url")]
    pub url: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: IsoDateTimeString,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareInviteCreateResponse {
    #[serde(rename = "data")]
    pub data: CollectionShareInviteCreate,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareInvitePreview {
    #[serde(rename = "token")]
    pub token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: IsoDateTimeString,
    #[serde(rename = "inviter")]
    pub inviter: CollectionSharePerson,
    #[serde(rename = "theirItemCount")]
    pub their_item_count: i64,
    #[serde(rename = "theirTotalQuantity")]
    pub their_total_quantity: i64,
    #[serde(rename = "yourItemCount")]
    pub your_item_count: i64,
    #[serde(rename = "yourTotalQuantity")]
    pub your_total_quantity: i64,
    #[serde(rename = "canAccept")]
    pub can_accept: bool,
    #[serde(rename = "reason")]
    #[schema(required = true, nullable = true)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareInvitePreviewResponse {
    #[serde(rename = "data")]
    pub data: CollectionShareInvitePreview,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareLeaveResponse {
    #[serde(rename = "data")]
    pub data: CollectionShareStatus,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionSharePartner {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "email")]
    pub email: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionSharePendingInvite {
    #[serde(rename = "expiresAt")]
    pub expires_at: IsoDateTimeString,
    #[serde(rename = "token")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(rename = "url")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionSharePerson {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "name")]
    pub name: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareStatus {
    #[serde(rename = "shared")]
    pub shared: bool,
    #[serde(rename = "memberCount")]
    pub member_count: i64,
    #[serde(rename = "collectionId")]
    pub collection_id: String,
    #[serde(rename = "role")]
    pub role: CollectionShareStatusRole,
    #[serde(rename = "partner")]
    #[schema(required = true, nullable = true)]
    pub partner: Option<CollectionSharePartner>,
    #[serde(rename = "pendingInvite")]
    #[schema(required = true, nullable = true)]
    pub pending_invite: Option<CollectionSharePendingInvite>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum CollectionShareStatusRole {
    #[serde(rename = "owner")]
    Owner,
    #[serde(rename = "member")]
    Member,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareStatusResponse {
    #[serde(rename = "data")]
    pub data: CollectionShareStatus,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionUpsertRequest {
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "quantity")]
    pub quantity: i64,
    #[serde(rename = "condition")]
    pub condition: CardCondition,
    #[serde(rename = "language")]
    pub language: String,
    #[serde(rename = "isFoil")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<bool>,
    #[serde(rename = "notes")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub notes: Option<Option<String>>,
    #[serde(rename = "isGraded")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_graded: Option<bool>,
    #[serde(rename = "gradeCompany")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub grade_company: Option<Option<String>>,
    #[serde(rename = "gradeScore")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub grade_score: Option<Option<String>>,
    #[serde(rename = "acquiredAt")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub acquired_at: Option<Option<String>>,
    #[serde(rename = "acquiredPriceCents")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub acquired_price_cents: Option<Option<i64>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct ColorRef {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "hexCode")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hex_code: Option<String>,
    #[serde(rename = "imageUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CreateDeckVersionRequest {
    #[serde(rename = "name")]
    pub name: DeckVersionName,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckCardInput {
    #[serde(rename = "cardId")]
    pub card_id: String,
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "super")]
    #[schema(required = true, nullable = true)]
    pub super_: Option<String>,
    #[serde(rename = "tags")]
    pub tags: Vec<String>,
    #[serde(rename = "colors")]
    pub colors: Vec<String>,
    #[serde(rename = "energy")]
    pub energy: f64,
    #[serde(rename = "power")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub power: Option<i64>,
    #[serde(rename = "setCode")]
    pub set_code: String,
    #[serde(rename = "rarity")]
    pub rarity: String,
    #[serde(rename = "variantType")]
    pub variant_type: String,
    #[serde(rename = "isSignature")]
    pub is_signature: bool,
    #[serde(rename = "imageUrl")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub image_url: Option<Option<String>>,
    #[serde(rename = "banEffectiveDate")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub ban_effective_date: Option<Option<String>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckDetailResponse {
    #[serde(rename = "data")]
    pub data: DeckListItem,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckEntryInput {
    #[serde(rename = "card")]
    pub card: DeckCardInput,
    #[serde(rename = "count")]
    pub count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum DeckFormat {
    #[serde(rename = "constructed")]
    Constructed,
    #[serde(rename = "pre-rift")]
    PreRift,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckListItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "description")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "format")]
    pub format: DeckFormat,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "legend")]
    #[schema(required = true, nullable = true)]
    pub legend: Option<DeckCardInput>,
    #[serde(rename = "champion")]
    #[schema(required = true, nullable = true)]
    pub champion: Option<DeckCardInput>,
    #[serde(rename = "mainDeck")]
    pub main_deck: Vec<DeckEntryInput>,
    #[serde(rename = "runes")]
    pub runes: Vec<DeckEntryInput>,
    #[serde(rename = "battlefields")]
    pub battlefields: Vec<DeckEntryInput>,
    #[serde(rename = "sideboard")]
    pub sideboard: Vec<DeckEntryInput>,
    #[serde(rename = "upstreamId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upstream_id: Option<String>,
    #[serde(rename = "importedFromId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub imported_from_id: Option<String>,
    #[serde(rename = "syncWarnings")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sync_warnings: Option<Vec<String>>,
    #[serde(rename = "source")]
    pub source: DeckSource,
    #[serde(rename = "readOnly")]
    pub read_only: bool,
    #[serde(rename = "authorName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_name: Option<String>,
    #[serde(rename = "views")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub views: Option<i64>,
    #[serde(rename = "likes")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub likes: Option<i64>,
    #[serde(rename = "isLegal")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_legal: Option<bool>,
    #[serde(rename = "setPrefixes")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub set_prefixes: Option<Vec<String>>,
    #[serde(rename = "hasGuide")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_guide: Option<bool>,
    #[serde(rename = "hasVideo")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_video: Option<bool>,
    #[serde(rename = "hasMatchups")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_matchups: Option<bool>,
    #[serde(rename = "videoUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_url: Option<String>,
    #[serde(rename = "bannedCardNames")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub banned_card_names: Option<Vec<String>>,
    #[serde(rename = "versionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version_id: Option<String>,
    #[serde(rename = "versionName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version_name: Option<String>,
    #[serde(rename = "versions")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub versions: Option<Vec<DeckVersionSummary>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckListResponse {
    #[serde(rename = "data")]
    pub data: Vec<DeckListItem>,
    #[serde(rename = "meta")]
    pub meta: DeckListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckListResponseMeta {
    #[serde(rename = "total")]
    pub total: i64,
    #[serde(rename = "owned")]
    pub owned: i64,
    #[serde(rename = "imported")]
    pub imported: i64,
    #[serde(rename = "pagination")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pagination: Option<Pagination>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckRulesResponse {
    #[serde(rename = "data")]
    pub data: DeckRulesResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckRulesResponseData {
    #[serde(rename = "version")]
    pub version: String,
    #[serde(rename = "rules")]
    pub rules: DeckRulesResponseDataRules,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckRulesResponseDataRules {
    #[serde(rename = "version")]
    pub version: String,
    #[serde(rename = "game")]
    pub game: String,
    #[serde(rename = "format")]
    pub format: String,
    #[serde(rename = "sections")]
    pub sections: std::collections::BTreeMap<String, DeckRulesResponseDataRulesSectionsValue>,
    #[serde(rename = "copyLimits")]
    pub copy_limits: DeckRulesResponseDataRulesCopyLimits,
    #[serde(rename = "maxDomains")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub max_domains: Option<Option<i64>>,
    #[serde(rename = "requireChampionTagMatch")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub require_champion_tag_match: Option<bool>,
    #[serde(rename = "requireSignatureTagMatch")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub require_signature_tag_match: Option<bool>,
    #[serde(rename = "restrictPicker")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub restrict_picker: Option<bool>,
    #[serde(rename = "constraints")]
    pub constraints: Vec<DeckRulesResponseDataRulesConstraintsItem>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckRulesResponseDataRulesSectionsValue {
    #[serde(rename = "key")]
    pub key: String,
    #[serde(rename = "title")]
    pub title: String,
    #[serde(rename = "target")]
    pub target: i64,
    #[serde(rename = "single")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub single: Option<bool>,
    #[serde(rename = "minimum")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum: Option<i64>,
    #[serde(rename = "exact")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exact: Option<bool>,
    #[serde(rename = "maximum")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub maximum: Option<i64>,
    #[serde(rename = "required")]
    pub required: bool,
    #[serde(rename = "uniqueNames")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unique_names: Option<bool>,
    #[serde(rename = "description")]
    pub description: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckRulesResponseDataRulesCopyLimits {
    #[serde(rename = "default")]
    #[schema(required = true, nullable = true)]
    pub default_: Option<i64>,
    #[serde(rename = "rune")]
    pub rune: i64,
    #[serde(rename = "battlefieldPerName")]
    pub battlefield_per_name: i64,
    #[serde(rename = "signatureTotal")]
    #[schema(required = true, nullable = true)]
    pub signature_total: Option<i64>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckRulesResponseDataRulesConstraintsItem {
    #[serde(rename = "code")]
    pub code: String,
    #[serde(rename = "message")]
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum DeckSortField {
    #[serde(rename = "trending")]
    Trending,
    #[serde(rename = "likes")]
    Likes,
    #[serde(rename = "views")]
    Views,
    #[serde(rename = "createdAt")]
    CreatedAt,
    #[serde(rename = "editedAt")]
    EditedAt,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum DeckSource {
    #[serde(rename = "owned")]
    Owned,
    #[serde(rename = "imported")]
    Imported,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckUpsertRequest {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "description")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "format")]
    pub format: DeckFormat,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "legend")]
    #[schema(required = true, nullable = true)]
    pub legend: Option<DeckCardInput>,
    #[serde(rename = "champion")]
    #[schema(required = true, nullable = true)]
    pub champion: Option<DeckCardInput>,
    #[serde(rename = "mainDeck")]
    pub main_deck: Vec<DeckEntryInput>,
    #[serde(rename = "runes")]
    pub runes: Vec<DeckEntryInput>,
    #[serde(rename = "battlefields")]
    pub battlefields: Vec<DeckEntryInput>,
    #[serde(rename = "sideboard")]
    pub sideboard: Vec<DeckEntryInput>,
    #[serde(rename = "upstreamId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upstream_id: Option<String>,
    #[serde(rename = "importedFromId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub imported_from_id: Option<String>,
    #[serde(rename = "syncWarnings")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sync_warnings: Option<Vec<String>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckValidateInput {
    #[serde(rename = "format")]
    pub format: DeckFormat,
    #[serde(rename = "legend")]
    #[schema(required = true, nullable = true)]
    pub legend: Option<DeckCardInput>,
    #[serde(rename = "champion")]
    #[schema(required = true, nullable = true)]
    pub champion: Option<DeckCardInput>,
    #[serde(rename = "mainDeck")]
    pub main_deck: Vec<DeckEntryInput>,
    #[serde(rename = "runes")]
    pub runes: Vec<DeckEntryInput>,
    #[serde(rename = "battlefields")]
    pub battlefields: Vec<DeckEntryInput>,
    #[serde(rename = "sideboard")]
    pub sideboard: Vec<DeckEntryInput>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckValidateResponse {
    #[serde(rename = "data")]
    pub data: DeckValidateResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckValidateResponseData {
    #[serde(rename = "messages")]
    pub messages: Vec<DeckValidationMessage>,
    #[serde(rename = "valid")]
    pub valid: bool,
    #[serde(rename = "hasErrors")]
    pub has_errors: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckValidationMessage {
    #[serde(rename = "type")]
    pub type_: DeckValidationMessageType,
    #[serde(rename = "code")]
    pub code: String,
    #[serde(rename = "message")]
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum DeckValidationMessageType {
    #[serde(rename = "error")]
    Error,
    #[serde(rename = "warning")]
    Warning,
    #[serde(rename = "valid")]
    Valid,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckVersionSummary {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DecksListQuery {
    #[serde(rename = "q")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub q: Option<String>,
    #[serde(rename = "legend")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub legend: Option<String>,
    #[serde(rename = "sets")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sets: Option<String>,
    #[serde(rename = "isLegal")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_legal: Option<QueryBooleanString>,
    #[serde(rename = "hasGuide")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_guide: Option<QueryBooleanString>,
    #[serde(rename = "hasVideo")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_video: Option<QueryBooleanString>,
    #[serde(rename = "hasMatchups")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_matchups: Option<QueryBooleanString>,
    #[serde(rename = "page")]
    pub page: i64,
    #[serde(rename = "limit")]
    pub limit: i64,
    #[serde(rename = "sort")]
    pub sort: DeckSortField,
    #[serde(rename = "dir")]
    pub dir: DecksListQueryDir,
    #[serde(rename = "source")]
    pub source: DecksListQuerySource,
    #[serde(rename = "preview")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<QueryBooleanString>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum DecksListQueryDir {
    #[serde(rename = "asc")]
    Asc,
    #[serde(rename = "desc")]
    Desc,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum DecksListQuerySource {
    #[serde(rename = "owned")]
    Owned,
    #[serde(rename = "imported")]
    Imported,
    #[serde(rename = "all")]
    All,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshot {
    #[serde(rename = "colors")]
    pub colors: Vec<FilterSnapshotColorsItem>,
    #[serde(rename = "sets")]
    pub sets: Vec<FilterSnapshotSetsItem>,
    #[serde(rename = "types")]
    pub types: Vec<FilterSnapshotTypesItem>,
    #[serde(rename = "supertypes")]
    pub supertypes: Vec<FilterSnapshotSupertypesItem>,
    #[serde(rename = "rarities")]
    pub rarities: Vec<FilterSnapshotRaritiesItem>,
    #[serde(rename = "variants")]
    pub variants: Vec<FilterSnapshotVariantsItem>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshotColorsItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "count")]
    pub count: i64,
    #[serde(rename = "imageUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshotSetsItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "count")]
    pub count: i64,
    #[serde(rename = "code")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(rename = "printCount")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub print_count: Option<i64>,
    #[serde(rename = "foilPrintCount")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub foil_print_count: Option<i64>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshotTypesItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "count")]
    pub count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshotSupertypesItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "count")]
    pub count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshotRaritiesItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "count")]
    pub count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshotVariantsItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "count")]
    pub count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FiltersResponse {
    #[serde(rename = "data")]
    pub data: FilterSnapshot,
    #[serde(rename = "meta")]
    pub meta: FiltersResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FiltersResponseMeta {
    #[serde(rename = "cachedAt")]
    pub cached_at: IsoDateTimeString,
    #[serde(rename = "catalogHash")]
    pub catalog_hash: String,
    #[serde(rename = "pricesCatalogHash")]
    pub prices_catalog_hash: String,
    #[serde(rename = "variantCount")]
    pub variant_count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchQuery {
    #[serde(rename = "q")]
    pub q: String,
    #[serde(rename = "types")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub types: Option<String>,
    #[serde(rename = "limit")]
    pub limit: i64,
    #[serde(rename = "page")]
    pub page: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchResponse {
    #[serde(rename = "data")]
    pub data: GlobalSearchResponseData,
    #[serde(rename = "meta")]
    pub meta: GlobalSearchResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchResponseData {
    #[serde(rename = "cards")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cards: Option<GlobalSearchResponseDataCards>,
    #[serde(rename = "decks")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decks: Option<GlobalSearchResponseDataDecks>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchResponseDataCards {
    #[serde(rename = "hits")]
    pub hits: Vec<SearchHitCard>,
    #[serde(rename = "total")]
    pub total: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchResponseDataDecks {
    #[serde(rename = "hits")]
    pub hits: Vec<SearchHitDeck>,
    #[serde(rename = "total")]
    pub total: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchResponseMeta {
    #[serde(rename = "tookMs")]
    pub took_ms: i64,
    #[serde(rename = "catalogHash")]
    pub catalog_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum GridCardSize {
    #[serde(rename = "large")]
    Large,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "small")]
    Small,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct HealthResponse {
    #[serde(rename = "data")]
    pub data: HealthResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct HealthResponseData {
    #[serde(rename = "status")]
    pub status: String,
    #[serde(rename = "db")]
    pub db: HealthResponseDataDb,
    #[serde(rename = "lastCatalogSync")]
    #[schema(required = true, nullable = true)]
    pub last_catalog_sync: Option<IsoDateTimeString>,
    #[serde(rename = "emailVerificationRequired")]
    pub email_verification_required: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum HealthResponseDataDb {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "error")]
    Error,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct IdData {
    #[serde(rename = "id")]
    pub id: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct IdResponse {
    #[serde(rename = "data")]
    pub data: IdData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct ImageThumbQuery {
    #[serde(rename = "w")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub w: Option<i64>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct OkData {
    #[serde(rename = "ok")]
    pub ok: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct OkResponse {
    #[serde(rename = "data")]
    pub data: OkData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaCardsBatchResponse {
    #[serde(rename = "data")]
    pub data: Vec<PaVariantListItem>,
    #[serde(rename = "notFound")]
    pub not_found: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaCardsListResponse {
    #[serde(rename = "data")]
    pub data: Vec<PaVariantListItem>,
    #[serde(rename = "pagination")]
    pub pagination: PaCardsListResponsePagination,
    #[serde(rename = "meta")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meta: Option<PaCardsListResponseMeta>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaCardsListResponsePagination {
    #[serde(rename = "total")]
    pub total: i64,
    #[serde(rename = "page")]
    pub page: i64,
    #[serde(rename = "limit")]
    pub limit: i64,
    #[serde(rename = "totalPages")]
    pub total_pages: i64,
    #[serde(rename = "hasNext")]
    pub has_next: bool,
    #[serde(rename = "hasPrevious")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_previous: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaCardsListResponseMeta {
    #[serde(rename = "filters")]
    pub filters: std::collections::BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaColor {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "hexCode")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hex_code: Option<String>,
    #[serde(rename = "imageUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaLogicalCard {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "super")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub super_: Option<Option<String>>,
    #[serde(rename = "description")]
    pub description: String,
    #[serde(rename = "energy")]
    pub energy: i64,
    #[serde(rename = "might")]
    pub might: i64,
    #[serde(rename = "power")]
    pub power: i64,
    #[serde(rename = "tags")]
    pub tags: Vec<String>,
    #[serde(rename = "attachText")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub attach_text: Option<Option<String>>,
    #[serde(rename = "effect")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub effect: Option<Option<String>>,
    #[serde(rename = "mightBonus")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub might_bonus: Option<f64>,
    #[serde(rename = "maxCopies")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub max_copies: Option<Option<f64>>,
    #[serde(rename = "banEffectiveDate")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub ban_effective_date: Option<Option<String>>,
    #[serde(rename = "colors")]
    pub colors: Vec<PaColor>,
    #[serde(rename = "variants")]
    pub variants: Vec<PaVariant>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaPriceRow {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "cardmarketId")]
    pub cardmarket_id: i64,
    #[serde(rename = "tcgPlayerId")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub tcg_player_id: Option<Option<i64>>,
    #[serde(rename = "provider")]
    pub provider: String,
    #[serde(rename = "isFoil")]
    pub is_foil: bool,
    #[serde(rename = "currency")]
    pub currency: String,
    #[serde(rename = "lowPrice")]
    #[schema(required = true, nullable = true)]
    pub low_price: Option<String>,
    #[serde(rename = "marketPrice")]
    #[schema(required = true, nullable = true)]
    pub market_price: Option<String>,
    #[serde(rename = "midPrice")]
    #[schema(required = true, nullable = true)]
    pub mid_price: Option<String>,
    #[serde(rename = "highPrice")]
    #[schema(required = true, nullable = true)]
    pub high_price: Option<String>,
    #[serde(rename = "directLowPrice")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub direct_low_price: Option<Option<String>>,
    #[serde(rename = "avg1Day")]
    #[schema(required = true, nullable = true)]
    pub avg1_day: Option<String>,
    #[serde(rename = "avg7Day")]
    #[schema(required = true, nullable = true)]
    pub avg7_day: Option<String>,
    #[serde(rename = "avg30Day")]
    #[schema(required = true, nullable = true)]
    pub avg30_day: Option<String>,
    #[serde(rename = "lastUpdated")]
    pub last_updated: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaPricesListResponse {
    #[serde(rename = "data")]
    pub data: Vec<PaPriceRow>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaSet {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "prefix")]
    pub prefix: String,
    #[serde(rename = "releaseDate")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_date: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaVariant {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    #[serde(rename = "rarity")]
    pub rarity: String,
    #[serde(rename = "variantType")]
    pub variant_type: String,
    #[serde(rename = "foilMode")]
    pub foil_mode: String,
    #[serde(rename = "variantTypes")]
    pub variant_types: Vec<String>,
    #[serde(rename = "showInLibrary")]
    pub show_in_library: bool,
    #[serde(rename = "isCollectible")]
    pub is_collectible: bool,
    #[serde(rename = "variantLabel")]
    pub variant_label: String,
    #[serde(rename = "flavorText")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub flavor_text: Option<Option<String>>,
    #[serde(rename = "artist")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub artist: Option<Option<String>>,
    #[serde(rename = "releaseDate")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub release_date: Option<Option<String>>,
    #[serde(rename = "cardmarketId")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub cardmarket_id: Option<Option<i64>>,
    #[serde(rename = "tcgplayerId")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub tcgplayer_id: Option<Option<i64>>,
    #[serde(rename = "parentVariantId")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub parent_variant_id: Option<Option<String>>,
    #[serde(rename = "set")]
    pub set: PaSet,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaVariantListItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    #[serde(rename = "rarity")]
    pub rarity: String,
    #[serde(rename = "variantType")]
    pub variant_type: String,
    #[serde(rename = "foilMode")]
    pub foil_mode: String,
    #[serde(rename = "variantTypes")]
    pub variant_types: Vec<String>,
    #[serde(rename = "showInLibrary")]
    pub show_in_library: bool,
    #[serde(rename = "isCollectible")]
    pub is_collectible: bool,
    #[serde(rename = "variantLabel")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub variant_label: Option<Option<String>>,
    #[serde(rename = "flavorText")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub flavor_text: Option<Option<String>>,
    #[serde(rename = "artist")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub artist: Option<Option<String>>,
    #[serde(rename = "releaseDate")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub release_date: Option<Option<String>>,
    #[serde(rename = "cardmarketId")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub cardmarket_id: Option<Option<i64>>,
    #[serde(rename = "tcgplayerId")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub tcgplayer_id: Option<Option<i64>>,
    #[serde(rename = "parentVariantId")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub parent_variant_id: Option<Option<String>>,
    #[serde(rename = "set")]
    pub set: PaSet,
    #[serde(rename = "card")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub card: Option<Option<serde_json::Value>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct Pagination {
    #[serde(rename = "total")]
    pub total: i64,
    #[serde(rename = "page")]
    pub page: i64,
    #[serde(rename = "limit")]
    pub limit: i64,
    #[serde(rename = "totalPages")]
    pub total_pages: i64,
    #[serde(rename = "hasNext")]
    pub has_next: bool,
    #[serde(rename = "hasPrevious")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_previous: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceDailyPoint {
    #[serde(rename = "cardmarketId")]
    pub cardmarket_id: i64,
    #[serde(rename = "isFoil")]
    pub is_foil: bool,
    #[serde(rename = "provider")]
    pub provider: String,
    #[serde(rename = "currency")]
    pub currency: String,
    #[serde(rename = "priceDate")]
    pub price_date: IsoDateString,
    #[serde(rename = "lowPrice")]
    #[schema(required = true, nullable = true)]
    pub low_price: Option<f64>,
    #[serde(rename = "marketPrice")]
    #[schema(required = true, nullable = true)]
    pub market_price: Option<f64>,
    #[serde(rename = "midPrice")]
    #[schema(required = true, nullable = true)]
    pub mid_price: Option<f64>,
    #[serde(rename = "highPrice")]
    #[schema(required = true, nullable = true)]
    pub high_price: Option<f64>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceHistoryQuery {
    #[serde(rename = "cardmarketId")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub cardmarket_id: Option<Option<i64>>,
    #[serde(rename = "variantNumber")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_number: Option<String>,
    #[serde(rename = "isFoil")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<QueryBooleanString>,
    #[serde(rename = "days")]
    pub days: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceHistoryResponse {
    #[serde(rename = "data")]
    pub data: Vec<PriceDailyPoint>,
    #[serde(rename = "meta")]
    pub meta: PriceHistoryResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceHistoryResponseMeta {
    #[serde(rename = "cardmarketId")]
    #[schema(required = true, nullable = true)]
    pub cardmarket_id: Option<i64>,
    #[serde(rename = "isFoil")]
    #[schema(required = true, nullable = true)]
    pub is_foil: Option<bool>,
    #[serde(rename = "days")]
    pub days: i64,
    #[serde(rename = "rowCount")]
    pub row_count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceRow {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "cardmarketId")]
    pub cardmarket_id: i64,
    #[serde(rename = "isFoil")]
    pub is_foil: bool,
    #[serde(rename = "provider")]
    pub provider: String,
    #[serde(rename = "currency")]
    pub currency: String,
    #[serde(rename = "lowPrice")]
    #[schema(required = true, nullable = true)]
    pub low_price: Option<f64>,
    #[serde(rename = "marketPrice")]
    #[schema(required = true, nullable = true)]
    pub market_price: Option<f64>,
    #[serde(rename = "midPrice")]
    #[schema(required = true, nullable = true)]
    pub mid_price: Option<f64>,
    #[serde(rename = "highPrice")]
    #[schema(required = true, nullable = true)]
    pub high_price: Option<f64>,
    #[serde(rename = "avg1Day")]
    #[schema(required = true, nullable = true)]
    pub avg1_day: Option<f64>,
    #[serde(rename = "avg7Day")]
    #[schema(required = true, nullable = true)]
    pub avg7_day: Option<f64>,
    #[serde(rename = "avg30Day")]
    #[schema(required = true, nullable = true)]
    pub avg30_day: Option<f64>,
    #[serde(rename = "lastUpdated")]
    pub last_updated: IsoDateTimeString,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceStats {
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "cardmarketId")]
    #[schema(required = true, nullable = true)]
    pub cardmarket_id: Option<i64>,
    #[serde(rename = "isFoil")]
    pub is_foil: bool,
    #[serde(rename = "currency")]
    pub currency: String,
    #[serde(rename = "currentPrice")]
    #[schema(required = true, nullable = true)]
    pub current_price: Option<f64>,
    #[serde(rename = "baselinePrice")]
    #[schema(required = true, nullable = true)]
    pub baseline_price: Option<f64>,
    #[serde(rename = "minPrice")]
    #[schema(required = true, nullable = true)]
    pub min_price: Option<f64>,
    #[serde(rename = "maxPrice")]
    #[schema(required = true, nullable = true)]
    pub max_price: Option<f64>,
    #[serde(rename = "avgPrice")]
    #[schema(required = true, nullable = true)]
    pub avg_price: Option<f64>,
    #[serde(rename = "listingLow")]
    #[schema(required = true, nullable = true)]
    pub listing_low: Option<f64>,
    #[serde(rename = "changePercent")]
    #[schema(required = true, nullable = true)]
    pub change_percent: Option<i64>,
    #[serde(rename = "trend")]
    pub trend: PriceTrend,
    #[serde(rename = "points")]
    pub points: Vec<PriceDailyPoint>,
    #[serde(rename = "days")]
    pub days: i64,
    #[serde(rename = "priceFilterLabel")]
    pub price_filter_label: String,
    #[serde(rename = "priceSourceNote")]
    pub price_source_note: String,
    #[serde(rename = "targetPriceCents")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub target_price_cents: Option<Option<i64>>,
    #[serde(rename = "belowTarget")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub below_target: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceStatsBatchRequest {
    #[serde(rename = "items")]
    pub items: Vec<PriceStatsBatchRequestItemsItem>,
    #[serde(rename = "days")]
    pub days: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceStatsBatchRequestItemsItem {
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "isFoil")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<bool>,
    #[serde(rename = "targetPriceCents")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub target_price_cents: Option<Option<i64>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceStatsBatchResponse {
    #[serde(rename = "data")]
    pub data: Vec<PriceStats>,
    #[serde(rename = "meta")]
    pub meta: PriceStatsBatchResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceStatsBatchResponseMeta {
    #[serde(rename = "days")]
    pub days: i64,
    #[serde(rename = "rowCount")]
    pub row_count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceSummary {
    #[serde(rename = "currency")]
    pub currency: String,
    #[serde(rename = "low")]
    #[schema(required = true, nullable = true)]
    pub low: Option<f64>,
    #[serde(rename = "market")]
    #[schema(required = true, nullable = true)]
    pub market: Option<f64>,
    #[serde(rename = "avg7d")]
    #[schema(required = true, nullable = true)]
    pub avg7d: Option<f64>,
    #[serde(rename = "isFoil")]
    pub is_foil: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum PriceTrend {
    #[serde(rename = "up")]
    Up,
    #[serde(rename = "down")]
    Down,
    #[serde(rename = "flat")]
    Flat,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PricesListQuery {
    #[serde(rename = "cardmarketId")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub cardmarket_id: Option<Option<i64>>,
    #[serde(rename = "variantNumber")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_number: Option<String>,
    #[serde(rename = "isFoil")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<QueryBooleanString>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PricesListResponse {
    #[serde(rename = "data")]
    pub data: Vec<PriceRow>,
    #[serde(rename = "meta")]
    pub meta: PricesListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PricesListResponseMeta {
    #[serde(rename = "pricesCatalogHash")]
    pub prices_catalog_hash: String,
    #[serde(rename = "lastSyncedAt")]
    #[schema(required = true, nullable = true)]
    pub last_synced_at: Option<IsoDateTimeString>,
    #[serde(rename = "rowCount")]
    pub row_count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct RenameDeckVersionRequest {
    #[serde(rename = "name")]
    pub name: DeckVersionName,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum SearchEntityType {
    #[serde(rename = "cards")]
    Cards,
    #[serde(rename = "decks")]
    Decks,
    #[serde(rename = "navigation")]
    Navigation,
    #[serde(rename = "actions")]
    Actions,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SearchHitCard {
    #[serde(rename = "kind")]
    pub kind: String,
    #[serde(rename = "variantNumber")]
    pub variant_number: VariantNumber,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    #[serde(rename = "setCode")]
    pub set_code: String,
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(rename = "rarity")]
    pub rarity: String,
    #[serde(rename = "textMatch")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_match: Option<f64>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SearchHitDeck {
    #[serde(rename = "kind")]
    pub kind: String,
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "textMatch")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_match: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum SettingsDeviceProfile {
    #[serde(rename = "phone")]
    Phone,
    #[serde(rename = "desktop")]
    Desktop,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncCatalogResponse {
    #[serde(rename = "data")]
    pub data: SyncCatalogResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncCatalogResponseData {
    #[serde(rename = "changed")]
    pub changed: bool,
    #[serde(rename = "pages")]
    pub pages: i64,
    #[serde(rename = "variantCount")]
    pub variant_count: i64,
    #[serde(rename = "hash")]
    pub hash: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncPricesResponse {
    #[serde(rename = "data")]
    pub data: SyncPricesResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncPricesResponseData {
    #[serde(rename = "changed")]
    pub changed: bool,
    #[serde(rename = "rowCount")]
    pub row_count: i64,
    #[serde(rename = "productCount")]
    pub product_count: i64,
    #[serde(rename = "hash")]
    pub hash: String,
    #[serde(rename = "source")]
    pub source: String,
    #[serde(rename = "gameId")]
    pub game_id: i64,
    #[serde(rename = "exportCreatedAt")]
    pub export_created_at: String,
    #[serde(rename = "cardmarketIdsBackfilled")]
    pub cardmarket_ids_backfilled: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncStatusResponse {
    #[serde(rename = "data")]
    pub data: SyncStatusResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncStatusResponseData {
    #[serde(rename = "catalog")]
    pub catalog: SyncStatusResponseDataCatalog,
    #[serde(rename = "prices")]
    pub prices: SyncStatusResponseDataPrices,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncStatusResponseDataCatalog {
    #[serde(rename = "lastRun")]
    #[schema(required = true, nullable = true)]
    pub last_run: Option<IsoDateTimeString>,
    #[serde(rename = "status")]
    pub status: SyncStatusResponseDataCatalogStatus,
    #[serde(rename = "hash")]
    pub hash: String,
    #[serde(rename = "variantCount")]
    pub variant_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum SyncStatusResponseDataCatalogStatus {
    #[serde(rename = "idle")]
    Idle,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "failed")]
    Failed,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncStatusResponseDataPrices {
    #[serde(rename = "lastRun")]
    #[schema(required = true, nullable = true)]
    pub last_run: Option<IsoDateTimeString>,
    #[serde(rename = "status")]
    pub status: SyncStatusResponseDataPricesStatus,
    #[serde(rename = "hash")]
    pub hash: String,
    #[serde(rename = "rowCount")]
    pub row_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum SyncStatusResponseDataPricesStatus {
    #[serde(rename = "idle")]
    Idle,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "failed")]
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub enum ThemePreference {
    #[serde(rename = "light")]
    Light,
    #[serde(rename = "dark")]
    Dark,
    #[serde(rename = "system")]
    System,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UserSettings {
    #[serde(rename = "device")]
    pub device: SettingsDeviceProfile,
    #[serde(rename = "settings")]
    pub settings: UserSettingsPayload,
    #[serde(rename = "updatedAt")]
    #[schema(required = true, nullable = true)]
    pub updated_at: Option<IsoDateTimeString>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UserSettingsPatch {
    #[serde(rename = "theme")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme: Option<ThemePreference>,
    #[serde(rename = "accentColor")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accent_color: Option<Option<String>>,
    #[serde(rename = "defaultLayout")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_layout: Option<CatalogLayout>,
    #[serde(rename = "gridCardSize")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grid_card_size: Option<GridCardSize>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UserSettingsPayload {
    #[serde(rename = "theme")]
    pub theme: ThemePreference,
    #[serde(rename = "accentColor")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accent_color: Option<String>,
    #[serde(rename = "defaultLayout")]
    pub default_layout: CatalogLayout,
    #[serde(rename = "gridCardSize")]
    pub grid_card_size: GridCardSize,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UserSettingsResponse {
    #[serde(rename = "data")]
    pub data: UserSettings,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct VariantDetail {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "variantNumber")]
    pub variant_number: VariantNumber,
    #[serde(rename = "rarity")]
    pub rarity: String,
    #[serde(rename = "variantType")]
    pub variant_type: String,
    #[serde(rename = "variantLabel")]
    pub variant_label: String,
    #[serde(rename = "foilMode")]
    pub foil_mode: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    #[serde(rename = "cardmarketId")]
    #[schema(required = true, nullable = true)]
    pub cardmarket_id: Option<i64>,
    #[serde(rename = "tcgplayerId")]
    #[schema(required = true, nullable = true)]
    pub tcgplayer_id: Option<i64>,
    #[serde(rename = "releaseDate")]
    #[schema(required = true, nullable = true)]
    pub release_date: Option<String>,
    #[serde(rename = "artist")]
    #[schema(required = true, nullable = true)]
    pub artist: Option<String>,
    #[serde(rename = "prices")]
    pub prices: Vec<PriceSummary>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct WishlistItem {
    #[serde(rename = "id")]
    pub id: String,
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "priority")]
    pub priority: i64,
    #[serde(rename = "targetPriceCents")]
    #[schema(required = true, nullable = true)]
    pub target_price_cents: Option<i64>,
    #[serde(rename = "notes")]
    #[schema(required = true, nullable = true)]
    pub notes: Option<String>,
    #[serde(rename = "addedAt")]
    pub added_at: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    #[serde(rename = "setCode")]
    pub set_code: String,
    #[serde(rename = "rarity")]
    pub rarity: String,
    #[serde(rename = "variantLabel")]
    pub variant_label: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct WishlistItemResponse {
    #[serde(rename = "data")]
    pub data: WishlistItem,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct WishlistListResponse {
    #[serde(rename = "data")]
    pub data: Vec<WishlistItem>,
    #[serde(rename = "meta")]
    pub meta: WishlistListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct WishlistListResponseMeta {
    #[serde(rename = "total")]
    pub total: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct WishlistUpsertRequest {
    #[serde(rename = "variantNumber")]
    pub variant_number: String,
    #[serde(rename = "priority")]
    pub priority: i64,
    #[serde(rename = "targetPriceCents")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub target_price_cents: Option<Option<i64>>,
    #[serde(rename = "notes")]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub notes: Option<Option<String>>,
}

pub type CollectionRecentAddsRequest = CollectionQuantitiesRequest;
pub type CollectionVariantNumbersRequest = CollectionQuantitiesRequest;
pub type DeckVersionName = String;
pub type IsoDateString = String;
pub type IsoDateTimeString = String;
pub type QueryBooleanString = bool;
pub type StoredDeckPayload = DeckUpsertRequest;
pub type UserSettingsUpsertRequest = UserSettingsPatch;
pub type VariantNumber = String;

#[derive(utoipa::OpenApi)]
#[openapi(components(schemas(
    CardCondition,
    CardDetail,
    CardDetailResponse,
    CardDetailResponseMeta,
    CardDetailResponseMetaSource,
    CardListItem,
    CardListPrinting,
    CardsBatchRequest,
    CardsBatchResponse,
    CardsBatchResponseMeta,
    CardsBatchResponseMetaSource,
    CardsDetailQuery,
    CardsListQuery,
    CardsListQueryColorMode,
    CardsListQuerySortBy,
    CardsListQueryDir,
    CardsListResponse,
    CardsListResponseMeta,
    CardsListResponseMetaSource,
    CatalogIndexResponse,
    CatalogIndexResponseMeta,
    CatalogIndexResponseMetaSource,
    CatalogLayout,
    CollectionActivityCursor,
    CollectionActivityEvent,
    CollectionActivityHistoryRequest,
    CollectionActivityHistoryResponse,
    CollectionActivityHistoryResponseMeta,
    CollectionAdjustRequest,
    CollectionAuditAction,
    CollectionAuditActor,
    CollectionAuditEvent,
    CollectionAuditListQuery,
    CollectionAuditListResponse,
    CollectionAuditListResponseMeta,
    CollectionBatchSyncRequest,
    CollectionBatchSyncResponse,
    CollectionBatchSyncResponseData,
    CollectionDeleteQuery,
    CollectionImportMode,
    CollectionImportPreviewChange,
    CollectionImportPreviewItem,
    CollectionImportPreviewRequestVariant0,
    CollectionImportPreviewRequestVariant1,
    CollectionImportPreviewRequest,
    CollectionImportPreviewResponse,
    CollectionImportPreviewResponseData,
    CollectionImportPreviewResponseDataUnresolvedItem,
    CollectionImportPreviewStatus,
    CollectionImportRequest,
    CollectionImportRequestItemsItem,
    CollectionImportResponse,
    CollectionImportResponseData,
    CollectionImportResponseDataErrorsItem,
    CollectionItem,
    CollectionItemResponse,
    CollectionListResponse,
    CollectionListResponseMeta,
    CollectionLiveChangeReason,
    CollectionLiveChangedEvent,
    CollectionLiveEvent,
    CollectionLiveHeartbeatEvent,
    CollectionLiveReadyEvent,
    CollectionQuantitiesRequest,
    CollectionQuantitiesResponse,
    CollectionQuantityRow,
    CollectionRecentAddsResponse,
    CollectionShareAcceptMode,
    CollectionShareAcceptRequest,
    CollectionShareAcceptResponse,
    CollectionShareInviteCreate,
    CollectionShareInviteCreateResponse,
    CollectionShareInvitePreview,
    CollectionShareInvitePreviewResponse,
    CollectionShareLeaveResponse,
    CollectionSharePartner,
    CollectionSharePendingInvite,
    CollectionSharePerson,
    CollectionShareStatus,
    CollectionShareStatusRole,
    CollectionShareStatusResponse,
    CollectionUpsertRequest,
    ColorRef,
    CreateDeckVersionRequest,
    DeckCardInput,
    DeckDetailResponse,
    DeckEntryInput,
    DeckFormat,
    DeckListItem,
    DeckListResponse,
    DeckListResponseMeta,
    DeckRulesResponse,
    DeckRulesResponseData,
    DeckRulesResponseDataRules,
    DeckRulesResponseDataRulesSectionsValue,
    DeckRulesResponseDataRulesCopyLimits,
    DeckRulesResponseDataRulesConstraintsItem,
    DeckSortField,
    DeckSource,
    DeckUpsertRequest,
    DeckValidateInput,
    DeckValidateResponse,
    DeckValidateResponseData,
    DeckValidationMessage,
    DeckValidationMessageType,
    DeckVersionSummary,
    DecksListQuery,
    DecksListQueryDir,
    DecksListQuerySource,
    FilterSnapshot,
    FilterSnapshotColorsItem,
    FilterSnapshotSetsItem,
    FilterSnapshotTypesItem,
    FilterSnapshotSupertypesItem,
    FilterSnapshotRaritiesItem,
    FilterSnapshotVariantsItem,
    FiltersResponse,
    FiltersResponseMeta,
    GlobalSearchQuery,
    GlobalSearchResponse,
    GlobalSearchResponseData,
    GlobalSearchResponseDataCards,
    GlobalSearchResponseDataDecks,
    GlobalSearchResponseMeta,
    GridCardSize,
    HealthResponse,
    HealthResponseData,
    HealthResponseDataDb,
    IdData,
    IdResponse,
    ImageThumbQuery,
    OkData,
    OkResponse,
    PaCardsBatchResponse,
    PaCardsListResponse,
    PaCardsListResponsePagination,
    PaCardsListResponseMeta,
    PaColor,
    PaLogicalCard,
    PaPriceRow,
    PaPricesListResponse,
    PaSet,
    PaVariant,
    PaVariantListItem,
    Pagination,
    PriceDailyPoint,
    PriceHistoryQuery,
    PriceHistoryResponse,
    PriceHistoryResponseMeta,
    PriceRow,
    PriceStats,
    PriceStatsBatchRequest,
    PriceStatsBatchRequestItemsItem,
    PriceStatsBatchResponse,
    PriceStatsBatchResponseMeta,
    PriceSummary,
    PriceTrend,
    PricesListQuery,
    PricesListResponse,
    PricesListResponseMeta,
    RenameDeckVersionRequest,
    SearchEntityType,
    SearchHitCard,
    SearchHitDeck,
    SettingsDeviceProfile,
    SyncCatalogResponse,
    SyncCatalogResponseData,
    SyncPricesResponse,
    SyncPricesResponseData,
    SyncStatusResponse,
    SyncStatusResponseData,
    SyncStatusResponseDataCatalog,
    SyncStatusResponseDataCatalogStatus,
    SyncStatusResponseDataPrices,
    SyncStatusResponseDataPricesStatus,
    ThemePreference,
    UserSettings,
    UserSettingsPatch,
    UserSettingsPayload,
    UserSettingsResponse,
    VariantDetail,
    WishlistItem,
    WishlistItemResponse,
    WishlistListResponse,
    WishlistListResponseMeta,
    WishlistUpsertRequest
)))]
pub struct ContractSchemas;
