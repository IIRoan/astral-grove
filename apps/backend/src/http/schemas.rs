use super::zod as z;

pub fn schema(name: &str) -> z::Schema {
    match name {
        "CardCondition" => make_card_condition(),
        "CardDetail" => make_card_detail(),
        "CardDetailResponse" => make_card_detail_response(),
        "CardListItem" => make_card_list_item(),
        "CardListPrinting" => make_card_list_printing(),
        "CardsBatchRequest" => make_cards_batch_request(),
        "CardsBatchResponse" => make_cards_batch_response(),
        "CardsDetailQuery" => make_cards_detail_query(),
        "CardsListQuery" => make_cards_list_query(),
        "CardsListResponse" => make_cards_list_response(),
        "CatalogIndexResponse" => make_catalog_index_response(),
        "CatalogLayout" => make_catalog_layout(),
        "CollectionActivityCursor" => make_collection_activity_cursor(),
        "CollectionActivityEvent" => make_collection_activity_event(),
        "CollectionActivityHistoryRequest" => make_collection_activity_history_request(),
        "CollectionActivityHistoryResponse" => make_collection_activity_history_response(),
        "CollectionAdjustRequest" => make_collection_adjust_request(),
        "CollectionAuditAction" => make_collection_audit_action(),
        "CollectionAuditActor" => make_collection_audit_actor(),
        "CollectionAuditEvent" => make_collection_audit_event(),
        "CollectionAuditListQuery" => make_collection_audit_list_query(),
        "CollectionAuditListResponse" => make_collection_audit_list_response(),
        "CollectionBatchSyncRequest" => make_collection_batch_sync_request(),
        "CollectionBatchSyncResponse" => make_collection_batch_sync_response(),
        "CollectionDeleteQuery" => make_collection_delete_query(),
        "CollectionImportMode" => make_collection_import_mode(),
        "CollectionImportPreviewChange" => make_collection_import_preview_change(),
        "CollectionImportPreviewItem" => make_collection_import_preview_item(),
        "CollectionImportPreviewRequest" => make_collection_import_preview_request(),
        "CollectionImportPreviewResponse" => make_collection_import_preview_response(),
        "CollectionImportPreviewStatus" => make_collection_import_preview_status(),
        "CollectionImportRequest" => make_collection_import_request(),
        "CollectionImportResponse" => make_collection_import_response(),
        "CollectionItem" => make_collection_item(),
        "CollectionItemResponse" => make_collection_item_response(),
        "CollectionListResponse" => make_collection_list_response(),
        "CollectionLiveChangeReason" => make_collection_live_change_reason(),
        "CollectionLiveChangedEvent" => make_collection_live_changed_event(),
        "CollectionLiveEvent" => make_collection_live_event(),
        "CollectionLiveHeartbeatEvent" => make_collection_live_heartbeat_event(),
        "CollectionLiveReadyEvent" => make_collection_live_ready_event(),
        "CollectionQuantitiesRequest" => make_collection_quantities_request(),
        "CollectionQuantitiesResponse" => make_collection_quantities_response(),
        "CollectionQuantityRow" => make_collection_quantity_row(),
        "CollectionRecentAddsRequest" => make_collection_recent_adds_request(),
        "CollectionRecentAddsResponse" => make_collection_recent_adds_response(),
        "CollectionShareAcceptMode" => make_collection_share_accept_mode(),
        "CollectionShareAcceptRequest" => make_collection_share_accept_request(),
        "CollectionShareAcceptResponse" => make_collection_share_accept_response(),
        "CollectionShareInviteCreate" => make_collection_share_invite_create(),
        "CollectionShareInviteCreateResponse" => make_collection_share_invite_create_response(),
        "CollectionShareInvitePreview" => make_collection_share_invite_preview(),
        "CollectionShareInvitePreviewResponse" => make_collection_share_invite_preview_response(),
        "CollectionShareLeaveResponse" => make_collection_share_leave_response(),
        "CollectionSharePartner" => make_collection_share_partner(),
        "CollectionSharePendingInvite" => make_collection_share_pending_invite(),
        "CollectionSharePerson" => make_collection_share_person(),
        "CollectionShareStatus" => make_collection_share_status(),
        "CollectionShareStatusResponse" => make_collection_share_status_response(),
        "CollectionUpsertRequest" => make_collection_upsert_request(),
        "CollectionVariantNumbersRequest" => make_collection_variant_numbers_request(),
        "ColorRef" => make_color_ref(),
        "CreateDeckVersionRequest" => make_create_deck_version_request(),
        "DeckCardInput" => make_deck_card_input(),
        "DeckDetailResponse" => make_deck_detail_response(),
        "DeckEntryInput" => make_deck_entry_input(),
        "DeckFormat" => make_deck_format(),
        "DeckListItem" => make_deck_list_item(),
        "DeckListResponse" => make_deck_list_response(),
        "DeckRulesResponse" => make_deck_rules_response(),
        "DeckSortField" => make_deck_sort_field(),
        "DeckSource" => make_deck_source(),
        "DeckUpsertRequest" => make_deck_upsert_request(),
        "DeckValidateInput" => make_deck_validate_input(),
        "DeckValidateResponse" => make_deck_validate_response(),
        "DeckValidationMessage" => make_deck_validation_message(),
        "DeckVersionName" => make_deck_version_name(),
        "DeckVersionSummary" => make_deck_version_summary(),
        "DecksListQuery" => make_decks_list_query(),
        "FilterSnapshot" => make_filter_snapshot(),
        "FiltersResponse" => make_filters_response(),
        "GlobalSearchQuery" => make_global_search_query(),
        "GlobalSearchResponse" => make_global_search_response(),
        "GridCardSize" => make_grid_card_size(),
        "HealthResponse" => make_health_response(),
        "IdData" => make_id_data(),
        "IdResponse" => make_id_response(),
        "ImageThumbQuery" => make_image_thumb_query(),
        "IsoDateString" => make_iso_date_string(),
        "IsoDateTimeString" => make_iso_date_time_string(),
        "OkData" => make_ok_data(),
        "OkResponse" => make_ok_response(),
        "PaCardsBatchResponse" => make_pa_cards_batch_response(),
        "PaCardsListResponse" => make_pa_cards_list_response(),
        "PaColor" => make_pa_color(),
        "PaLogicalCard" => make_pa_logical_card(),
        "PaPriceRow" => make_pa_price_row(),
        "PaPricesListResponse" => make_pa_prices_list_response(),
        "PaSet" => make_pa_set(),
        "PaVariant" => make_pa_variant(),
        "PaVariantListItem" => make_pa_variant_list_item(),
        "Pagination" => make_pagination(),
        "PriceDailyPoint" => make_price_daily_point(),
        "PriceHistoryQuery" => make_price_history_query(),
        "PriceHistoryResponse" => make_price_history_response(),
        "PriceRow" => make_price_row(),
        "PriceStats" => make_price_stats(),
        "PriceStatsBatchRequest" => make_price_stats_batch_request(),
        "PriceStatsBatchResponse" => make_price_stats_batch_response(),
        "PriceSummary" => make_price_summary(),
        "PriceTrend" => make_price_trend(),
        "PricesListQuery" => make_prices_list_query(),
        "PricesListResponse" => make_prices_list_response(),
        "QueryBooleanString" => make_query_boolean_string(),
        "RenameDeckVersionRequest" => make_rename_deck_version_request(),
        "SearchEntityType" => make_search_entity_type(),
        "SearchHitCard" => make_search_hit_card(),
        "SearchHitDeck" => make_search_hit_deck(),
        "SettingsDeviceProfile" => make_settings_device_profile(),
        "StoredDeckPayload" => make_stored_deck_payload(),
        "SyncCatalogResponse" => make_sync_catalog_response(),
        "SyncPricesResponse" => make_sync_prices_response(),
        "SyncStatusResponse" => make_sync_status_response(),
        "ThemePreference" => make_theme_preference(),
        "UserSettings" => make_user_settings(),
        "UserSettingsPatch" => make_user_settings_patch(),
        "UserSettingsPayload" => make_user_settings_payload(),
        "UserSettingsResponse" => make_user_settings_response(),
        "UserSettingsUpsertRequest" => make_user_settings_upsert_request(),
        "VariantDetail" => make_variant_detail(),
        "VariantNumber" => make_variant_number(),
        "WishlistItem" => make_wishlist_item(),
        "WishlistItemResponse" => make_wishlist_item_response(),
        "WishlistListResponse" => make_wishlist_list_response(),
        "WishlistUpsertRequest" => make_wishlist_upsert_request(),
        _ => panic!("Unknown shared schema: {name}"),
    }
}
fn make_card_condition() -> z::Schema {
    z::enumeration(&[
        "mint",
        "near_mint",
        "lightly_played",
        "moderately_played",
        "heavily_played",
        "damaged",
        "unspecified",
    ])
}

