use crate::*;
use serde_json::Value;
pub fn round_trip(name: &str, value: Value) -> Result<Value, serde_json::Error> {
    match name {
        "CardCondition" => serde_json::to_value(serde_json::from_value::<CardCondition>(value)?),
        "CardDetail" => serde_json::to_value(serde_json::from_value::<CardDetail>(value)?),
        "CardDetailResponse" => {
            serde_json::to_value(serde_json::from_value::<CardDetailResponse>(value)?)
        }
        "CardListItem" => serde_json::to_value(serde_json::from_value::<CardListItem>(value)?),
        "CardListPrinting" => {
            serde_json::to_value(serde_json::from_value::<CardListPrinting>(value)?)
        }
        "CardsBatchRequest" => {
            serde_json::to_value(serde_json::from_value::<CardsBatchRequest>(value)?)
        }
        "CardsBatchResponse" => {
            serde_json::to_value(serde_json::from_value::<CardsBatchResponse>(value)?)
        }
        "CardsDetailQuery" => {
            serde_json::to_value(serde_json::from_value::<CardsDetailQuery>(value)?)
        }
        "CardsListQuery" => serde_json::to_value(serde_json::from_value::<CardsListQuery>(value)?),
        "CardsListResponse" => {
            serde_json::to_value(serde_json::from_value::<CardsListResponse>(value)?)
        }
        "CatalogIndexResponse" => {
            serde_json::to_value(serde_json::from_value::<CatalogIndexResponse>(value)?)
        }
        "CatalogLayout" => serde_json::to_value(serde_json::from_value::<CatalogLayout>(value)?),
        "CollectionActivityCursor" => {
            serde_json::to_value(serde_json::from_value::<CollectionActivityCursor>(value)?)
        }
        "CollectionActivityEvent" => {
            serde_json::to_value(serde_json::from_value::<CollectionActivityEvent>(value)?)
        }
        "CollectionActivityHistoryRequest" => serde_json::to_value(serde_json::from_value::<
            CollectionActivityHistoryRequest,
        >(value)?),
        "CollectionActivityHistoryResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionActivityHistoryResponse,
        >(value)?),
        "CollectionAdjustRequest" => {
            serde_json::to_value(serde_json::from_value::<CollectionAdjustRequest>(value)?)
        }
        "CollectionAuditAction" => {
            serde_json::to_value(serde_json::from_value::<CollectionAuditAction>(value)?)
        }
        "CollectionAuditActor" => {
            serde_json::to_value(serde_json::from_value::<CollectionAuditActor>(value)?)
        }
        "CollectionAuditEvent" => {
            serde_json::to_value(serde_json::from_value::<CollectionAuditEvent>(value)?)
        }
        "CollectionAuditListQuery" => {
            serde_json::to_value(serde_json::from_value::<CollectionAuditListQuery>(value)?)
        }
        "CollectionAuditListResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionAuditListResponse,
        >(value)?),
        "CollectionBatchSyncRequest" => {
            serde_json::to_value(serde_json::from_value::<CollectionBatchSyncRequest>(value)?)
        }
        "CollectionBatchSyncResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionBatchSyncResponse,
        >(value)?),
        "CollectionDeleteQuery" => {
            serde_json::to_value(serde_json::from_value::<CollectionDeleteQuery>(value)?)
        }
        "CollectionImportMode" => {
            serde_json::to_value(serde_json::from_value::<CollectionImportMode>(value)?)
        }
        "CollectionImportPreviewChange" => serde_json::to_value(serde_json::from_value::<
            CollectionImportPreviewChange,
        >(value)?),
        "CollectionImportPreviewItem" => serde_json::to_value(serde_json::from_value::<
            CollectionImportPreviewItem,
        >(value)?),
        "CollectionImportPreviewRequest" => serde_json::to_value(serde_json::from_value::<
            CollectionImportPreviewRequest,
        >(value)?),
        "CollectionImportPreviewResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionImportPreviewResponse,
        >(value)?),
        "CollectionImportPreviewStatus" => serde_json::to_value(serde_json::from_value::<
            CollectionImportPreviewStatus,
        >(value)?),
        "CollectionImportRequest" => {
            serde_json::to_value(serde_json::from_value::<CollectionImportRequest>(value)?)
        }
        "CollectionImportResponse" => {
            serde_json::to_value(serde_json::from_value::<CollectionImportResponse>(value)?)
        }
        "CollectionItem" => serde_json::to_value(serde_json::from_value::<CollectionItem>(value)?),
        "CollectionItemResponse" => {
            serde_json::to_value(serde_json::from_value::<CollectionItemResponse>(value)?)
        }
        "CollectionListResponse" => {
            serde_json::to_value(serde_json::from_value::<CollectionListResponse>(value)?)
        }
        "CollectionLiveChangeReason" => {
            serde_json::to_value(serde_json::from_value::<CollectionLiveChangeReason>(value)?)
        }
        "CollectionLiveChangedEvent" => {
            serde_json::to_value(serde_json::from_value::<CollectionLiveChangedEvent>(value)?)
        }
        "CollectionLiveEvent" => {
            serde_json::to_value(serde_json::from_value::<CollectionLiveEvent>(value)?)
        }
        "CollectionLiveHeartbeatEvent" => serde_json::to_value(serde_json::from_value::<
            CollectionLiveHeartbeatEvent,
        >(value)?),
        "CollectionLiveReadyEvent" => {
            serde_json::to_value(serde_json::from_value::<CollectionLiveReadyEvent>(value)?)
        }
        "CollectionQuantitiesRequest" => serde_json::to_value(serde_json::from_value::<
            CollectionQuantitiesRequest,
        >(value)?),
        "CollectionQuantitiesResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionQuantitiesResponse,
        >(value)?),
        "CollectionQuantityRow" => {
            serde_json::to_value(serde_json::from_value::<CollectionQuantityRow>(value)?)
        }
        "CollectionRecentAddsRequest" => serde_json::to_value(serde_json::from_value::<
            CollectionRecentAddsRequest,
        >(value)?),
        "CollectionRecentAddsResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionRecentAddsResponse,
        >(value)?),
        "CollectionShareAcceptMode" => {
            serde_json::to_value(serde_json::from_value::<CollectionShareAcceptMode>(value)?)
        }
        "CollectionShareAcceptRequest" => serde_json::to_value(serde_json::from_value::<
            CollectionShareAcceptRequest,
        >(value)?),
        "CollectionShareAcceptResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionShareAcceptResponse,
        >(value)?),
        "CollectionShareInviteCreate" => serde_json::to_value(serde_json::from_value::<
            CollectionShareInviteCreate,
        >(value)?),
        "CollectionShareInviteCreateResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionShareInviteCreateResponse,
        >(value)?),
        "CollectionShareInvitePreview" => serde_json::to_value(serde_json::from_value::<
            CollectionShareInvitePreview,
        >(value)?),
        "CollectionShareInvitePreviewResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionShareInvitePreviewResponse,
        >(value)?),
        "CollectionShareLeaveResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionShareLeaveResponse,
        >(value)?),
        "CollectionSharePartner" => {
            serde_json::to_value(serde_json::from_value::<CollectionSharePartner>(value)?)
        }
        "CollectionSharePendingInvite" => serde_json::to_value(serde_json::from_value::<
            CollectionSharePendingInvite,
        >(value)?),
        "CollectionSharePerson" => {
            serde_json::to_value(serde_json::from_value::<CollectionSharePerson>(value)?)
        }
        "CollectionShareStatus" => {
            serde_json::to_value(serde_json::from_value::<CollectionShareStatus>(value)?)
        }
        "CollectionShareStatusResponse" => serde_json::to_value(serde_json::from_value::<
            CollectionShareStatusResponse,
        >(value)?),
        "CollectionUpsertRequest" => {
            serde_json::to_value(serde_json::from_value::<CollectionUpsertRequest>(value)?)
        }
        "CollectionVariantNumbersRequest" => serde_json::to_value(serde_json::from_value::<
            CollectionVariantNumbersRequest,
        >(value)?),
        "ColorRef" => serde_json::to_value(serde_json::from_value::<ColorRef>(value)?),
        "CreateDeckVersionRequest" => {
            serde_json::to_value(serde_json::from_value::<CreateDeckVersionRequest>(value)?)
        }
        "DeckCardInput" => serde_json::to_value(serde_json::from_value::<DeckCardInput>(value)?),
        "DeckDetailResponse" => {
            serde_json::to_value(serde_json::from_value::<DeckDetailResponse>(value)?)
        }
        "DeckEntryInput" => serde_json::to_value(serde_json::from_value::<DeckEntryInput>(value)?),
        "DeckFormat" => serde_json::to_value(serde_json::from_value::<DeckFormat>(value)?),
        "DeckListItem" => serde_json::to_value(serde_json::from_value::<DeckListItem>(value)?),
        "DeckListResponse" => {
            serde_json::to_value(serde_json::from_value::<DeckListResponse>(value)?)
        }
        "DeckRulesResponse" => {
            serde_json::to_value(serde_json::from_value::<DeckRulesResponse>(value)?)
        }
        "DeckSortField" => serde_json::to_value(serde_json::from_value::<DeckSortField>(value)?),
        "DeckSource" => serde_json::to_value(serde_json::from_value::<DeckSource>(value)?),
        "DeckUpsertRequest" => {
            serde_json::to_value(serde_json::from_value::<DeckUpsertRequest>(value)?)
        }
        "DeckValidateInput" => {
            serde_json::to_value(serde_json::from_value::<DeckValidateInput>(value)?)
        }
        "DeckValidateResponse" => {
            serde_json::to_value(serde_json::from_value::<DeckValidateResponse>(value)?)
        }
        "DeckValidationMessage" => {
            serde_json::to_value(serde_json::from_value::<DeckValidationMessage>(value)?)
        }
        "DeckVersionName" => {
            serde_json::to_value(serde_json::from_value::<DeckVersionName>(value)?)
        }
        "DeckVersionSummary" => {
            serde_json::to_value(serde_json::from_value::<DeckVersionSummary>(value)?)
        }
        "DecksListQuery" => serde_json::to_value(serde_json::from_value::<DecksListQuery>(value)?),
        "FilterSnapshot" => serde_json::to_value(serde_json::from_value::<FilterSnapshot>(value)?),
        "FiltersResponse" => {
            serde_json::to_value(serde_json::from_value::<FiltersResponse>(value)?)
        }
        "GlobalSearchQuery" => {
            serde_json::to_value(serde_json::from_value::<GlobalSearchQuery>(value)?)
        }
        "GlobalSearchResponse" => {
            serde_json::to_value(serde_json::from_value::<GlobalSearchResponse>(value)?)
        }
        "GridCardSize" => serde_json::to_value(serde_json::from_value::<GridCardSize>(value)?),
        "HealthResponse" => serde_json::to_value(serde_json::from_value::<HealthResponse>(value)?),
        "IdData" => serde_json::to_value(serde_json::from_value::<IdData>(value)?),
        "IdResponse" => serde_json::to_value(serde_json::from_value::<IdResponse>(value)?),
        "ImageThumbQuery" => {
            serde_json::to_value(serde_json::from_value::<ImageThumbQuery>(value)?)
        }
        "IsoDateString" => serde_json::to_value(serde_json::from_value::<IsoDateString>(value)?),
        "IsoDateTimeString" => {
            serde_json::to_value(serde_json::from_value::<IsoDateTimeString>(value)?)
        }
        "OkData" => serde_json::to_value(serde_json::from_value::<OkData>(value)?),
        "OkResponse" => serde_json::to_value(serde_json::from_value::<OkResponse>(value)?),
        "PaCardsBatchResponse" => {
            serde_json::to_value(serde_json::from_value::<PaCardsBatchResponse>(value)?)
        }
        "PaCardsListResponse" => {
            serde_json::to_value(serde_json::from_value::<PaCardsListResponse>(value)?)
        }
        "PaColor" => serde_json::to_value(serde_json::from_value::<PaColor>(value)?),
        "PaLogicalCard" => serde_json::to_value(serde_json::from_value::<PaLogicalCard>(value)?),
        "PaPriceRow" => serde_json::to_value(serde_json::from_value::<PaPriceRow>(value)?),
        "PaPricesListResponse" => {
            serde_json::to_value(serde_json::from_value::<PaPricesListResponse>(value)?)
        }
        "PaSet" => serde_json::to_value(serde_json::from_value::<PaSet>(value)?),
        "PaVariant" => serde_json::to_value(serde_json::from_value::<PaVariant>(value)?),
        "PaVariantListItem" => {
            serde_json::to_value(serde_json::from_value::<PaVariantListItem>(value)?)
        }
        "Pagination" => serde_json::to_value(serde_json::from_value::<Pagination>(value)?),
        "PriceDailyPoint" => {
            serde_json::to_value(serde_json::from_value::<PriceDailyPoint>(value)?)
        }
        "PriceHistoryQuery" => {
            serde_json::to_value(serde_json::from_value::<PriceHistoryQuery>(value)?)
        }
        "PriceHistoryResponse" => {
            serde_json::to_value(serde_json::from_value::<PriceHistoryResponse>(value)?)
        }
        "PriceRow" => serde_json::to_value(serde_json::from_value::<PriceRow>(value)?),
        "PriceStats" => serde_json::to_value(serde_json::from_value::<PriceStats>(value)?),
        "PriceStatsBatchRequest" => {
            serde_json::to_value(serde_json::from_value::<PriceStatsBatchRequest>(value)?)
        }
        "PriceStatsBatchResponse" => {
            serde_json::to_value(serde_json::from_value::<PriceStatsBatchResponse>(value)?)
        }
        "PriceSummary" => serde_json::to_value(serde_json::from_value::<PriceSummary>(value)?),
        "PriceTrend" => serde_json::to_value(serde_json::from_value::<PriceTrend>(value)?),
        "PricesListQuery" => {
            serde_json::to_value(serde_json::from_value::<PricesListQuery>(value)?)
        }
        "PricesListResponse" => {
            serde_json::to_value(serde_json::from_value::<PricesListResponse>(value)?)
        }
        "QueryBooleanString" => {
            serde_json::to_value(serde_json::from_value::<QueryBooleanString>(value)?)
        }
        "RenameDeckVersionRequest" => {
            serde_json::to_value(serde_json::from_value::<RenameDeckVersionRequest>(value)?)
        }
        "SearchEntityType" => {
            serde_json::to_value(serde_json::from_value::<SearchEntityType>(value)?)
        }
        "SearchHitCard" => serde_json::to_value(serde_json::from_value::<SearchHitCard>(value)?),
        "SearchHitDeck" => serde_json::to_value(serde_json::from_value::<SearchHitDeck>(value)?),
        "SettingsDeviceProfile" => {
            serde_json::to_value(serde_json::from_value::<SettingsDeviceProfile>(value)?)
        }
        "StoredDeckPayload" => {
            serde_json::to_value(serde_json::from_value::<StoredDeckPayload>(value)?)
        }
        "SyncCatalogResponse" => {
            serde_json::to_value(serde_json::from_value::<SyncCatalogResponse>(value)?)
        }
        "SyncPricesResponse" => {
            serde_json::to_value(serde_json::from_value::<SyncPricesResponse>(value)?)
        }
        "SyncStatusResponse" => {
            serde_json::to_value(serde_json::from_value::<SyncStatusResponse>(value)?)
        }
        "ThemePreference" => {
            serde_json::to_value(serde_json::from_value::<ThemePreference>(value)?)
        }
        "UserSettings" => serde_json::to_value(serde_json::from_value::<UserSettings>(value)?),
        "UserSettingsPatch" => {
            serde_json::to_value(serde_json::from_value::<UserSettingsPatch>(value)?)
        }
        "UserSettingsPayload" => {
            serde_json::to_value(serde_json::from_value::<UserSettingsPayload>(value)?)
        }
        "UserSettingsResponse" => {
            serde_json::to_value(serde_json::from_value::<UserSettingsResponse>(value)?)
        }
        "UserSettingsUpsertRequest" => {
            serde_json::to_value(serde_json::from_value::<UserSettingsUpsertRequest>(value)?)
        }
        "VariantDetail" => serde_json::to_value(serde_json::from_value::<VariantDetail>(value)?),
        "VariantNumber" => serde_json::to_value(serde_json::from_value::<VariantNumber>(value)?),
        "WishlistItem" => serde_json::to_value(serde_json::from_value::<WishlistItem>(value)?),
        "WishlistItemResponse" => {
            serde_json::to_value(serde_json::from_value::<WishlistItemResponse>(value)?)
        }
        "WishlistListResponse" => {
            serde_json::to_value(serde_json::from_value::<WishlistListResponse>(value)?)
        }
        "WishlistUpsertRequest" => {
            serde_json::to_value(serde_json::from_value::<WishlistUpsertRequest>(value)?)
        }
        _ => unreachable!("Unknown internal DTO"),
    }
}
