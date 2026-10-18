// Compile-time bidirectional checks between Rust wire types and Zod outputs.
import type { components } from '@riftbound/api-contracts';
import type { z } from 'zod';
import type * as C from './index.js';
type Assert<T extends true> = T;
// JSON omits undefined properties; Zod includes undefined explicitly on optional keys.
type FromWire<T> = T extends readonly (infer U)[]
  ? FromWire<U>[]
  : T extends object
    ? string extends keyof T
      ? { [K in keyof T]: FromWire<T[K]> }
      : {
          [K in keyof T]: Pick<T, K> extends Required<Pick<T, K>>
            ? FromWire<T[K]>
            : FromWire<T[K]> | undefined;
        }
    : T;
type Matches<A, B> = [A] extends [FromWire<B>]
  ? [FromWire<B>] extends [A]
    ? true
    : false
  : false;
export type CardConditionAlignment = Assert<
  Matches<z.output<typeof C.CardCondition>, components['schemas']['CardCondition']>
>;
export type CardDetailAlignment = Assert<
  Matches<z.output<typeof C.CardDetail>, components['schemas']['CardDetail']>
>;
export type CardDetailResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CardDetailResponse>,
    components['schemas']['CardDetailResponse']
  >
>;
export type CardListItemAlignment = Assert<
  Matches<z.output<typeof C.CardListItem>, components['schemas']['CardListItem']>
>;
export type CardListPrintingAlignment = Assert<
  Matches<
    z.output<typeof C.CardListPrinting>,
    components['schemas']['CardListPrinting']
  >
>;
export type CardsBatchRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CardsBatchRequest>,
    components['schemas']['CardsBatchRequest']
  >
>;
export type CardsBatchResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CardsBatchResponse>,
    components['schemas']['CardsBatchResponse']
  >
>;
export type CardsDetailQueryAlignment = Assert<
  Matches<
    z.output<typeof C.CardsDetailQuery>,
    components['schemas']['CardsDetailQuery']
  >
>;
export type CardsListQueryAlignment = Assert<
  Matches<z.output<typeof C.CardsListQuery>, components['schemas']['CardsListQuery']>
>;
export type CardsListResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CardsListResponse>,
    components['schemas']['CardsListResponse']
  >
>;
export type CatalogIndexResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CatalogIndexResponse>,
    components['schemas']['CatalogIndexResponse']
  >
>;
export type CatalogLayoutAlignment = Assert<
  Matches<z.output<typeof C.CatalogLayout>, components['schemas']['CatalogLayout']>
>;
export type CollectionActivityCursorAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionActivityCursor>,
    components['schemas']['CollectionActivityCursor']
  >
>;
export type CollectionActivityEventAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionActivityEvent>,
    components['schemas']['CollectionActivityEvent']
  >
>;
export type CollectionActivityHistoryRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionActivityHistoryRequest>,
    components['schemas']['CollectionActivityHistoryRequest']
  >
>;
export type CollectionActivityHistoryResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionActivityHistoryResponse>,
    components['schemas']['CollectionActivityHistoryResponse']
  >
>;
export type CollectionAdjustRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionAdjustRequest>,
    components['schemas']['CollectionAdjustRequest']
  >
>;
export type CollectionAuditActionAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionAuditAction>,
    components['schemas']['CollectionAuditAction']
  >
>;
export type CollectionAuditActorAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionAuditActor>,
    components['schemas']['CollectionAuditActor']
  >
>;
export type CollectionAuditEventAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionAuditEvent>,
    components['schemas']['CollectionAuditEvent']
  >
>;
export type CollectionAuditListQueryAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionAuditListQuery>,
    components['schemas']['CollectionAuditListQuery']
  >
>;
export type CollectionAuditListResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionAuditListResponse>,
    components['schemas']['CollectionAuditListResponse']
  >
>;
export type CollectionBatchSyncRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionBatchSyncRequest>,
    components['schemas']['CollectionBatchSyncRequest']
  >
>;
export type CollectionBatchSyncResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionBatchSyncResponse>,
    components['schemas']['CollectionBatchSyncResponse']
  >
>;
export type CollectionDeleteQueryAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionDeleteQuery>,
    components['schemas']['CollectionDeleteQuery']
  >
>;
export type CollectionImportModeAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionImportMode>,
    components['schemas']['CollectionImportMode']
  >