fn make_card_detail() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("name", z::string()),
        ("type", z::string()),
        ("super", z::string().nullable()),
        ("description", z::string()),
        ("energy", z::number().int()),
        ("might", z::number().int()),
        ("power", z::number().int()),
        ("tags", z::array(z::string())),
        ("colors", z::array(schema("ColorRef"))),
        ("variants", z::array(schema("VariantDetail"))),
        ("banEffectiveDate", z::string().nullable()),
    ])
}

fn make_card_detail_response() -> z::Schema {
    z::object([
        ("data", schema("CardDetail")),
        (
            "meta",
            z::object([
                (
                    "source",
                    z::enumeration(&["cache", "upstream", "cache-refreshed"]),
                ),
                ("contentHash", z::string()),
            ]),
        ),
    ])
}

fn make_card_list_item() -> z::Schema {
    z::object([
        (
            "cardId",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("variantNumber", schema("VariantNumber")),
        ("name", z::string()),
        ("type", z::string()),
        ("super", z::string().nullable().optional()),
        ("variantType", z::string().optional()),
        ("energy", z::number().int()),
        ("might", z::number().int()),
        ("power", z::number().int()),
        ("rarity", z::string()),
        ("setCode", z::string()),
        ("colors", z::array(z::string())),
        ("imageUrl", z::string().url()),
        ("cardmarketId", z::number().int().nullable()),
        ("priceEur", schema("PriceSummary").nullable()),
        ("printings", z::array(schema("CardListPrinting")).min(1)),
        ("isBanned", z::boolean()),
    ])
}

fn make_card_list_printing() -> z::Schema {
    z::object([
        ("variantNumber", schema("VariantNumber")),
        ("variantLabel", z::string()),
        ("isFoil", z::boolean()),
        ("foilMode", z::string().optional()),
        ("priceEur", schema("PriceSummary").nullable()),
    ])
}

fn make_cards_batch_request() -> z::Schema {
    z::object([(
        "variantNumbers",
        z::array(schema("VariantNumber")).min(1).max(100),
    )])
}

fn make_cards_batch_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("CardDetail"))),
        (
            "meta",
            z::object([
                ("found", z::number().int()),
                ("notFound", z::array(z::string())),
                ("source", z::enumeration(&["cache", "mixed", "upstream"])),
            ]),
        ),
    ])
}

fn make_cards_detail_query() -> z::Schema {
    z::object([("refresh", schema("QueryBooleanString").optional())])
}

fn make_cards_list_query() -> z::Schema {
    z::object([
        ("q", z::string().max(200).optional()),
        ("sets", z::string().optional()),
        ("colors", z::string().optional()),
        (
            "colorMode",
            z::enumeration(&["all", "within"]).default(serde_json::json!("all")),
        ),
        ("types", z::string().optional()),
        ("super", z::string().optional()),
        ("variants", z::string().optional()),
        ("rarities", z::string().optional()),
        ("energyMin", z::coerce_number().int().optional()),
        ("energyMax", z::coerce_number().int().optional()),
        ("powerMin", z::coerce_number().int().optional()),
        ("powerMax", z::coerce_number().int().optional()),
        ("mightMin", z::coerce_number().int().optional()),
        ("mightMax", z::coerce_number().int().optional()),
        (
            "page",
            z::coerce_number()
                .int()
                .gt(0.0)
                .default(serde_json::json!(1)),
        ),
        (
            "limit",
            z::coerce_number()
                .int()
                .gt(0.0)
                .lte(100.0)
                .default(serde_json::json!(50)),
        ),
        (
            "sortBy",
            z::enumeration(&["name", "energy", "variantNumber", "releaseDate", "price"])
                .default(serde_json::json!("name")),
        ),
        (
            "dir",
            z::enumeration(&["asc", "desc"]).default(serde_json::json!("asc")),
        ),
        ("refresh", schema("QueryBooleanString").optional()),
        ("excludeTokens", schema("QueryBooleanString").optional()),
    ])
}

fn make_cards_list_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("CardListItem"))),
        (
            "meta",
            z::object([
                ("pagination", schema("Pagination")),
                ("source", z::enumeration(&["cache", "mixed", "upstream"])),
                ("catalogHash", z::string()),
            ]),
        ),
    ])
}

fn make_catalog_index_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("CardListItem"))),
        (
            "meta",
            z::object([
                ("catalogHash", z::string()),
                ("pricesCatalogHash", z::string()),
                ("total", z::number().int().gte(0.0)),
                ("source", z::enumeration(&["cache"])),
            ]),
        ),
    ])
}

fn make_catalog_layout() -> z::Schema {
    z::enumeration(&["grid", "list"])
}

fn make_collection_activity_cursor() -> z::Schema {
    z::object([
        ("at", z::string().datetime()),
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
    ])
}

fn make_collection_activity_event() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("at", z::string().datetime()),
        ("action", schema("CollectionAuditAction")),
        ("quantityDelta", z::number().int()),
        ("quantityAfter", z::number().int().nullable()),
        ("isFoil", z::boolean().nullable()),
        ("actor", schema("CollectionAuditActor")),
    ])
}

fn make_collection_activity_history_request() -> z::Schema {
    z::object([
        ("variantNumbers", z::array(z::string().min(1)).max(5000)),
        (
            "limit",
            z::number()
                .int()
                .gt(0.0)
                .lte(50.0)
                .default(serde_json::json!(20)),
        ),
        ("cursor", schema("CollectionActivityCursor").optional()),
    ])
}

fn make_collection_activity_history_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("CollectionActivityEvent")).max(50)),
        (
            "meta",
            z::object([
                ("hasMore", z::boolean()),
                ("nextCursor", schema("CollectionActivityCursor").nullable()),
            ]),
        ),
    ])
}

fn make_collection_adjust_request() -> z::Schema {
    z::object([
        (
            "delta",
            z::number()
                .int()
                .gt(0.0)
                .optional()
                .default(serde_json::json!(1)),
        ),
        (
            "condition",
            schema("CardCondition")
                .optional()
                .default(serde_json::json!("near_mint")),
        ),
        (
            "language",
            z::string()
                .max(16)
                .optional()
                .default(serde_json::json!("en")),
        ),
        ("isFoil", z::boolean().optional()),
    ])
}

fn make_collection_audit_action() -> z::Schema {
    z::enumeration(&[
        "add",
        "remove",
        "upsert",
        "delete",
        "clear",
        "batch",
        "import",
        "share_merge",
        "share_discard",
        "share_leave",
    ])
}

fn make_collection_audit_actor() -> z::Schema {
    z::object([
        ("userId", z::string().min(1)),
        ("name", z::string().nullable()),
        ("email", z::string().nullable()),
    ])
}

fn make_collection_audit_event() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        (
            "collectionId",
            z::string()
                .refine(
                    |value| value.as_str().is_some_and(super::valid_uuid),
                    "Invalid uuid",
                    &[],
                )
                .nullable(),
        ),
        ("action", schema("CollectionAuditAction")),
        ("variantNumber", z::string().nullable()),
        ("condition", schema("CardCondition").nullable()),
        ("language", z::string().nullable()),
        ("isFoil", z::boolean().nullable()),
        ("quantityBefore", z::number().int().nullable()),
        ("quantityAfter", z::number().int().nullable()),
        ("quantityDelta", z::number().int().nullable()),
        ("metadata", z::record().nullable()),
        ("createdAt", z::string().datetime()),
        ("actor", schema("CollectionAuditActor")),
    ])
}

