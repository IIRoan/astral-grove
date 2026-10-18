use serde_json::{Value, json};

pub fn complete(document: &mut Value) {
    document["components"]["securitySchemes"] = json!({
        "sessionCookie": {"type":"apiKey","in":"cookie","name":"better-auth.session_token"},
        "sessionBearer": {"type":"http","scheme":"bearer"},
        "adminToken": {"type":"http","scheme":"bearer"}
    });
    let Some(paths) = document["paths"].as_object_mut() else {
        return;
    };
    for (path, item) in paths {
        let parameters: Vec<_> = path
            .split('/')
            .filter_map(|part| part.strip_prefix('{')?.strip_suffix('}'))
            .collect();
        let Some(operations) = item.as_object_mut() else {
            continue;
        };
        for (method, operation) in operations {
            if !matches!(
                method.as_str(),
                "get" | "put" | "post" | "patch" | "delete" | "head"
            ) {
                continue;
            }
            let name = operation["operationId"].as_str().unwrap_or("").to_owned();
            if !operation["parameters"].is_array() {
                operation["parameters"] = json!([]);
            }
            for name in &parameters {
                let entries = operation["parameters"]
                    .as_array_mut()
                    .unwrap_or_else(|| unreachable!());
                if !entries
                    .iter()
                    .any(|p| p["in"] == "path" && p["name"] == *name)
                {
                    entries.push(
                        json!({"in":"path","name":name,"required":true,"schema":{"type":"string"}}),
                    );
                }
            }
            let query = match name.as_str() {
                "listCards" => Some("CardsListQuery"),
                "getCard" => Some("CardsDetailQuery"),
                "listCollectionAudit" | "listPersonalCollectionAudit" => {
                    Some("CollectionAuditListQuery")
                }
                "deleteCollectionItem" => Some("CollectionDeleteQuery"),
                "listDecks" => Some("DecksListQuery"),
                "getImage" => Some("ImageThumbQuery"),
                "listPrices" => Some("PricesListQuery"),
                "getPriceHistory" => Some("PriceHistoryQuery"),
                "globalSearch" => Some("GlobalSearchQuery"),
                _ => None,
            };
            if let Some(query) = query {
                let schema = crate::http::schemas::schema(query).json_schema(false);
                if let Some(properties) = schema["properties"].as_object() {
                    let required = schema["required"].as_array();
                    for (name, property) in properties {
                        operation["parameters"].as_array_mut().unwrap_or_else(|| unreachable!()).push(json!({"in":"query","name":name,"required":required.is_some_and(|r|r.iter().any(|v|v==name)),"schema":property}));
                    }
                }
            }
            if name == "syncCatalog" {
                operation["parameters"].as_array_mut().unwrap_or_else(||unreachable!()).push(json!({"in":"query","name":"force","required":false,"schema":{"type":"string","enum":["true","1","false","0"]}}));
            }
            if matches!(
                name.as_str(),
                "downloadInternalRelease" | "headInternalRelease"
            ) {
                operation["parameters"].as_array_mut().unwrap_or_else(||unreachable!()).push(json!({"in":"query","name":"token","required":true,"schema":{"type":"string"}}));
            }
            let body = match name.as_str() {
                "setCollectionItem" => Some("CollectionUpsertRequest"),
                "setWishlistItem" => Some("WishlistUpsertRequest"),
                _ => None,
            };
            if let Some(body) = body {
                let mut schema = crate::http::schemas::schema(body).json_schema(false);
                if let Some(properties) = schema["properties"].as_object_mut() {
                    properties.remove("variantNumber");
                }
                if let Some(required) = schema["required"].as_array_mut() {
                    required.retain(|name| name != "variantNumber");
                }
                operation["requestBody"] =
                    json!({"required":false,"content":{"application/json":{"schema":schema}}});
            }
            if matches!(
                name.as_str(),
                "addCollectionItem" | "removeCollectionItem" | "setUserSettings"
            ) {
                operation["requestBody"]["required"] = json!(false);
            }
            if path.starts_with("/api/v1/collection")
                || path.starts_with("/api/v1/wishlist")
                || path.starts_with("/api/v1/decks")
                || path.starts_with("/api/v1/settings")
            {
                operation["security"] = json!([{"sessionCookie":[]},{"sessionBearer":[]}]);
            } else if path.starts_with("/api/v1/sync/") {
                operation["security"] = json!([{"adminToken":[]}]);
            }
        }
    }
}