>;
export type CollectionImportPreviewChangeAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionImportPreviewChange>,
    components['schemas']['CollectionImportPreviewChange']
  >
>;
export type CollectionImportPreviewItemAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionImportPreviewItem>,
    components['schemas']['CollectionImportPreviewItem']
  >
>;
export type CollectionImportPreviewRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionImportPreviewRequest>,
    components['schemas']['CollectionImportPreviewRequest']
  >
>;
export type CollectionImportPreviewResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionImportPreviewResponse>,
    components['schemas']['CollectionImportPreviewResponse']
  >
>;
export type CollectionImportPreviewStatusAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionImportPreviewStatus>,
    components['schemas']['CollectionImportPreviewStatus']
  >
>;
export type CollectionImportRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionImportRequest>,
    components['schemas']['CollectionImportRequest']
  >
>;
export type CollectionImportResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionImportResponse>,
    components['schemas']['CollectionImportResponse']
  >
>;
export type CollectionItemAlignment = Assert<
  Matches<z.output<typeof C.CollectionItem>, components['schemas']['CollectionItem']>
>;
export type CollectionItemResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionItemResponse>,
    components['schemas']['CollectionItemResponse']
  >
>;
export type CollectionListResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionListResponse>,
    components['schemas']['CollectionListResponse']
  >
>;
export type CollectionLiveChangeReasonAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionLiveChangeReason>,
    components['schemas']['CollectionLiveChangeReason']
  >
>;
export type CollectionLiveChangedEventAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionLiveChangedEvent>,
    components['schemas']['CollectionLiveChangedEvent']
  >
>;
export type CollectionLiveEventAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionLiveEvent>,
    components['schemas']['CollectionLiveEvent']
  >
>;
export type CollectionLiveHeartbeatEventAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionLiveHeartbeatEvent>,
    components['schemas']['CollectionLiveHeartbeatEvent']
  >
>;
export type CollectionLiveReadyEventAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionLiveReadyEvent>,
    components['schemas']['CollectionLiveReadyEvent']
  >
>;
export type CollectionQuantitiesRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionQuantitiesRequest>,
    components['schemas']['CollectionQuantitiesRequest']
  >
>;
export type CollectionQuantitiesResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionQuantitiesResponse>,
    components['schemas']['CollectionQuantitiesResponse']
  >
>;
export type CollectionQuantityRowAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionQuantityRow>,
    components['schemas']['CollectionQuantityRow']
  >
>;
export type CollectionRecentAddsRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionRecentAddsRequest>,
    components['schemas']['CollectionRecentAddsRequest']
  >
>;
export type CollectionRecentAddsResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionRecentAddsResponse>,
    components['schemas']['CollectionRecentAddsResponse']
  >
>;
export type CollectionShareAcceptModeAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionShareAcceptMode>,
    components['schemas']['CollectionShareAcceptMode']
  >
>;
export type CollectionShareAcceptRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionShareAcceptRequest>,
    components['schemas']['CollectionShareAcceptRequest']
  >
>;
export type CollectionShareAcceptResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionShareAcceptResponse>,
    components['schemas']['CollectionShareAcceptResponse']
  >
>;
export type CollectionShareInviteCreateAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionShareInviteCreate>,
    components['schemas']['CollectionShareInviteCreate']
  >
>;
export type CollectionShareInviteCreateResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionShareInviteCreateResponse>,
    components['schemas']['CollectionShareInviteCreateResponse']
  >
>;
export type CollectionShareInvitePreviewAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionShareInvitePreview>,
    components['schemas']['CollectionShareInvitePreview']
  >
>;
export type CollectionShareInvitePreviewResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionShareInvitePreviewResponse>,
    components['schemas']['CollectionShareInvitePreviewResponse']
  >
>;
export type CollectionShareLeaveResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionShareLeaveResponse>,
    components['schemas']['CollectionShareLeaveResponse']
  >
>;
export type CollectionSharePartnerAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionSharePartner>,
    components['schemas']['CollectionSharePartner']
  >
>;
export type CollectionSharePendingInviteAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionSharePendingInvite>,
    components['schemas']['CollectionSharePendingInvite']
  >
>;
export type CollectionSharePersonAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionSharePerson>,
    components['schemas']['CollectionSharePerson']
  >