fn make_collection_audit_list_query() -> z::Schema {
    z::object([
        (
            "limit",
            z::coerce_number()
                .int()
                .gt(0.0)
                .lte(200.0)
                .default(serde_json::json!(50)),
        ),
        ("before", z::string().datetime().optional()),
        ("variantNumber", z::string().min(1).optional()),
        ("actorUserId", z::string().min(1).optional()),
        (
            "mine",
            z::union(vec![
                z::boolean(),
                z::enumeration(&["true", "false", "1", "0"]),
            ])
            .optional()
            .transform(|value| {
                serde_json::json!(
                    value
                        .as_bool()
                        .unwrap_or_else(|| matches!(value.as_str(), Some("true" | "1")))
                )
            })
            .with_output_schema(serde_json::json!({"type":"boolean"})),
        ),
        ("action", schema("CollectionAuditAction").optional()),
    ])
}

fn make_collection_audit_list_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("CollectionAuditEvent"))),
        (
            "meta",
            z::object([
                ("total", z::number().int().gte(0.0)),
                ("limit", z::number().int().gt(0.0)),
                ("hasMore", z::boolean()),
            ]),
        ),
    ])
}

fn make_collection_batch_sync_request() -> z::Schema {
    z::object([(
        "items",
        z::array(schema("CollectionUpsertRequest")).max(500),
    )])
}

fn make_collection_batch_sync_response() -> z::Schema {
    z::object([("data", z::object([("synced", z::number().int().gte(0.0))]))])
}

fn make_collection_delete_query() -> z::Schema {
    z::object([
        (
            "condition",
            schema("CardCondition")
                .optional()
                .default(serde_json::json!("near_mint")),
        ),
        (
            "language",
            z::string()
                .max(16)
                .optional()
                .default(serde_json::json!("en")),
        ),
        ("isFoil", schema("QueryBooleanString").optional()),
    ])
}

fn make_collection_import_mode() -> z::Schema {
    z::enumeration(&["set", "add"])
}

fn make_collection_import_preview_change() -> z::Schema {
    z::object([
        ("variantNumber", z::string().min(1)),
        ("name", z::string().nullable()),
        ("setCode", z::string().nullable()),
        ("imageUrl", z::string().nullable()),
        ("quantityBefore", z::number().int().gte(0.0)),
        ("quantityAfter", z::number().int().gte(0.0)),
        ("quantityDelta", z::number().int()),
        ("status", schema("CollectionImportPreviewStatus")),
    ])
}

fn make_collection_import_preview_item() -> z::Schema {
    z::object([
        ("variantNumber", z::string().min(1)),
        ("quantity", z::number().int().gt(0.0)),
        (
            "condition",
            schema("CardCondition").default(serde_json::json!("near_mint")),
        ),
        (
            "language",
            z::string().max(16).default(serde_json::json!("en")),
        ),
        ("isFoil", z::boolean().optional()),
    ])
}

fn make_collection_import_preview_request() -> z::Schema {
    z::union(vec![
        z::object([("tts", z::string().min(1).max(512000))]),
        z::object([(
            "items",
            z::array(schema("CollectionImportPreviewItem"))
                .min(1)
                .max(2000),
        )]),
    ])
}

fn make_collection_import_preview_response() -> z::Schema {
    z::object([(
        "data",
        z::object([
            ("totalTokens", z::number().int().gte(0.0)),
            ("totalCopies", z::number().int().gte(0.0)),
            ("uniquePrintings", z::number().int().gte(0.0)),
            ("unresolvedCount", z::number().int().gte(0.0)),
            ("newCount", z::number().int().gte(0.0)),
            ("increasedCount", z::number().int().gte(0.0)),
            ("decreasedCount", z::number().int().gte(0.0)),
            ("unchangedCount", z::number().int().gte(0.0)),
            ("changes", z::array(schema("CollectionImportPreviewChange"))),
            (
                "unresolved",
                z::array(z::object([
                    ("token", z::string()),
                    ("message", z::string()),
                ])),
            ),
            (
                "items",
                z::array(schema("CollectionImportPreviewItem")).max(2000),
            ),
        ]),
    )])
}

fn make_collection_import_preview_status() -> z::Schema {
    z::enumeration(&["new", "increase", "decrease", "unchanged"])
}

fn make_collection_import_request() -> z::Schema {
    z::object([
        ("csv", z::string().min(1).max(512000).optional()),
        ("tts", z::string().min(1).max(512000).optional()),
        (
            "mode",
            schema("CollectionImportMode")
                .optional()
                .default(serde_json::json!("set")),
        ),
        (
            "items",
            z::array(z::object([
                ("variantNumber", z::string().min(1)),
                ("quantity", z::number().int().gt(0.0)),
                (
                    "condition",
                    schema("CardCondition").default(serde_json::json!("near_mint")),
                ),
                (
                    "language",
                    z::string().max(16).default(serde_json::json!("en")),
                ),
                ("isFoil", z::boolean().optional()),
                ("notes", z::string().max(2000).nullable().optional()),
                ("isGraded", z::boolean().optional()),
                ("gradeCompany", z::string().max(64).nullable().optional()),
                ("gradeScore", z::string().max(32).nullable().optional()),
            ]))
            .max(2000)
            .optional(),
        ),
    ])
}

fn make_collection_import_response() -> z::Schema {
    z::object([(
        "data",
        z::object([
            ("imported", z::number().int().gte(0.0)),
            ("totalCopies", z::number().int().gte(0.0)),
            ("rowsProcessed", z::number().int().gte(0.0).optional()),
            (
                "resolvedFromUpstream",
                z::number().int().gte(0.0).optional(),
            ),
            ("failedRows", z::number().int().gte(0.0)),
            (
                "errors",
                z::array(z::object([
                    ("row", z::number().int()),
                    ("message", z::string()),
                ])),
            ),
        ]),
    )])
}

fn make_collection_item() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("variantNumber", z::string()),
        ("quantity", z::number().int().gt(0.0)),
        ("condition", schema("CardCondition")),
        ("language", z::string()),
        ("isFoil", z::boolean()),
        ("notes", z::string().nullable()),
        ("isGraded", z::boolean()),
        ("gradeCompany", z::string().nullable()),
        ("gradeScore", z::string().nullable()),
        ("acquiredAt", z::string().datetime().nullable()),
        ("acquiredPriceCents", z::number().int().nullable()),
        ("addedAt", z::string().datetime()),
        ("updatedAt", z::string().datetime()),
        ("name", z::string()),
        ("imageUrl", z::string()),
        ("setCode", z::string()),
        ("rarity", z::string()),
        ("type", z::string().nullable()),
        ("variantLabel", z::string()),
    ])
}

fn make_collection_item_response() -> z::Schema {
    z::object([("data", schema("CollectionItem"))])
}

fn make_collection_list_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("CollectionItem"))),
        (
            "meta",
            z::object([
                ("total", z::number().int()),
                ("totalQuantity", z::number().int()),
            ]),
        ),
    ])
}

fn make_collection_live_change_reason() -> z::Schema {
    z::enumeration(&[
        "upsert", "add", "remove", "delete", "clear", "batch", "import",
    ])
}

