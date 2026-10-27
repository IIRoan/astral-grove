#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CardCondition {
    Mint,
    NearMint,
    LightlyPlayed,
    ModeratelyPlayed,
    HeavilyPlayed,
    Damaged,
    Unspecified,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CardDetail {
    pub id: String,
    pub name: String,
    pub type_: String,
    #[schema(required = true, nullable = true)]
    pub super_: Option<String>,
    pub description: String,
    pub energy: i64,
    pub might: i64,
    pub power: i64,
    pub tags: Vec<String>,
    pub colors: Vec<ColorRef>,
    pub variants: Vec<VariantDetail>,
    #[schema(required = true, nullable = true)]
    pub ban_effective_date: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardDetailResponse {
    pub data: CardDetail,
    pub meta: CardDetailResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CardDetailResponseMeta {
    pub source: CardDetailResponseMetaSource,
    pub content_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum CardDetailResponseMetaSource {
    Cache,
    Upstream,
    CacheRefreshed,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CardListItem {
    pub card_id: String,
    pub variant_number: VariantNumber,
    pub name: String,
    pub type_: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub super_: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_type: Option<String>,
    pub energy: i64,
    pub might: i64,
    pub power: i64,
    pub rarity: String,
    pub set_code: String,
    pub colors: Vec<String>,
    pub image_url: String,
    #[schema(required = true, nullable = true)]
    pub cardmarket_id: Option<i64>,
    #[schema(required = true, nullable = true)]
    pub price_eur: Option<PriceSummary>,
    pub printings: Vec<CardListPrinting>,
    pub is_banned: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CardListPrinting {
    pub variant_number: VariantNumber,
    pub variant_label: String,
    pub is_foil: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub foil_mode: Option<String>,
    #[schema(required = true, nullable = true)]
    pub price_eur: Option<PriceSummary>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CardsBatchRequest {
    pub variant_numbers: Vec<VariantNumber>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardsBatchResponse {
    pub data: Vec<CardDetail>,
    pub meta: CardsBatchResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CardsBatchResponseMeta {
    pub found: i64,
    pub not_found: Vec<String>,
    pub source: CardsBatchResponseMetaSource,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CardsBatchResponseMetaSource {
    Cache,
    Mixed,
    Upstream,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardsDetailQuery {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh: Option<QueryBooleanString>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CardsListQuery {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub q: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sets: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub colors: Option<String>,
    pub color_mode: CardsListQueryColorMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub types: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub super_: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variants: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rarities: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub energy_min: Option<Option<i64>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub energy_max: Option<Option<i64>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub power_min: Option<Option<i64>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub power_max: Option<Option<i64>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub might_min: Option<Option<i64>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub might_max: Option<Option<i64>>,
    pub page: i64,
    pub limit: i64,
    pub sort_by: CardsListQuerySortBy,
    pub dir: CardsListQueryDir,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh: Option<QueryBooleanString>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exclude_tokens: Option<QueryBooleanString>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exclude_banned: Option<QueryBooleanString>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CardsListQueryColorMode {
    All,
    Within,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum CardsListQuerySortBy {
    Name,
    Energy,
    VariantNumber,
    ReleaseDate,
    Price,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CardsListQueryDir {
    Asc,
    Desc,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CardsListResponse {
    pub data: Vec<CardListItem>,
    pub meta: CardsListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CardsListResponseMeta {
    pub pagination: Pagination,
    pub source: CardsListResponseMetaSource,
    pub catalog_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CardsListResponseMetaSource {
    Cache,
    Mixed,
    Upstream,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CatalogIndexResponse {
    pub data: Vec<CardListItem>,
    pub meta: CatalogIndexResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CatalogIndexResponseMeta {
    pub catalog_hash: String,
    pub prices_catalog_hash: String,
    pub total: i64,
    pub source: CatalogIndexResponseMetaSource,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CatalogIndexResponseMetaSource {
    Cache,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CatalogLayout {
    Grid,
    List,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionActivityCursor {
    pub at: String,
    pub id: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionActivityEvent {
    pub id: String,
    pub at: String,
    pub action: CollectionAuditAction,
    pub quantity_delta: i64,
    #[schema(required = true, nullable = true)]
    pub quantity_after: Option<i64>,
    #[schema(required = true, nullable = true)]
    pub is_foil: Option<bool>,
    pub actor: CollectionAuditActor,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionActivityHistoryRequest {
    pub variant_numbers: Vec<String>,
    pub limit: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<CollectionActivityCursor>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionActivityHistoryResponse {
    pub data: Vec<CollectionActivityEvent>,
    pub meta: CollectionActivityHistoryResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionActivityHistoryResponseMeta {
    pub has_more: bool,
    #[schema(required = true, nullable = true)]
    pub next_cursor: Option<CollectionActivityCursor>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionAdjustRequest {
    pub delta: i64,
    pub condition: CardCondition,
    pub language: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CollectionAuditAction {
    Add,
    Remove,
    Upsert,
    Delete,
    Clear,
    Batch,
    Import,
    ShareMerge,
    ShareDiscard,
    ShareLeave,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionAuditActor {
    pub user_id: String,
    #[schema(required = true, nullable = true)]
    pub name: Option<String>,
    #[schema(required = true, nullable = true)]
    pub email: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionAuditEvent {
    pub id: String,
    #[schema(required = true, nullable = true)]
    pub collection_id: Option<String>,
    pub action: CollectionAuditAction,
    #[schema(required = true, nullable = true)]
    pub variant_number: Option<String>,
    #[schema(required = true, nullable = true)]
    pub condition: Option<CardCondition>,
    #[schema(required = true, nullable = true)]
    pub language: Option<String>,
    #[schema(required = true, nullable = true)]
    pub is_foil: Option<bool>,
    #[schema(required = true, nullable = true)]
    pub quantity_before: Option<i64>,
    #[schema(required = true, nullable = true)]
    pub quantity_after: Option<i64>,
    #[schema(required = true, nullable = true)]
    pub quantity_delta: Option<i64>,
    #[schema(required = true, nullable = true)]
    pub metadata: Option<std::collections::BTreeMap<String, serde_json::Value>>,
    pub created_at: String,
    pub actor: CollectionAuditActor,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionAuditListQuery {
    pub limit: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mine: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<CollectionAuditAction>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionAuditListResponse {
    pub data: Vec<CollectionAuditEvent>,
    pub meta: CollectionAuditListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionAuditListResponseMeta {
    pub total: i64,
    pub limit: i64,
    pub has_more: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionBatchSyncRequest {
    pub items: Vec<CollectionUpsertRequest>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionBatchSyncResponse {
    pub data: CollectionBatchSyncResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionBatchSyncResponseData {
    pub synced: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionDeleteQuery {
    pub condition: CardCondition,
    pub language: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<QueryBooleanString>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CollectionImportMode {
    Set,
    Add,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionImportPreviewChange {
    pub variant_number: String,
    #[schema(required = true, nullable = true)]
    pub name: Option<String>,
    #[schema(required = true, nullable = true)]
    pub set_code: Option<String>,
    #[schema(required = true, nullable = true)]
    pub image_url: Option<String>,
    pub quantity_before: i64,
    pub quantity_after: i64,
    pub quantity_delta: i64,
    pub status: CollectionImportPreviewStatus,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionImportPreviewItem {
    pub variant_number: String,
    pub quantity: i64,
    pub condition: CardCondition,
    pub language: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportPreviewRequestVariant0 {
    pub tts: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportPreviewRequestVariant1 {
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
    pub data: CollectionImportPreviewResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionImportPreviewResponseData {
    pub total_tokens: i64,
    pub total_copies: i64,
    pub unique_printings: i64,
    pub unresolved_count: i64,
    pub new_count: i64,
    pub increased_count: i64,
    pub decreased_count: i64,
    pub unchanged_count: i64,
    pub changes: Vec<CollectionImportPreviewChange>,
    pub unresolved: Vec<CollectionImportPreviewResponseDataUnresolvedItem>,
    pub items: Vec<CollectionImportPreviewItem>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportPreviewResponseDataUnresolvedItem {
    pub token: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CollectionImportPreviewStatus {
    New,
    Increase,
    Decrease,
    Unchanged,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub csv: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tts: Option<String>,
    pub mode: CollectionImportMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<CollectionImportRequestItemsItem>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionImportRequestItemsItem {
    pub variant_number: String,
    pub quantity: i64,
    pub condition: CardCondition,
    pub language: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub notes: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_graded: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub grade_company: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub grade_score: Option<Option<String>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportResponse {
    pub data: CollectionImportResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionImportResponseData {
    pub imported: i64,
    pub total_copies: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rows_processed: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolved_from_upstream: Option<i64>,
    pub failed_rows: i64,
    pub errors: Vec<CollectionImportResponseDataErrorsItem>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionImportResponseDataErrorsItem {
    pub row: i64,
    pub message: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionItem {
    pub id: String,
    pub variant_number: String,
    pub quantity: i64,
    pub condition: CardCondition,
    pub language: String,
    pub is_foil: bool,
    #[schema(required = true, nullable = true)]
    pub notes: Option<String>,
    pub is_graded: bool,
    #[schema(required = true, nullable = true)]
    pub grade_company: Option<String>,
    #[schema(required = true, nullable = true)]
    pub grade_score: Option<String>,
    #[schema(required = true, nullable = true)]
    pub acquired_at: Option<String>,
    #[schema(required = true, nullable = true)]
    pub acquired_price_cents: Option<i64>,
    pub added_at: String,
    pub updated_at: String,
    pub name: String,
    pub image_url: String,
    pub set_code: String,
    pub rarity: String,
    #[schema(required = true, nullable = true)]
    pub type_: Option<String>,
    pub variant_label: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionItemResponse {
    pub data: CollectionItem,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionListResponse {
    pub data: Vec<CollectionItem>,
    pub meta: CollectionListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionListResponseMeta {
    pub total: i64,
    pub total_quantity: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CollectionLiveChangeReason {
    Upsert,
    Add,
    Remove,
    Delete,
    Clear,
    Batch,
    Import,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionLiveChangedEvent {
    pub type_: String,
    pub collection_id: String,
    pub reason: CollectionLiveChangeReason,
    pub actor_user_id: String,
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
#[serde(rename_all = "camelCase")]
pub struct CollectionLiveHeartbeatEvent {
    pub type_: String,
    pub at: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionLiveReadyEvent {
    pub type_: String,
    pub collection_id: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionQuantitiesRequest {
    pub variant_numbers: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionQuantitiesResponse {
    pub data: Vec<CollectionQuantityRow>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionQuantityRow {
    pub variant_number: String,
    pub is_foil: bool,
    pub quantity: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionRecentAddsResponse {
    pub data: Vec<CollectionActivityEvent>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CollectionShareAcceptMode {
    UseTheirs,
    Merge,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareAcceptRequest {
    pub mode: CollectionShareAcceptMode,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareAcceptResponse {
    pub data: CollectionShareStatus,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionShareInviteCreate {
    pub token: String,
    pub url: String,
    pub expires_at: IsoDateTimeString,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareInviteCreateResponse {
    pub data: CollectionShareInviteCreate,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionShareInvitePreview {
    pub token: String,
    pub expires_at: IsoDateTimeString,
    pub inviter: CollectionSharePerson,
    pub their_item_count: i64,
    pub their_total_quantity: i64,
    pub your_item_count: i64,
    pub your_total_quantity: i64,
    pub can_accept: bool,
    #[schema(required = true, nullable = true)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareInvitePreviewResponse {
    pub data: CollectionShareInvitePreview,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareLeaveResponse {
    pub data: CollectionShareStatus,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSharePartner {
    pub user_id: String,
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSharePendingInvite {
    pub expires_at: IsoDateTimeString,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSharePerson {
    pub user_id: String,
    pub name: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionShareStatus {
    pub shared: bool,
    pub member_count: i64,
    pub collection_id: String,
    pub role: CollectionShareStatusRole,
    #[schema(required = true, nullable = true)]
    pub partner: Option<CollectionSharePartner>,
    #[schema(required = true, nullable = true)]
    pub pending_invite: Option<CollectionSharePendingInvite>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CollectionShareStatusRole {
    Owner,
    Member,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CollectionShareStatusResponse {
    pub data: CollectionShareStatus,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CollectionUpsertRequest {
    pub variant_number: String,
    pub quantity: i64,
    pub condition: CardCondition,
    pub language: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub notes: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_graded: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub grade_company: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub grade_score: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub acquired_at: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub acquired_price_cents: Option<Option<i64>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ColorRef {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hex_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct CreateDeckVersionRequest {
    pub name: DeckVersionName,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeckCardInput {
    pub card_id: String,
    pub variant_number: String,
    pub name: String,
    pub type_: String,
    #[schema(required = true, nullable = true)]
    pub super_: Option<String>,
    pub tags: Vec<String>,
    pub colors: Vec<String>,
    pub energy: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub power: Option<i64>,
    pub set_code: String,
    pub rarity: String,
    pub variant_type: String,
    pub is_signature: bool,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub image_url: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub ban_effective_date: Option<Option<String>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckDetailResponse {
    pub data: DeckListItem,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckEntryInput {
    pub card: DeckCardInput,
    pub count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum DeckFormat {
    Constructed,
    PreRift,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeckListItem {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub format: DeckFormat,
    pub created_at: i64,
    pub updated_at: i64,
    #[schema(required = true, nullable = true)]
    pub legend: Option<DeckCardInput>,
    #[schema(required = true, nullable = true)]
    pub champion: Option<DeckCardInput>,
    pub main_deck: Vec<DeckEntryInput>,
    pub runes: Vec<DeckEntryInput>,
    pub battlefields: Vec<DeckEntryInput>,
    pub sideboard: Vec<DeckEntryInput>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upstream_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub imported_from_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sync_warnings: Option<Vec<String>>,
    pub source: DeckSource,
    pub read_only: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(nullable = true)]
    pub share_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub views: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub likes: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_legal: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub set_prefixes: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_guide: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_video: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_matchups: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub banned_card_names: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub versions: Option<Vec<DeckVersionSummary>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckListResponse {
    pub data: Vec<DeckListItem>,
    pub meta: DeckListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct DeckListResponseMeta {
    pub total: i64,
    pub owned: i64,
    pub imported: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pagination: Option<Pagination>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum DeckSortField {
    Trending,
    Likes,
    Views,
    CreatedAt,
    EditedAt,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum DeckSource {
    Owned,
    Imported,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UpdateDeckSharingRequest {
    pub enabled: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeckUpsertRequest {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub format: DeckFormat,
    pub created_at: i64,
    pub updated_at: i64,
    #[schema(required = true, nullable = true)]
    pub legend: Option<DeckCardInput>,
    #[schema(required = true, nullable = true)]
    pub champion: Option<DeckCardInput>,
    pub main_deck: Vec<DeckEntryInput>,
    pub runes: Vec<DeckEntryInput>,
    pub battlefields: Vec<DeckEntryInput>,
    pub sideboard: Vec<DeckEntryInput>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upstream_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub imported_from_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sync_warnings: Option<Vec<String>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DeckVersionSummary {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DecksListQuery {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub q: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub legend: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sets: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_legal: Option<QueryBooleanString>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_guide: Option<QueryBooleanString>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_video: Option<QueryBooleanString>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_matchups: Option<QueryBooleanString>,
    pub page: i64,
    pub limit: i64,
    pub sort: DeckSortField,
    pub dir: DecksListQueryDir,
    pub source: DecksListQuerySource,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<QueryBooleanString>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum DecksListQueryDir {
    Asc,
    Desc,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum DecksListQuerySource {
    Owned,
    Imported,
    All,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshot {
    pub colors: Vec<FilterSnapshotColorsItem>,
    pub sets: Vec<FilterSnapshotSetsItem>,
    pub types: Vec<FilterSnapshotTypesItem>,
    pub supertypes: Vec<FilterSnapshotSupertypesItem>,
    pub rarities: Vec<FilterSnapshotRaritiesItem>,
    pub variants: Vec<FilterSnapshotVariantsItem>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FilterSnapshotColorsItem {
    pub id: String,
    pub name: String,
    pub count: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FilterSnapshotSetsItem {
    pub id: String,
    pub name: String,
    pub count: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub print_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub foil_print_count: Option<i64>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshotTypesItem {
    pub id: String,
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshotSupertypesItem {
    pub id: String,
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshotRaritiesItem {
    pub id: String,
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FilterSnapshotVariantsItem {
    pub id: String,
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct FiltersResponse {
    pub data: FilterSnapshot,
    pub meta: FiltersResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FiltersResponseMeta {
    pub cached_at: IsoDateTimeString,
    pub catalog_hash: String,
    pub prices_catalog_hash: String,
    pub variant_count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchQuery {
    pub q: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub types: Option<String>,
    pub limit: i64,
    pub page: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchResponse {
    pub data: GlobalSearchResponseData,
    pub meta: GlobalSearchResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchResponseData {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cards: Option<GlobalSearchResponseDataCards>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decks: Option<GlobalSearchResponseDataDecks>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchResponseDataCards {
    pub hits: Vec<SearchHitCard>,
    pub total: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct GlobalSearchResponseDataDecks {
    pub hits: Vec<SearchHitDeck>,
    pub total: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSearchResponseMeta {
    pub took_ms: i64,
    pub catalog_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum GridCardSize {
    Large,
    Medium,
    Small,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct HealthResponse {
    pub data: HealthResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponseData {
    pub status: String,
    pub db: HealthResponseDataDb,
    #[schema(required = true, nullable = true)]
    pub last_catalog_sync: Option<IsoDateTimeString>,
    pub email_verification_required: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum HealthResponseDataDb {
    Ok,
    Error,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct IdData {
    pub id: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct IdResponse {
    pub data: IdData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct ImageThumbQuery {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub w: Option<i64>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct OkData {
    pub ok: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct OkResponse {
    pub data: OkData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaCardsBatchResponse {
    pub data: Vec<PaVariantListItem>,
    pub not_found: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaCardsListResponse {
    pub data: Vec<PaVariantListItem>,
    pub pagination: PaCardsListResponsePagination,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meta: Option<PaCardsListResponseMeta>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaCardsListResponsePagination {
    pub total: i64,
    pub page: i64,
    pub limit: i64,
    pub total_pages: i64,
    pub has_next: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_previous: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaCardsListResponseMeta {
    pub filters: std::collections::BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaColor {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hex_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaLogicalCard {
    pub id: String,
    pub name: String,
    pub type_: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub super_: Option<Option<String>>,
    pub description: String,
    pub energy: i64,
    pub might: i64,
    pub power: i64,
    pub tags: Vec<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub attach_text: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub effect: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub might_bonus: Option<f64>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub max_copies: Option<Option<f64>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub ban_effective_date: Option<Option<String>>,
    pub colors: Vec<PaColor>,
    pub variants: Vec<PaVariant>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaPriceRow {
    pub id: String,
    pub cardmarket_id: i64,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub tcg_player_id: Option<Option<i64>>,
    pub provider: String,
    pub is_foil: bool,
    pub currency: String,
    #[schema(required = true, nullable = true)]
    pub low_price: Option<String>,
    #[schema(required = true, nullable = true)]
    pub market_price: Option<String>,
    #[schema(required = true, nullable = true)]
    pub mid_price: Option<String>,
    #[schema(required = true, nullable = true)]
    pub high_price: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub direct_low_price: Option<Option<String>>,
    #[schema(required = true, nullable = true)]
    pub avg1_day: Option<String>,
    #[schema(required = true, nullable = true)]
    pub avg7_day: Option<String>,
    #[schema(required = true, nullable = true)]
    pub avg30_day: Option<String>,
    pub last_updated: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PaPricesListResponse {
    pub data: Vec<PaPriceRow>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaSet {
    pub id: String,
    pub name: String,
    pub prefix: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_date: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaVariant {
    pub id: String,
    pub variant_number: String,
    pub image_url: String,
    pub rarity: String,
    pub variant_type: String,
    pub foil_mode: String,
    pub variant_types: Vec<String>,
    pub show_in_library: bool,
    pub is_collectible: bool,
    pub variant_label: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub flavor_text: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub artist: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub release_date: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub cardmarket_id: Option<Option<i64>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub tcgplayer_id: Option<Option<i64>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub parent_variant_id: Option<Option<String>>,
    pub set: PaSet,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PaVariantListItem {
    pub id: String,
    pub variant_number: String,
    pub image_url: String,
    pub rarity: String,
    pub variant_type: String,
    pub foil_mode: String,
    pub variant_types: Vec<String>,
    pub show_in_library: bool,
    pub is_collectible: bool,
    pub variant_label: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub flavor_text: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub artist: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub release_date: Option<Option<String>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub cardmarket_id: Option<Option<i64>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub tcgplayer_id: Option<Option<i64>>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub parent_variant_id: Option<Option<String>>,
    pub set: PaSet,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub card: Option<Option<serde_json::Value>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Pagination {
    pub total: i64,
    pub page: i64,
    pub limit: i64,
    pub total_pages: i64,
    pub has_next: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_previous: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceDailyPoint {
    pub cardmarket_id: i64,
    pub is_foil: bool,
    pub provider: String,
    pub currency: String,
    pub price_date: IsoDateString,
    #[schema(required = true, nullable = true)]
    pub low_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub market_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub mid_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub high_price: Option<f64>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceHistoryQuery {
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub cardmarket_id: Option<Option<i64>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<QueryBooleanString>,
    pub days: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceHistoryResponse {
    pub data: Vec<PriceDailyPoint>,
    pub meta: PriceHistoryResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceHistoryResponseMeta {
    #[schema(required = true, nullable = true)]
    pub cardmarket_id: Option<i64>,
    #[schema(required = true, nullable = true)]
    pub is_foil: Option<bool>,
    pub days: i64,
    pub row_count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceRow {
    pub id: String,
    pub cardmarket_id: i64,
    pub is_foil: bool,
    pub provider: String,
    pub currency: String,
    #[schema(required = true, nullable = true)]
    pub low_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub market_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub mid_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub high_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub avg1_day: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub avg7_day: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub avg30_day: Option<f64>,
    pub last_updated: IsoDateTimeString,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceStats {
    pub variant_number: String,
    #[schema(required = true, nullable = true)]
    pub cardmarket_id: Option<i64>,
    pub is_foil: bool,
    pub currency: String,
    #[schema(required = true, nullable = true)]
    pub current_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub baseline_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub min_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub max_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub avg_price: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub listing_low: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub change_percent: Option<i64>,
    pub trend: PriceTrend,
    pub points: Vec<PriceDailyPoint>,
    pub days: i64,
    pub price_filter_label: String,
    pub price_source_note: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub target_price_cents: Option<Option<i64>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub below_target: Option<bool>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceStatsBatchRequest {
    pub items: Vec<PriceStatsBatchRequestItemsItem>,
    pub days: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceStatsBatchRequestItemsItem {
    pub variant_number: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<bool>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub target_price_cents: Option<Option<i64>>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PriceStatsBatchResponse {
    pub data: Vec<PriceStats>,
    pub meta: PriceStatsBatchResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceStatsBatchResponseMeta {
    pub days: i64,
    pub row_count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PriceSummary {
    pub currency: String,
    #[schema(required = true, nullable = true)]
    pub low: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub market: Option<f64>,
    #[schema(required = true, nullable = true)]
    pub avg7d: Option<f64>,
    pub is_foil: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum PriceTrend {
    Up,
    Down,
    Flat,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PricesListQuery {
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub cardmarket_id: Option<Option<i64>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_number: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_foil: Option<QueryBooleanString>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct PricesListResponse {
    pub data: Vec<PriceRow>,
    pub meta: PricesListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PricesListResponseMeta {
    pub prices_catalog_hash: String,
    #[schema(required = true, nullable = true)]
    pub last_synced_at: Option<IsoDateTimeString>,
    pub row_count: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct RenameDeckVersionRequest {
    pub name: DeckVersionName,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SearchEntityType {
    Cards,
    Decks,
    Navigation,
    Actions,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SearchHitCard {
    pub kind: String,
    pub variant_number: VariantNumber,
    pub name: String,
    pub image_url: String,
    pub set_code: String,
    pub type_: String,
    pub rarity: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_match: Option<f64>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SearchHitDeck {
    pub kind: String,
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_match: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SettingsDeviceProfile {
    Phone,
    Desktop,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncCatalogResponse {
    pub data: SyncCatalogResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SyncCatalogResponseData {
    pub changed: bool,
    pub pages: i64,
    pub variant_count: i64,
    pub hash: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncPricesResponse {
    pub data: SyncPricesResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SyncPricesResponseData {
    pub changed: bool,
    pub row_count: i64,
    pub product_count: i64,
    pub hash: String,
    pub source: String,
    pub game_id: i64,
    pub export_created_at: String,
    pub cardmarket_ids_backfilled: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncStatusResponse {
    pub data: SyncStatusResponseData,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct SyncStatusResponseData {
    pub catalog: SyncStatusResponseDataCatalog,
    pub prices: SyncStatusResponseDataPrices,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusResponseDataCatalog {
    #[schema(required = true, nullable = true)]
    pub last_run: Option<IsoDateTimeString>,
    pub status: SyncStatusResponseDataCatalogStatus,
    pub hash: String,
    pub variant_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatusResponseDataCatalogStatus {
    Idle,
    Running,
    Failed,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusResponseDataPrices {
    #[schema(required = true, nullable = true)]
    pub last_run: Option<IsoDateTimeString>,
    pub status: SyncStatusResponseDataPricesStatus,
    pub hash: String,
    pub row_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatusResponseDataPricesStatus {
    Idle,
    Running,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ThemePreference {
    Light,
    Dark,
    System,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    pub device: SettingsDeviceProfile,
    pub settings: UserSettingsPayload,
    #[schema(required = true, nullable = true)]
    pub updated_at: Option<IsoDateTimeString>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserSettingsPatch {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme: Option<ThemePreference>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accent_color: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_layout: Option<CatalogLayout>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grid_card_size: Option<GridCardSize>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserSettingsPayload {
    pub theme: ThemePreference,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accent_color: Option<String>,
    pub default_layout: CatalogLayout,
    pub grid_card_size: GridCardSize,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct UserSettingsResponse {
    pub data: UserSettings,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VariantDetail {
    pub id: String,
    pub variant_number: VariantNumber,
    pub rarity: String,
    pub variant_type: String,
    pub variant_label: String,
    pub foil_mode: String,
    pub image_url: String,
    #[schema(required = true, nullable = true)]
    pub cardmarket_id: Option<i64>,
    #[schema(required = true, nullable = true)]
    pub tcgplayer_id: Option<i64>,
    #[schema(required = true, nullable = true)]
    pub release_date: Option<String>,
    #[schema(required = true, nullable = true)]
    pub artist: Option<String>,
    pub prices: Vec<PriceSummary>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WishlistItem {
    pub id: String,
    pub variant_number: String,
    pub priority: i64,
    #[schema(required = true, nullable = true)]
    pub target_price_cents: Option<i64>,
    #[schema(required = true, nullable = true)]
    pub notes: Option<String>,
    pub added_at: String,
    pub name: String,
    pub image_url: String,
    pub set_code: String,
    pub rarity: String,
    pub variant_label: String,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct WishlistItemResponse {
    pub data: WishlistItem,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct WishlistListResponse {
    pub data: Vec<WishlistItem>,
    pub meta: WishlistListResponseMeta,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
pub struct WishlistListResponseMeta {
    pub total: i64,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WishlistUpsertRequest {
    pub variant_number: String,
    pub priority: i64,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "serde_with::rust::double_option"
    )]
    pub target_price_cents: Option<Option<i64>>,
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
    DeckSortField,
    DeckSource,
    UpdateDeckSharingRequest,
    DeckUpsertRequest,
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