>;
export type CollectionShareStatusAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionShareStatus>,
    components['schemas']['CollectionShareStatus']
  >
>;
export type CollectionShareStatusResponseAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionShareStatusResponse>,
    components['schemas']['CollectionShareStatusResponse']
  >
>;
export type CollectionUpsertRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionUpsertRequest>,
    components['schemas']['CollectionUpsertRequest']
  >
>;
export type CollectionVariantNumbersRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CollectionVariantNumbersRequest>,
    components['schemas']['CollectionVariantNumbersRequest']
  >
>;
export type ColorRefAlignment = Assert<
  Matches<z.output<typeof C.ColorRef>, components['schemas']['ColorRef']>
>;
export type CreateDeckVersionRequestAlignment = Assert<
  Matches<
    z.output<typeof C.CreateDeckVersionRequest>,
    components['schemas']['CreateDeckVersionRequest']
  >
>;
export type DeckCardInputAlignment = Assert<
  Matches<z.output<typeof C.DeckCardInput>, components['schemas']['DeckCardInput']>
>;
export type DeckDetailResponseAlignment = Assert<
  Matches<
    z.output<typeof C.DeckDetailResponse>,
    components['schemas']['DeckDetailResponse']
  >
>;
export type DeckEntryInputAlignment = Assert<
  Matches<z.output<typeof C.DeckEntryInput>, components['schemas']['DeckEntryInput']>
>;
export type DeckFormatAlignment = Assert<
  Matches<z.output<typeof C.DeckFormat>, components['schemas']['DeckFormat']>
>;
export type DeckListItemAlignment = Assert<
  Matches<z.output<typeof C.DeckListItem>, components['schemas']['DeckListItem']>
>;
export type DeckListResponseAlignment = Assert<
  Matches<
    z.output<typeof C.DeckListResponse>,
    components['schemas']['DeckListResponse']
  >
>;
export type DeckRulesResponseAlignment = Assert<
  Matches<
    z.output<typeof C.DeckRulesResponse>,
    components['schemas']['DeckRulesResponse']
  >
>;
export type DeckSortFieldAlignment = Assert<
  Matches<z.output<typeof C.DeckSortField>, components['schemas']['DeckSortField']>
>;
export type DeckSourceAlignment = Assert<
  Matches<z.output<typeof C.DeckSource>, components['schemas']['DeckSource']>
>;
export type DeckUpsertRequestAlignment = Assert<
  Matches<
    z.output<typeof C.DeckUpsertRequest>,
    components['schemas']['DeckUpsertRequest']
  >
>;
export type DeckValidateInputAlignment = Assert<
  Matches<
    z.output<typeof C.DeckValidateInput>,
    components['schemas']['DeckValidateInput']
  >
>;
export type DeckValidateResponseAlignment = Assert<
  Matches<
    z.output<typeof C.DeckValidateResponse>,
    components['schemas']['DeckValidateResponse']
  >
>;
export type DeckValidationMessageAlignment = Assert<
  Matches<
    z.output<typeof C.DeckValidationMessage>,
    components['schemas']['DeckValidationMessage']
  >
>;
export type DeckVersionNameAlignment = Assert<
  Matches<z.output<typeof C.DeckVersionName>, components['schemas']['DeckVersionName']>
>;
export type DeckVersionSummaryAlignment = Assert<
  Matches<
    z.output<typeof C.DeckVersionSummary>,
    components['schemas']['DeckVersionSummary']
  >
>;
export type DecksListQueryAlignment = Assert<
  Matches<z.output<typeof C.DecksListQuery>, components['schemas']['DecksListQuery']>
>;
export type FilterSnapshotAlignment = Assert<
  Matches<z.output<typeof C.FilterSnapshot>, components['schemas']['FilterSnapshot']>
>;
export type FiltersResponseAlignment = Assert<
  Matches<z.output<typeof C.FiltersResponse>, components['schemas']['FiltersResponse']>
>;
export type GlobalSearchQueryAlignment = Assert<
  Matches<
    z.output<typeof C.GlobalSearchQuery>,
    components['schemas']['GlobalSearchQuery']
  >
>;
export type GlobalSearchResponseAlignment = Assert<
  Matches<
    z.output<typeof C.GlobalSearchResponse>,
    components['schemas']['GlobalSearchResponse']
  >
