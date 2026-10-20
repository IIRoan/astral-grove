use super::zod as z;

pub fn schema(name: &str) -> z::Schema {
    match name {
        "UpstreamDeckDetail" => z::object([
            ("id", z::string().min(1)),
            ("name", z::string()),
            ("description", z::string().nullable().optional()),
            ("authorName", z::string().optional().nullable()),
            ("views", z::number().int().gte(0.0).optional()),
            ("likes", z::number().int().gte(0.0).optional()),
            ("videoUrl", z::string().nullable().optional()),
            ("hasGuide", z::boolean().optional()),
            ("hasMatchups", z::boolean().optional()),
            ("isLegal", z::boolean().optional()),
            ("bannedCardNames", z::array(z::string()).optional()),
            ("createdAt", z::string()),
            ("editedAt", z::string().optional().nullable()),
            ("updatedAt", z::string().optional().nullable()),
            (
                "legend",
                z::object([
                    ("id", z::string()),
                    ("name", z::string()),
                    ("variantNumber", z::string()),
                    (
                        "tags",
                        z::array(z::string())
                            .optional()
                            .default(serde_json::json!([])),
                    ),
                    ("colors", z::any().optional()),
                    ("imageUrl", z::any().optional()),
                ])
                .optional()
                .nullable(),
            ),
            (
                "champions",
                z::array(z::object([
                    ("cardId", z::string()),
                    ("variantId", z::string()),
                    ("quantity", z::number().int()),
                ]))
                .optional()
                .nullable(),
            ),
            (
                "maindeck",
                z::array(z::object([
                    ("cardId", z::string()),
                    ("variantId", z::string()),
                    ("quantity", z::number().int()),
                ]))
                .optional()
                .nullable(),
            ),
            (
                "runes",
                z::array(z::object([
                    ("cardId", z::string()),
                    ("variantId", z::string()),
                    ("quantity", z::number().int()),
                ]))
                .optional()
                .nullable(),
            ),
            (
                "battlefields",
                z::array(z::object([
                    ("cardId", z::string()),
                    ("variantId", z::string()),
                ]))
                .optional()
                .nullable(),
            ),
            (
                "sideboard",
                z::array(z::object([
                    ("cardId", z::string()),
                    ("variantId", z::string()),
                    ("quantity", z::number().int()),
                ]))
                .optional()
                .nullable(),
            ),
        ]),
        "UpstreamDeckListResponse" => z::object([
            (
                "data",
                z::array(z::object([
                    ("id", z::string().min(1)),
                    ("name", z::string()),
                    ("description", z::string().nullable().optional()),
                    ("authorName", z::string().optional().nullable()),
                    ("views", z::number().int().gte(0.0).optional()),
                    ("likes", z::number().int().gte(0.0).optional()),
                    ("isLegal", z::boolean().optional()),
                    ("videoUrl", z::string().nullable().optional()),
                    ("createdAt", z::string()),
                    ("editedAt", z::string().optional().nullable()),
                    ("updatedAt", z::string().optional().nullable()),
                    (
                        "legend",
                        z::object([
                            ("id", z::string()),
                            ("name", z::string()),
                            ("variantNumber", z::string()),
                            (
                                "tags",
                                z::array(z::string())
                                    .optional()
                                    .default(serde_json::json!([])),
                            ),
                            ("colors", z::any().optional()),
                            ("imageUrl", z::any().optional()),
                        ])
                        .optional()
                        .nullable(),
                    ),
                    ("bannedCardNames", z::array(z::string()).optional()),
                    (
                        "sets",
                        z::array(z::object([
                            ("prefix", z::string()),
                            ("name", z::string().optional()),
                        ]))
                        .optional(),
                    ),
                    (
                        "contentFlags",
                        z::object([
                            ("hasVideo", z::boolean().optional()),
                            ("hasGuide", z::boolean().optional()),
                            ("hasMatchups", z::boolean().optional()),
                        ])
                        .optional(),
                    ),
                ])),
            ),
            (
                "pagination",
                z::object([
                    ("page", z::number().int().gt(0.0)),
                    ("pageSize", z::number().int().gt(0.0)),
                    ("total", z::number().int().gte(0.0)),
                    ("totalPages", z::number().int().gte(0.0)),
                ])
                .optional(),
            ),
        ]),
        _ => panic!("Unknown internal contract schema: {name}"),
    }
}