fn make_collection_live_changed_event() -> z::Schema {
    z::object([
        (
            "type",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("collection.changed"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(
                    serde_json::json!({"type":"string","const":"collection.changed"}),
                ),
        ),
        (
            "collectionId",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("reason", schema("CollectionLiveChangeReason")),
        ("actorUserId", z::string().min(1)),
        ("at", z::string().datetime()),
    ])
}

fn make_collection_live_event() -> z::Schema {
    z::union(vec![
        schema("CollectionLiveChangedEvent"),
        schema("CollectionLiveReadyEvent"),
        schema("CollectionLiveHeartbeatEvent"),
    ])
}

fn make_collection_live_heartbeat_event() -> z::Schema {
    z::object([
        (
            "type",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("heartbeat"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(serde_json::json!({"type":"string","const":"heartbeat"})),
        ),
        ("at", z::string().datetime()),
    ])
}

fn make_collection_live_ready_event() -> z::Schema {
    z::object([
        (
            "type",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("ready"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(serde_json::json!({"type":"string","const":"ready"})),
        ),
        (
            "collectionId",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
    ])
}

fn make_collection_quantities_request() -> z::Schema {
    z::object([("variantNumbers", z::array(z::string().min(1)).max(5000))])
}

fn make_collection_quantities_response() -> z::Schema {
    z::object([("data", z::array(schema("CollectionQuantityRow")))])
}

fn make_collection_quantity_row() -> z::Schema {
    z::object([
        ("variantNumber", z::string()),
        ("isFoil", z::boolean()),
        ("quantity", z::number().int().gte(0.0)),
    ])
}

fn make_collection_recent_adds_request() -> z::Schema {
    z::object([("variantNumbers", z::array(z::string().min(1)).max(5000))])
}

fn make_collection_recent_adds_response() -> z::Schema {
    z::object([("data", z::array(schema("CollectionActivityEvent")).max(10))])
}

fn make_collection_share_accept_mode() -> z::Schema {
    z::enumeration(&["use_theirs", "merge"])
}

fn make_collection_share_accept_request() -> z::Schema {
    z::object([("mode", schema("CollectionShareAcceptMode"))])
}

fn make_collection_share_accept_response() -> z::Schema {
    z::object([("data", schema("CollectionShareStatus"))])
}

fn make_collection_share_invite_create() -> z::Schema {
    z::object([
        ("token", z::string()),
        ("url", z::string()),
        ("expiresAt", schema("IsoDateTimeString")),
    ])
}

fn make_collection_share_invite_create_response() -> z::Schema {
    z::object([("data", schema("CollectionShareInviteCreate"))])
}

fn make_collection_share_invite_preview() -> z::Schema {
    z::object([
        ("token", z::string()),
        ("expiresAt", schema("IsoDateTimeString")),
        ("inviter", schema("CollectionSharePerson")),
        ("theirItemCount", z::number().int().gte(0.0)),
        ("theirTotalQuantity", z::number().int().gte(0.0)),
        ("yourItemCount", z::number().int().gte(0.0)),
        ("yourTotalQuantity", z::number().int().gte(0.0)),
        ("canAccept", z::boolean()),
        ("reason", z::string().nullable()),
    ])
}

fn make_collection_share_invite_preview_response() -> z::Schema {
    z::object([("data", schema("CollectionShareInvitePreview"))])
}

fn make_collection_share_leave_response() -> z::Schema {
    z::object([("data", schema("CollectionShareStatus"))])
}

fn make_collection_share_partner() -> z::Schema {
    z::object([
        ("userId", z::string()),
        ("name", z::string()),
        ("email", z::string().email()),
    ])
}

fn make_collection_share_pending_invite() -> z::Schema {
    z::object([
        ("expiresAt", schema("IsoDateTimeString")),
        ("token", z::string().optional()),
        ("url", z::string().optional()),
    ])
}

fn make_collection_share_person() -> z::Schema {
    z::object([("userId", z::string()), ("name", z::string())])
}

fn make_collection_share_status() -> z::Schema {
    z::object([
        ("shared", z::boolean()),
        ("memberCount", z::number().int().gt(0.0)),
        (
            "collectionId",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("role", z::enumeration(&["owner", "member"])),
        ("partner", schema("CollectionSharePartner").nullable()),
        (
            "pendingInvite",
            schema("CollectionSharePendingInvite").nullable(),
        ),
    ])
}

fn make_collection_share_status_response() -> z::Schema {
    z::object([("data", schema("CollectionShareStatus"))])
}

fn make_collection_upsert_request() -> z::Schema {
    z::object([
        ("variantNumber", z::string().min(1)),
        (
            "quantity",
            z::number().int().gte(0.0).default(serde_json::json!(1)),
        ),
        (
            "condition",
            schema("CardCondition").default(serde_json::json!("near_mint")),
        ),
        (
            "language",
            z::string().max(16).default(serde_json::json!("en")),
        ),
        ("isFoil", z::boolean().optional()),
        ("notes", z::string().max(2000).nullable().optional()),
        ("isGraded", z::boolean().optional()),
        ("gradeCompany", z::string().max(64).nullable().optional()),
        ("gradeScore", z::string().max(32).nullable().optional()),
        ("acquiredAt", z::string().datetime().nullable().optional()),
        (
            "acquiredPriceCents",
            z::number().int().nullable().optional(),
        ),
    ])
}

fn make_collection_variant_numbers_request() -> z::Schema {
    z::object([("variantNumbers", z::array(z::string().min(1)).max(5000))])
}

fn make_color_ref() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("name", z::string()),
        ("hexCode", z::string().optional()),
        ("imageUrl", z::string().url().optional()),
    ])
}

fn make_create_deck_version_request() -> z::Schema {
    z::object([("name", schema("DeckVersionName"))])
}

fn make_deck_card_input() -> z::Schema {
    z::object([
        ("cardId", z::string()),
        ("variantNumber", z::string()),
        ("name", z::string()),
        ("type", z::string()),
        ("super", z::string().nullable()),
        ("tags", z::array(z::string())),
        ("colors", z::array(z::string())),
        ("energy", z::number()),
        ("power", z::number().int().optional()),
        ("setCode", z::string()),
        ("rarity", z::string()),
        ("variantType", z::string()),
        ("isSignature", z::boolean()),
        ("imageUrl", z::string().url().nullable().optional()),
        ("banEffectiveDate", z::string().nullable().optional()),
    ])
}

fn make_deck_detail_response() -> z::Schema {
    z::object([("data", schema("DeckListItem"))])
}

fn make_deck_entry_input() -> z::Schema {
    z::object([
        ("card", schema("DeckCardInput")),
        ("count", z::number().int().gt(0.0)),
    ])
}

fn make_deck_format() -> z::Schema {
    z::enumeration(&["constructed", "pre-rift"])
}

fn make_deck_list_item() -> z::Schema {
    z::object([
        ("id", z::string().min(1)),
        ("name", z::string()),
        ("description", z::string().optional()),
        (
            "format",
            schema("DeckFormat").default(serde_json::json!("constructed")),
        ),
        ("createdAt", z::number().int()),
        ("updatedAt", z::number().int()),
        ("legend", schema("DeckCardInput").nullable()),
        ("champion", schema("DeckCardInput").nullable()),
        ("mainDeck", z::array(schema("DeckEntryInput"))),
        ("runes", z::array(schema("DeckEntryInput"))),
        ("battlefields", z::array(schema("DeckEntryInput"))),
        ("sideboard", z::array(schema("DeckEntryInput"))),
        ("upstreamId", z::string().optional()),
        ("importedFromId", z::string().optional()),
        ("syncWarnings", z::array(z::string()).optional()),
        ("source", schema("DeckSource")),
        ("readOnly", z::boolean()),
        ("authorName", z::string().optional()),
        ("views", z::number().int().gte(0.0).optional()),
        ("likes", z::number().int().gte(0.0).optional()),
        ("isLegal", z::boolean().optional()),
        ("setPrefixes", z::array(z::string()).optional()),
        ("hasGuide", z::boolean().optional()),
        ("hasVideo", z::boolean().optional()),
        ("hasMatchups", z::boolean().optional()),
        ("videoUrl", z::string().optional()),
        ("bannedCardNames", z::array(z::string()).optional()),
        ("versionId", z::string().min(1).optional()),
        ("versionName", z::string().min(1).optional()),
        (
            "versions",
            z::array(schema("DeckVersionSummary")).optional(),
        ),
    ])
}

fn make_deck_list_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("DeckListItem"))),
        (
            "meta",
            z::object([
                ("total", z::number().int()),
                ("owned", z::number().int()),
                ("imported", z::number().int()),
                ("pagination", schema("Pagination").optional()),
            ]),
        ),
    ])
}