>;
export type GridCardSizeAlignment = Assert<
  Matches<z.output<typeof C.GridCardSize>, components['schemas']['GridCardSize']>
>;
export type HealthResponseAlignment = Assert<
  Matches<z.output<typeof C.HealthResponse>, components['schemas']['HealthResponse']>
>;
export type IdDataAlignment = Assert<
  Matches<z.output<typeof C.IdData>, components['schemas']['IdData']>
>;
export type IdResponseAlignment = Assert<
  Matches<z.output<typeof C.IdResponse>, components['schemas']['IdResponse']>
>;
export type ImageThumbQueryAlignment = Assert<
  Matches<z.output<typeof C.ImageThumbQuery>, components['schemas']['ImageThumbQuery']>
>;
export type IsoDateStringAlignment = Assert<
  Matches<z.output<typeof C.IsoDateString>, components['schemas']['IsoDateString']>
>;
export type IsoDateTimeStringAlignment = Assert<
  Matches<
    z.output<typeof C.IsoDateTimeString>,
    components['schemas']['IsoDateTimeString']
  >
>;
export type OkDataAlignment = Assert<
  Matches<z.output<typeof C.OkData>, components['schemas']['OkData']>
>;
export type OkResponseAlignment = Assert<
  Matches<z.output<typeof C.OkResponse>, components['schemas']['OkResponse']>
>;
export type PaCardsBatchResponseAlignment = Assert<
  Matches<
    z.output<typeof C.PaCardsBatchResponse>,
    components['schemas']['PaCardsBatchResponse']
  >
>;
export type PaCardsListResponseAlignment = Assert<
  Matches<
    z.output<typeof C.PaCardsListResponse>,
    components['schemas']['PaCardsListResponse']
  >
>;
export type PaColorAlignment = Assert<
  Matches<z.output<typeof C.PaColor>, components['schemas']['PaColor']>
>;
export type PaLogicalCardAlignment = Assert<
  Matches<z.output<typeof C.PaLogicalCard>, components['schemas']['PaLogicalCard']>
>;
export type PaPriceRowAlignment = Assert<
  Matches<z.output<typeof C.PaPriceRow>, components['schemas']['PaPriceRow']>
>;
export type PaPricesListResponseAlignment = Assert<
  Matches<
    z.output<typeof C.PaPricesListResponse>,
    components['schemas']['PaPricesListResponse']
  >
>;
export type PaSetAlignment = Assert<
  Matches<z.output<typeof C.PaSet>, components['schemas']['PaSet']>
>;
export type PaVariantAlignment = Assert<
  Matches<z.output<typeof C.PaVariant>, components['schemas']['PaVariant']>
>;
export type PaVariantListItemAlignment = Assert<
  Matches<
    z.output<typeof C.PaVariantListItem>,
    components['schemas']['PaVariantListItem']
  >
>;
export type PaginationAlignment = Assert<
  Matches<z.output<typeof C.Pagination>, components['schemas']['Pagination']>
>;
export type PriceDailyPointAlignment = Assert<
  Matches<z.output<typeof C.PriceDailyPoint>, components['schemas']['PriceDailyPoint']>
>;
export type PriceHistoryQueryAlignment = Assert<
  Matches<
    z.output<typeof C.PriceHistoryQuery>,
    components['schemas']['PriceHistoryQuery']
  >
>;
export type PriceHistoryResponseAlignment = Assert<
  Matches<
    z.output<typeof C.PriceHistoryResponse>,
    components['schemas']['PriceHistoryResponse']
  >
>;
export type PriceRowAlignment = Assert<
  Matches<z.output<typeof C.PriceRow>, components['schemas']['PriceRow']>
>;
export type PriceStatsAlignment = Assert<
  Matches<z.output<typeof C.PriceStats>, components['schemas']['PriceStats']>
>;
export type PriceStatsBatchRequestAlignment = Assert<
  Matches<
    z.output<typeof C.PriceStatsBatchRequest>,
    components['schemas']['PriceStatsBatchRequest']
  >
>;
export type PriceStatsBatchResponseAlignment = Assert<
  Matches<
    z.output<typeof C.PriceStatsBatchResponse>,
    components['schemas']['PriceStatsBatchResponse']
  >
>;
export type PriceSummaryAlignment = Assert<
  Matches<z.output<typeof C.PriceSummary>, components['schemas']['PriceSummary']>
