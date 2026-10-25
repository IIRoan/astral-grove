#![expect(
    clippy::unwrap_used,
    reason = "Failed test assertions must stop the probe immediately"
)]

use astral_grove_server::http::schemas;
use serde_json::{Value, json};
use std::collections::BTreeSet;
use utoipa::OpenApi;

type Shape = (String, BTreeSet<String>, BTreeSet<String>);

fn keys(value: Option<&Value>) -> BTreeSet<String> {
    match value {
        Some(Value::Object(map)) => map.keys().cloned().collect(),
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|item| item.as_str().map(String::from))
            .collect(),
        _ => BTreeSet::new(),
    }
}

/// Collects (path, properties, required) for every object reachable from `schema`, following `$ref`s into `components`.
fn shapes(schema: &Value, components: &Value, path: String, out: &mut Vec<Shape>) {
    let schema = match schema.get("$ref").and_then(Value::as_str) {
        Some(reference) => &components[reference.trim_start_matches("#/components/schemas/")],
        None => schema,
    };
    for key in ["anyOf", "oneOf", "allOf"] {
        let variants = schema
            .get(key)
            .and_then(Value::as_array)
            .into_iter()
            .flatten();
        for (index, variant) in variants.enumerate() {
            if variant.get("type") != Some(&json!("null")) {
                shapes(variant, components, format!("{path}|{key}{index}"), out);
            }
        }
    }
    if let Some(properties) = schema.get("properties").and_then(Value::as_object) {
        out.push((
            path.clone(),
            keys(schema.get("properties")),
            keys(schema.get("required")),
        ));
        for (key, child) in properties {
            shapes(child, components, format!("{path}.{key}"), out);
        }
    }
    if let Some(items) = schema.get("items") {
        shapes(items, components, format!("{path}[]"), out);
    }
}

// Responses pass through the validator and then deserialize into the DTO, so a field missing from either is silently dropped.
#[test]
fn serde_dtos_match_validator_output_schemas() {
    let document =
        serde_json::to_value(astral_grove_api_types::ContractSchemas::openapi()).unwrap();
    let components = &document["components"]["schemas"];
    let mut drift = Vec::new();
    for name in schemas::NAMES {
        let Some(dto) = components.get(*name) else {
            continue;
        };
        let (mut expected, mut actual) = (Vec::new(), Vec::new());
        shapes(
            &schemas::schema(name).json_schema(true),
            &json!({}),
            (*name).into(),
            &mut expected,
        );
        shapes(dto, components, (*name).into(), &mut actual);
        for (path, properties, required) in &expected {
            if let Some((_, dto_properties, dto_required)) =
                actual.iter().find(|shape| &shape.0 == path)
                && (properties != dto_properties || required != dto_required)
            {
                drift.push(format!(
                    "{path}: validator {properties:?} required {required:?}, DTO {dto_properties:?} required {dto_required:?}"
                ));
            }
        }
    }
    assert!(drift.is_empty(), "DTO drift:\n{}", drift.join("\n"));
}