fn make_deck_rules_response() -> z::Schema {
    z::object([(
        "data",
        z::object([
            ("version", z::string()),
            (
                "rules",
                z::object([
                    ("version", z::string()),
                    ("game", z::string()),
                    ("format", z::string()),
                    (
                        "sections",
                        z::record_values(z::object([
                            ("key", z::string()),
                            ("title", z::string()),
                            ("target", z::number().int()),
                            ("single", z::boolean().optional()),
                            ("minimum", z::number().int().optional()),
                            ("exact", z::boolean().optional()),
                            ("maximum", z::number().int().optional()),
                            ("required", z::boolean()),
                            ("uniqueNames", z::boolean().optional()),
                            ("description", z::string()),
                        ])),
                    ),
                    (
                        "copyLimits",
                        z::object([
                            ("default", z::number().int().nullable()),
                            ("rune", z::number().int()),
                            ("battlefieldPerName", z::number().int()),
                            ("signatureTotal", z::number().int().nullable()),
                        ]),
                    ),
                    ("maxDomains", z::number().int().nullable().optional()),
                    ("requireChampionTagMatch", z::boolean().optional()),
                    ("requireSignatureTagMatch", z::boolean().optional()),
                    ("restrictPicker", z::boolean().optional()),
                    (
                        "constraints",
                        z::array(z::object([("code", z::string()), ("message", z::string())])),
                    ),
                ]),
            ),
        ]),
    )])
}

fn make_deck_sort_field() -> z::Schema {
    z::enumeration(&["trending", "likes", "views", "createdAt", "editedAt"])
}

fn make_deck_source() -> z::Schema {
    z::enumeration(&["owned", "imported"])
}

fn make_deck_upsert_request() -> z::Schema {
    z::object([
        ("id", z::string().min(1)),
        ("name", z::string()),
        ("description", z::string().optional()),
        (
            "format",
            schema("DeckFormat").default(serde_json::json!("constructed")),
        ),
        ("createdAt", z::number().int()),
        ("updatedAt", z::number().int()),
        ("legend", schema("DeckCardInput").nullable()),
        ("champion", schema("DeckCardInput").nullable()),
        ("mainDeck", z::array(schema("DeckEntryInput"))),
        ("runes", z::array(schema("DeckEntryInput"))),
        ("battlefields", z::array(schema("DeckEntryInput"))),
        ("sideboard", z::array(schema("DeckEntryInput"))),
        ("upstreamId", z::string().optional()),
        ("importedFromId", z::string().optional()),
        ("syncWarnings", z::array(z::string()).optional()),
    ])
}

fn make_deck_validate_input() -> z::Schema {
    z::object([
        (
            "format",
            schema("DeckFormat").default(serde_json::json!("constructed")),
        ),
        ("legend", schema("DeckCardInput").nullable()),
        ("champion", schema("DeckCardInput").nullable()),
        ("mainDeck", z::array(schema("DeckEntryInput"))),
        ("runes", z::array(schema("DeckEntryInput"))),
        ("battlefields", z::array(schema("DeckEntryInput"))),
        ("sideboard", z::array(schema("DeckEntryInput"))),
    ])
}

fn make_deck_validate_response() -> z::Schema {
    z::object([(
        "data",
        z::object([
            ("messages", z::array(schema("DeckValidationMessage"))),
            ("valid", z::boolean()),
            ("hasErrors", z::boolean()),
        ]),
    )])
}

fn make_deck_validation_message() -> z::Schema {
    z::object([
        ("type", z::enumeration(&["error", "warning", "valid"])),
        ("code", z::string()),
        ("message", z::string()),
    ])
}

fn make_deck_version_name() -> z::Schema {
    z::string().trim().min(1).max(60)
}

fn make_deck_version_summary() -> z::Schema {
    z::object([
        ("id", z::string().min(1)),
        ("name", z::string().min(1)),
        ("createdAt", z::number().int()),
        ("updatedAt", z::number().int()),
        ("isActive", z::boolean()),
    ])
}

fn make_decks_list_query() -> z::Schema {
    z::object([
        ("q", z::string().max(200).optional()),
        ("legend", z::string().optional()),
        ("sets", z::string().optional()),
        ("isLegal", schema("QueryBooleanString").optional()),
        ("hasGuide", schema("QueryBooleanString").optional()),
        ("hasVideo", schema("QueryBooleanString").optional()),
        ("hasMatchups", schema("QueryBooleanString").optional()),
        (
            "page",
            z::coerce_number()
                .int()
                .gt(0.0)
                .default(serde_json::json!(1)),
        ),
        (
            "limit",
            z::coerce_number()
                .int()
                .gt(0.0)
                .lte(50.0)
                .default(serde_json::json!(25)),
        ),
        (
            "sort",
            schema("DeckSortField").default(serde_json::json!("trending")),
        ),
        (
            "dir",
            z::enumeration(&["asc", "desc"]).default(serde_json::json!("desc")),
        ),
        (
            "source",
            z::enumeration(&["owned", "imported", "all"]).default(serde_json::json!("all")),
        ),
        ("preview", schema("QueryBooleanString").optional()),
    ])
}

fn make_filter_snapshot() -> z::Schema {
    z::object([
        (
            "colors",
            z::array(z::object([
                ("id", z::string()),
                ("name", z::string()),
                ("count", z::number().int()),
                ("imageUrl", z::string().optional()),
            ])),
        ),
        (
            "sets",
            z::array(z::object([
                ("id", z::string()),
                ("name", z::string()),
                ("count", z::number().int()),
                ("code", z::string().optional()),
                ("printCount", z::number().int().optional()),
                ("foilPrintCount", z::number().int().optional()),
            ])),
        ),
        (
            "types",
            z::array(z::object([
                ("id", z::string()),
                ("name", z::string()),
                ("count", z::number().int()),
            ])),
        ),
        (
            "supertypes",
            z::array(z::object([
                ("id", z::string()),
                ("name", z::string()),
                ("count", z::number().int()),
            ])),
        ),
        (
            "rarities",
            z::array(z::object([
                ("id", z::string()),
                ("name", z::string()),
                ("count", z::number().int()),
            ])),
        ),
        (
            "variants",
            z::array(z::object([
                ("id", z::string()),
                ("name", z::string()),
                ("count", z::number().int()),
            ])),
        ),
    ])
}

fn make_filters_response() -> z::Schema {
    z::object([
        ("data", schema("FilterSnapshot")),
        (
            "meta",
            z::object([
                ("cachedAt", schema("IsoDateTimeString")),
                ("catalogHash", z::string()),
                ("pricesCatalogHash", z::string()),
                ("variantCount", z::number().int().gte(0.0)),
            ]),
        ),
    ])
}

fn make_global_search_query() -> z::Schema {
    z::object([
        ("q", z::string().min(1).max(200)),
        ("types", z::string().optional()),
        (
            "limit",
            z::coerce_number()
                .int()
                .gt(0.0)
                .lte(50.0)
                .default(serde_json::json!(10)),
        ),
        (
            "page",
            z::coerce_number()
                .int()
                .gt(0.0)
                .default(serde_json::json!(1)),
        ),
    ])
}

fn make_global_search_response() -> z::Schema {
    z::object([
        (
            "data",
            z::object([
                (
                    "cards",
                    z::object([
                        ("hits", z::array(schema("SearchHitCard"))),
                        ("total", z::number().int().gte(0.0)),
                    ])
                    .optional(),
                ),
                (
                    "decks",
                    z::object([
                        ("hits", z::array(schema("SearchHitDeck"))),
                        ("total", z::number().int().gte(0.0)),
                    ])
                    .optional(),
                ),
            ]),
        ),
        (
            "meta",
            z::object([
                ("tookMs", z::number().int().gte(0.0)),
                ("catalogHash", z::string()),
            ]),
        ),
    ])
}

fn make_grid_card_size() -> z::Schema {
    z::enumeration(&["large", "medium", "small"])
}

fn make_health_response() -> z::Schema {
    z::object([(
        "data",
        z::object([
            (
                "status",
                z::string()
                    .refine(
                        |value| value == &serde_json::json!("ok"),
                        "Invalid literal",
                        &[],
                    )
                    .with_json_schema(serde_json::json!({"type":"string","const":"ok"})),
            ),
            ("db", z::enumeration(&["ok", "error"])),
            ("lastCatalogSync", schema("IsoDateTimeString").nullable()),
            ("emailVerificationRequired", z::boolean()),
        ]),
    )])
}