>;
export type PriceTrendAlignment = Assert<
  Matches<z.output<typeof C.PriceTrend>, components['schemas']['PriceTrend']>
>;
export type PricesListQueryAlignment = Assert<
  Matches<z.output<typeof C.PricesListQuery>, components['schemas']['PricesListQuery']>
>;
export type PricesListResponseAlignment = Assert<
  Matches<
    z.output<typeof C.PricesListResponse>,
    components['schemas']['PricesListResponse']
  >
>;
export type QueryBooleanStringAlignment = Assert<
  Matches<
    z.output<typeof C.QueryBooleanString>,
    components['schemas']['QueryBooleanString']
  >
>;
export type RenameDeckVersionRequestAlignment = Assert<
  Matches<
    z.output<typeof C.RenameDeckVersionRequest>,
    components['schemas']['RenameDeckVersionRequest']
  >
>;
export type SearchEntityTypeAlignment = Assert<
  Matches<
    z.output<typeof C.SearchEntityType>,
    components['schemas']['SearchEntityType']
  >
>;
export type SearchHitCardAlignment = Assert<
  Matches<z.output<typeof C.SearchHitCard>, components['schemas']['SearchHitCard']>
>;
export type SearchHitDeckAlignment = Assert<
  Matches<z.output<typeof C.SearchHitDeck>, components['schemas']['SearchHitDeck']>
>;
export type SettingsDeviceProfileAlignment = Assert<
  Matches<
    z.output<typeof C.SettingsDeviceProfile>,
    components['schemas']['SettingsDeviceProfile']
  >
>;
export type StoredDeckPayloadAlignment = Assert<
  Matches<
    z.output<typeof C.StoredDeckPayload>,
    components['schemas']['StoredDeckPayload']
  >
>;
export type SyncCatalogResponseAlignment = Assert<
  Matches<
    z.output<typeof C.SyncCatalogResponse>,
    components['schemas']['SyncCatalogResponse']
  >
>;
export type SyncPricesResponseAlignment = Assert<
  Matches<
    z.output<typeof C.SyncPricesResponse>,
    components['schemas']['SyncPricesResponse']
  >
>;
export type SyncStatusResponseAlignment = Assert<
  Matches<
    z.output<typeof C.SyncStatusResponse>,
    components['schemas']['SyncStatusResponse']
  >
>;
export type ThemePreferenceAlignment = Assert<
  Matches<z.output<typeof C.ThemePreference>, components['schemas']['ThemePreference']>
>;
export type UserSettingsAlignment = Assert<
  Matches<z.output<typeof C.UserSettings>, components['schemas']['UserSettings']>
>;
export type UserSettingsPatchAlignment = Assert<
  Matches<
    z.output<typeof C.UserSettingsPatch>,
    components['schemas']['UserSettingsPatch']
  >
>;
export type UserSettingsPayloadAlignment = Assert<
  Matches<
    z.output<typeof C.UserSettingsPayload>,
    components['schemas']['UserSettingsPayload']
  >
>;
export type UserSettingsResponseAlignment = Assert<
  Matches<
    z.output<typeof C.UserSettingsResponse>,
    components['schemas']['UserSettingsResponse']
  >
>;
export type UserSettingsUpsertRequestAlignment = Assert<
  Matches<
    z.output<typeof C.UserSettingsUpsertRequest>,
    components['schemas']['UserSettingsUpsertRequest']
  >
>;
export type VariantDetailAlignment = Assert<
  Matches<z.output<typeof C.VariantDetail>, components['schemas']['VariantDetail']>
>;
export type VariantNumberAlignment = Assert<
  Matches<z.output<typeof C.VariantNumber>, components['schemas']['VariantNumber']>
>;
export type WishlistItemAlignment = Assert<
  Matches<z.output<typeof C.WishlistItem>, components['schemas']['WishlistItem']>
>;
export type WishlistItemResponseAlignment = Assert<
  Matches<
    z.output<typeof C.WishlistItemResponse>,
    components['schemas']['WishlistItemResponse']
  >
>;
export type WishlistListResponseAlignment = Assert<
  Matches<
    z.output<typeof C.WishlistListResponse>,
    components['schemas']['WishlistListResponse']
  >
>;
export type WishlistUpsertRequestAlignment = Assert<
  Matches<
    z.output<typeof C.WishlistUpsertRequest>,
    components['schemas']['WishlistUpsertRequest']
  >
>;