fn make_id_data() -> z::Schema {
    z::object([("id", z::string().min(1))])
}

fn make_id_response() -> z::Schema {
    z::object([("data", schema("IdData"))])
}

fn make_image_thumb_query() -> z::Schema {
    z::object([(
        "w",
        z::preprocess(super::thumb_width, z::number().int().optional())
            .with_output_schema(serde_json::json!({"type":"integer","enum":[96,160,240,320]})),
    )])
}

fn make_iso_date_string() -> z::Schema {
    z::string().refine(
        |value| value.as_str().is_some_and(super::valid_date),
        "Invalid date",
        &[],
    )
}

fn make_iso_date_time_string() -> z::Schema {
    z::string().datetime()
}

fn make_ok_data() -> z::Schema {
    z::object([(
        "ok",
        z::boolean()
            .refine(
                |value| value == &serde_json::json!(true),
                "Invalid literal",
                &[],
            )
            .with_json_schema(serde_json::json!({"type":"boolean","const":true})),
    )])
}

fn make_ok_response() -> z::Schema {
    z::object([("data", schema("OkData"))])
}

fn make_pa_cards_batch_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("PaVariantListItem"))),
        ("notFound", z::array(z::string())),
    ])
}

fn make_pa_cards_list_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("PaVariantListItem"))),
        (
            "pagination",
            z::object([
                ("total", z::number().int()),
                ("page", z::number().int()),
                ("limit", z::number().int()),
                ("totalPages", z::number().int()),
                ("hasNext", z::boolean()),
                ("hasPrevious", z::boolean().optional()),
            ]),
        ),
        ("meta", z::object([("filters", z::record())]).optional()),
    ])
}

fn make_pa_color() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("name", z::string()),
        ("hexCode", z::string().optional()),
        ("imageUrl", z::string().url().optional()),
    ])
}

fn make_pa_logical_card() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("name", z::string()),
        ("type", z::string()),
        ("super", z::string().nullable().optional()),
        (
            "description",
            z::preprocess(
                |value| {
                    Some(
                        value
                            .filter(|v| !v.is_null())
                            .cloned()
                            .unwrap_or_else(|| serde_json::json!("")),
                    )
                },
                z::string(),
            ),
        ),
        ("energy", z::number().int()),
        ("might", z::number().int()),
        ("power", z::number().int()),
        (
            "tags",
            z::preprocess(
                |value| {
                    Some(
                        value
                            .filter(|v| !v.is_null())
                            .cloned()
                            .unwrap_or_else(|| serde_json::json!([])),
                    )
                },
                z::array(z::string()),
            ),
        ),
        ("attachText", z::string().nullable().optional()),
        ("effect", z::string().nullable().optional()),
        ("mightBonus", z::number().optional()),
        ("maxCopies", z::number().nullable().optional()),
        ("banEffectiveDate", z::string().nullable().optional()),
        ("colors", z::array(schema("PaColor"))),
        ("variants", z::array(schema("PaVariant"))),
    ])
}

fn make_pa_price_row() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("cardmarketId", z::number().int()),
        ("tcgPlayerId", z::number().int().nullable().optional()),
        ("provider", z::string()),
        ("isFoil", z::boolean()),
        ("currency", z::string()),
        ("lowPrice", z::string().nullable()),
        ("marketPrice", z::string().nullable()),
        ("midPrice", z::string().nullable()),
        ("highPrice", z::string().nullable()),
        ("directLowPrice", z::string().nullable().optional()),
        ("avg1Day", z::string().nullable()),
        ("avg7Day", z::string().nullable()),
        ("avg30Day", z::string().nullable()),
        ("lastUpdated", z::string()),
    ])
}

fn make_pa_prices_list_response() -> z::Schema {
    z::object([("data", z::array(schema("PaPriceRow")))])
}

fn make_pa_set() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("name", z::string()),
        ("prefix", z::string()),
        ("releaseDate", z::string().optional()),
    ])
}

fn make_pa_variant() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("variantNumber", z::string()),
        ("imageUrl", z::string()),
        ("rarity", z::string()),
        ("variantType", z::string()),
        ("foilMode", z::string()),
        ("variantTypes", z::array(z::string())),
        ("showInLibrary", z::boolean()),
        ("isCollectible", z::boolean()),
        (
            "variantLabel",
            z::preprocess(
                |value| {
                    Some(
                        value
                            .filter(|v| !v.is_null())
                            .cloned()
                            .unwrap_or_else(|| serde_json::json!("Standard")),
                    )
                },
                z::string(),
            ),
        ),
        ("flavorText", z::string().nullable().optional()),
        ("artist", z::string().nullable().optional()),
        ("releaseDate", z::string().nullable().optional()),
        ("cardmarketId", z::number().int().nullable().optional()),
        ("tcgplayerId", z::number().int().nullable().optional()),
        (
            "parentVariantId",
            z::string()
                .refine(
                    |value| value.as_str().is_some_and(super::valid_uuid),
                    "Invalid uuid",
                    &[],
                )
                .nullable()
                .optional(),
        ),
        ("set", schema("PaSet")),
    ])
}

fn make_pa_variant_list_item() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("variantNumber", z::string()),
        ("imageUrl", z::string()),
        ("rarity", z::string()),
        ("variantType", z::string()),
        ("foilMode", z::string()),
        ("variantTypes", z::array(z::string())),
        ("showInLibrary", z::boolean()),
        ("isCollectible", z::boolean()),
        (
            "variantLabel",
            z::preprocess(
                |value| {
                    Some(
                        value
                            .filter(|v| !v.is_null())
                            .cloned()
                            .unwrap_or_else(|| serde_json::json!("Standard")),
                    )
                },
                z::string(),
            ),
        ),
        ("flavorText", z::string().nullable().optional()),
        ("artist", z::string().nullable().optional()),
        ("releaseDate", z::string().nullable().optional()),
        ("cardmarketId", z::number().int().nullable().optional()),
        ("tcgplayerId", z::number().int().nullable().optional()),
        (
            "parentVariantId",
            z::string()
                .refine(
                    |value| value.as_str().is_some_and(super::valid_uuid),
                    "Invalid uuid",
                    &[],
                )
                .nullable()
                .optional(),
        ),
        ("set", schema("PaSet")),
        ("card", z::any().optional()),
    ])
}

fn make_pagination() -> z::Schema {
    z::object([
        ("total", z::number().int().gte(0.0)),
        ("page", z::number().int().gt(0.0)),
        ("limit", z::number().int().gt(0.0)),
        ("totalPages", z::number().int().gte(0.0)),
        ("hasNext", z::boolean()),
        ("hasPrevious", z::boolean().optional()),
    ])
}

fn make_price_daily_point() -> z::Schema {
    z::object([
        ("cardmarketId", z::number().int()),
        ("isFoil", z::boolean()),
        (
            "provider",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("cardmarket"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(serde_json::json!({"type":"string","const":"cardmarket"})),
        ),
        (
            "currency",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("EUR"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(serde_json::json!({"type":"string","const":"EUR"})),
        ),
        ("priceDate", schema("IsoDateString")),
        ("lowPrice", z::number().nullable()),
        ("marketPrice", z::number().nullable()),
        ("midPrice", z::number().nullable()),
        ("highPrice", z::number().nullable()),
    ])
}

fn make_price_history_query() -> z::Schema {
    z::object([
        ("cardmarketId", z::coerce_number().int().optional()),
        ("variantNumber", z::string().optional()),
        ("isFoil", schema("QueryBooleanString").optional()),
        (
            "days",
            z::coerce_number()
                .int()
                .gt(0.0)
                .lte(365.0)
                .default(serde_json::json!(30)),
        ),
    ])
}

fn make_price_history_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("PriceDailyPoint"))),
        (
            "meta",
            z::object([
                ("cardmarketId", z::number().int().nullable()),
                ("isFoil", z::boolean().nullable()),
                ("days", z::number().int()),
                ("rowCount", z::number().int()),
            ]),
        ),
    ])
}

fn make_price_row() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("cardmarketId", z::number().int()),
        ("isFoil", z::boolean()),
        (
            "provider",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("cardmarket"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(serde_json::json!({"type":"string","const":"cardmarket"})),
        ),
        (
            "currency",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("EUR"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(serde_json::json!({"type":"string","const":"EUR"})),
        ),
        ("lowPrice", z::number().nullable()),
        ("marketPrice", z::number().nullable()),
        ("midPrice", z::number().nullable()),
        ("highPrice", z::number().nullable()),
        ("avg1Day", z::number().nullable()),
        ("avg7Day", z::number().nullable()),
        ("avg30Day", z::number().nullable()),
        ("lastUpdated", schema("IsoDateTimeString")),
    ])
}

fn make_price_stats() -> z::Schema {
    z::object([
        ("variantNumber", z::string()),
        ("cardmarketId", z::number().int().nullable()),
        ("isFoil", z::boolean()),
        (
            "currency",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("EUR"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(serde_json::json!({"type":"string","const":"EUR"})),
        ),
        ("currentPrice", z::number().nullable()),
        ("baselinePrice", z::number().nullable()),
        ("minPrice", z::number().nullable()),
        ("maxPrice", z::number().nullable()),
        ("avgPrice", z::number().nullable()),
        ("listingLow", z::number().nullable()),
        ("changePercent", z::number().int().nullable()),
        ("trend", schema("PriceTrend")),
        ("points", z::array(schema("PriceDailyPoint"))),
        ("days", z::number().int()),
        ("priceFilterLabel", z::string()),
        ("priceSourceNote", z::string()),
        ("targetPriceCents", z::number().int().nullable().optional()),
        ("belowTarget", z::boolean().optional()),
    ])
}

fn make_price_stats_batch_request() -> z::Schema {
    z::object([
        (
            "items",
            z::array(z::object([
                ("variantNumber", z::string().min(1)),
                ("isFoil", z::boolean().optional()),
                ("targetPriceCents", z::number().int().nullable().optional()),
            ]))
            .min(1)
            .max(200),
        ),
        (
            "days",
            z::coerce_number()
                .int()
                .gt(0.0)
                .lte(365.0)
                .default(serde_json::json!(30)),
        ),
    ])
}

fn make_price_stats_batch_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("PriceStats"))),
        (
            "meta",
            z::object([("days", z::number().int()), ("rowCount", z::number().int())]),
        ),
    ])
}

fn make_price_summary() -> z::Schema {
    z::object([
        (
            "currency",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("EUR"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(serde_json::json!({"type":"string","const":"EUR"})),
        ),
        ("low", z::number().nullable()),
        ("market", z::number().nullable()),
        ("avg7d", z::number().nullable()),
        ("isFoil", z::boolean()),
    ])
}

fn make_price_trend() -> z::Schema {
    z::enumeration(&["up", "down", "flat"])
}

fn make_prices_list_query() -> z::Schema {
    z::object([
        ("cardmarketId", z::coerce_number().int().optional()),
        ("variantNumber", z::string().optional()),
        ("isFoil", schema("QueryBooleanString").optional()),
    ])
}

fn make_prices_list_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("PriceRow"))),
        (
            "meta",
            z::object([
                ("pricesCatalogHash", z::string()),
                ("lastSyncedAt", schema("IsoDateTimeString").nullable()),
                ("rowCount", z::number().int()),
            ]),
        ),
    ])
}

fn make_query_boolean_string() -> z::Schema {
    z::union(vec![
        z::string()
            .refine(
                |value| value == &serde_json::json!("true"),
                "Invalid literal",
                &[],
            )
            .with_json_schema(serde_json::json!({"type":"string","const":"true"})),
        z::string()
            .refine(
                |value| value == &serde_json::json!("false"),
                "Invalid literal",
                &[],
            )
            .with_json_schema(serde_json::json!({"type":"string","const":"false"})),
    ])
    .transform(|value| serde_json::json!(value.as_str() == Some("true")))
    .with_output_schema(serde_json::json!({"type":"boolean"}))
}

fn make_rename_deck_version_request() -> z::Schema {
    z::object([("name", schema("DeckVersionName"))])
}

fn make_search_entity_type() -> z::Schema {
    z::enumeration(&["cards", "decks", "navigation", "actions"])
}

fn make_search_hit_card() -> z::Schema {
    z::object([
        (
            "kind",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("card"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(serde_json::json!({"type":"string","const":"card"})),
        ),
        ("variantNumber", schema("VariantNumber")),
        ("name", z::string()),
        ("imageUrl", z::string().url()),
        ("setCode", z::string()),
        ("type", z::string()),
        ("rarity", z::string()),
        ("textMatch", z::number().optional()),
    ])
}

fn make_search_hit_deck() -> z::Schema {
    z::object([
        (
            "kind",
            z::string()
                .refine(
                    |value| value == &serde_json::json!("deck"),
                    "Invalid literal",
                    &[],
                )
                .with_json_schema(serde_json::json!({"type":"string","const":"deck"})),
        ),
        ("id", z::string()),
        ("name", z::string()),
        ("textMatch", z::number().optional()),
    ])
}

fn make_settings_device_profile() -> z::Schema {
    z::enumeration(&["phone", "desktop"])
}

fn make_stored_deck_payload() -> z::Schema {
    z::object([
        ("id", z::string().min(1)),
        ("name", z::string()),
        ("description", z::string().optional()),
        (
            "format",
            schema("DeckFormat").default(serde_json::json!("constructed")),
        ),
        ("createdAt", z::number().int()),
        ("updatedAt", z::number().int()),
        ("legend", schema("DeckCardInput").nullable()),
        ("champion", schema("DeckCardInput").nullable()),
        ("mainDeck", z::array(schema("DeckEntryInput"))),
        ("runes", z::array(schema("DeckEntryInput"))),
        ("battlefields", z::array(schema("DeckEntryInput"))),
        ("sideboard", z::array(schema("DeckEntryInput"))),
        ("upstreamId", z::string().optional()),
        ("importedFromId", z::string().optional()),
        ("syncWarnings", z::array(z::string()).optional()),
    ])
}

fn make_sync_catalog_response() -> z::Schema {
    z::object([(
        "data",
        z::object([
            ("changed", z::boolean()),
            ("pages", z::number().int().gte(0.0)),
            ("variantCount", z::number().int().gte(0.0)),
            ("hash", z::string()),
        ]),
    )])
}

fn make_sync_prices_response() -> z::Schema {
    z::object([(
        "data",
        z::object([
            ("changed", z::boolean()),
            ("rowCount", z::number().int().gte(0.0)),
            ("productCount", z::number().int().gte(0.0)),
            ("hash", z::string()),
            (
                "source",
                z::string()
                    .refine(
                        |value| value == &serde_json::json!("cardmarket"),
                        "Invalid literal",
                        &[],
                    )
                    .with_json_schema(serde_json::json!({"type":"string","const":"cardmarket"})),
            ),
            ("gameId", z::number().int()),
            ("exportCreatedAt", z::string()),
            ("cardmarketIdsBackfilled", z::number().int().gte(0.0)),
        ]),
    )])
}

fn make_sync_status_response() -> z::Schema {
    z::object([(
        "data",
        z::object([
            (
                "catalog",
                z::object([
                    ("lastRun", schema("IsoDateTimeString").nullable()),
                    ("status", z::enumeration(&["idle", "running", "failed"])),
                    ("hash", z::string()),
                    ("variantCount", z::number().int()),
                ]),
            ),
            (
                "prices",
                z::object([
                    ("lastRun", schema("IsoDateTimeString").nullable()),
                    ("status", z::enumeration(&["idle", "running", "failed"])),
                    ("hash", z::string()),
                    ("rowCount", z::number().int()),
                ]),
            ),
        ]),
    )])
}

fn make_theme_preference() -> z::Schema {
    z::enumeration(&["light", "dark", "system"])
}

fn make_user_settings() -> z::Schema {
    z::object([
        ("device", schema("SettingsDeviceProfile")),
        ("settings", schema("UserSettingsPayload")),
        ("updatedAt", schema("IsoDateTimeString").nullable()),
    ])
}

fn make_user_settings_patch() -> z::Schema {
    z::object([
        ("theme", schema("ThemePreference").optional()),
        (
            "accentColor",
            z::string().min(1).max(32).optional().optional(),
        ),
        ("defaultLayout", schema("CatalogLayout").optional()),
        ("gridCardSize", schema("GridCardSize").optional()),
    ])
}

fn make_user_settings_payload() -> z::Schema {
    z::object([
        ("theme", schema("ThemePreference")),
        ("accentColor", z::string().min(1).max(32).optional()),
        ("defaultLayout", schema("CatalogLayout")),
        ("gridCardSize", schema("GridCardSize")),
    ])
}

fn make_user_settings_response() -> z::Schema {
    z::object([("data", schema("UserSettings"))])
}

fn make_user_settings_upsert_request() -> z::Schema {
    z::object([
        ("theme", schema("ThemePreference").optional()),
        (
            "accentColor",
            z::string().min(1).max(32).optional().optional(),
        ),
        ("defaultLayout", schema("CatalogLayout").optional()),
        ("gridCardSize", schema("GridCardSize").optional()),
    ])
}

fn make_variant_detail() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("variantNumber", schema("VariantNumber")),
        ("rarity", z::string()),
        ("variantType", z::string()),
        ("variantLabel", z::string()),
        ("foilMode", z::string()),
        ("imageUrl", z::string().url()),
        ("cardmarketId", z::number().int().nullable()),
        ("tcgplayerId", z::number().int().nullable()),
        ("releaseDate", z::string().nullable()),
        ("artist", z::string().nullable()),
        ("prices", z::array(schema("PriceSummary"))),
    ])
}

fn make_variant_number() -> z::Schema {
    z::string().min(1).refine(
        |value| {
            value.as_str().is_some_and(|text| {
                regex_lite::Regex::new("^[A-Za-z0-9]+-[A-Za-z0-9]+([-*_.][A-Za-z0-9]+)*\\*?$")
                    .is_ok_and(|pattern| pattern.is_match(text))
            })
        },
        "Invalid",
        &[],
    )
}

fn make_wishlist_item() -> z::Schema {
    z::object([
        (
            "id",
            z::string().refine(
                |value| value.as_str().is_some_and(super::valid_uuid),
                "Invalid uuid",
                &[],
            ),
        ),
        ("variantNumber", z::string()),
        ("priority", z::number().int()),
        ("targetPriceCents", z::number().int().nullable()),
        ("notes", z::string().nullable()),
        ("addedAt", z::string().datetime()),
        ("name", z::string()),
        ("imageUrl", z::string()),
        ("setCode", z::string()),
        ("rarity", z::string()),
        ("variantLabel", z::string()),
    ])
}

fn make_wishlist_item_response() -> z::Schema {
    z::object([("data", schema("WishlistItem"))])
}

fn make_wishlist_list_response() -> z::Schema {
    z::object([
        ("data", z::array(schema("WishlistItem"))),
        ("meta", z::object([("total", z::number().int())])),
    ])
}

fn make_wishlist_upsert_request() -> z::Schema {
    z::object([
        ("variantNumber", z::string().min(1)),
        (
            "priority",
            z::number()
                .int()
                .gte(0.0)
                .lte(3.0)
                .default(serde_json::json!(0)),
        ),
        ("targetPriceCents", z::number().int().nullable().optional()),
        ("notes", z::string().max(2000).nullable().optional()),
    ])
}

pub const NAMES: &[&str] = &[
    "CardCondition",
    "CardDetail",
    "CardDetailResponse",
    "CardListItem",
    "CardListPrinting",
    "CardsBatchRequest",
    "CardsBatchResponse",
    "CardsDetailQuery",
    "CardsListQuery",
    "CardsListResponse",
    "CatalogIndexResponse",
    "CatalogLayout",
    "CollectionActivityCursor",
    "CollectionActivityEvent",
    "CollectionActivityHistoryRequest",
    "CollectionActivityHistoryResponse",
    "CollectionAdjustRequest",
    "CollectionAuditAction",
    "CollectionAuditActor",
    "CollectionAuditEvent",
    "CollectionAuditListQuery",
    "CollectionAuditListResponse",
    "CollectionBatchSyncRequest",
    "CollectionBatchSyncResponse",
    "CollectionDeleteQuery",
    "CollectionImportMode",
    "CollectionImportPreviewChange",
    "CollectionImportPreviewItem",
    "CollectionImportPreviewRequest",
    "CollectionImportPreviewResponse",
    "CollectionImportPreviewStatus",
    "CollectionImportRequest",
    "CollectionImportResponse",
    "CollectionItem",
    "CollectionItemResponse",
    "CollectionListResponse",
    "CollectionLiveChangeReason",
    "CollectionLiveChangedEvent",
    "CollectionLiveEvent",
    "CollectionLiveHeartbeatEvent",
    "CollectionLiveReadyEvent",
    "CollectionQuantitiesRequest",
    "CollectionQuantitiesResponse",
    "CollectionQuantityRow",
    "CollectionRecentAddsRequest",
    "CollectionRecentAddsResponse",
    "CollectionShareAcceptMode",
    "CollectionShareAcceptRequest",
    "CollectionShareAcceptResponse",
    "CollectionShareInviteCreate",
    "CollectionShareInviteCreateResponse",
    "CollectionShareInvitePreview",
    "CollectionShareInvitePreviewResponse",
    "CollectionShareLeaveResponse",
    "CollectionSharePartner",
    "CollectionSharePendingInvite",
    "CollectionSharePerson",
    "CollectionShareStatus",
    "CollectionShareStatusResponse",
    "CollectionUpsertRequest",
    "CollectionVariantNumbersRequest",
    "ColorRef",
    "CreateDeckVersionRequest",
    "DeckCardInput",
    "DeckDetailResponse",
    "DeckEntryInput",
    "DeckFormat",
    "DeckListItem",
    "DeckListResponse",
    "DeckRulesResponse",
    "DeckSortField",
    "DeckSource",
    "DeckUpsertRequest",
    "DeckValidateInput",
    "DeckValidateResponse",
    "DeckValidationMessage",
    "DeckVersionName",
    "DeckVersionSummary",
    "DecksListQuery",
    "FilterSnapshot",
    "FiltersResponse",
    "GlobalSearchQuery",
    "GlobalSearchResponse",
    "GridCardSize",
    "HealthResponse",
    "IdData",
    "IdResponse",
    "ImageThumbQuery",
    "IsoDateString",
    "IsoDateTimeString",
    "OkData",
    "OkResponse",
    "PaCardsBatchResponse",
    "PaCardsListResponse",
    "PaColor",
    "PaLogicalCard",
    "PaPriceRow",
    "PaPricesListResponse",
    "PaSet",
    "PaVariant",
    "PaVariantListItem",
    "Pagination",
    "PriceDailyPoint",
    "PriceHistoryQuery",
    "PriceHistoryResponse",
    "PriceRow",
    "PriceStats",
    "PriceStatsBatchRequest",
    "PriceStatsBatchResponse",
    "PriceSummary",
    "PriceTrend",
    "PricesListQuery",
    "PricesListResponse",
    "QueryBooleanString",
    "RenameDeckVersionRequest",
    "SearchEntityType",
    "SearchHitCard",
    "SearchHitDeck",
    "SettingsDeviceProfile",
    "StoredDeckPayload",
    "SyncCatalogResponse",
    "SyncPricesResponse",
    "SyncStatusResponse",
    "ThemePreference",
    "UserSettings",
    "UserSettingsPatch",
    "UserSettingsPayload",
    "UserSettingsResponse",
    "UserSettingsUpsertRequest",
    "VariantDetail",
    "VariantNumber",
    "WishlistItem",
    "WishlistItemResponse",
    "WishlistListResponse",
    "WishlistUpsertRequest",
];

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn typed_record_values_are_validated() {
        let mut value = serde_json::json!({"data":{"version":"x","rules":astral_grove_api_types::deck_validation::rules("constructed")}});
        assert!(schema("DeckRulesResponse").parse(Some(&value)).is_ok());
        value["data"]["rules"]["sections"]["legend"]["target"] = serde_json::json!("invalid");
        assert!(schema("DeckRulesResponse").parse(Some(&value)).is_err());
    }
}
