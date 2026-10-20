pub mod cookies;
pub mod core;
pub mod email;
pub mod otp;
pub mod password;
pub mod pipeline;
pub mod routes;
pub mod service;

const DISABLED_ENDPOINTS: &[&str] = &[
    "signInEmailOTP",
    "requestPasswordResetEmailOTP",
    "forgetPasswordEmailOTP",
    "resetPasswordEmailOTP",
];

use crate::{
    AppState,
    error::{AppError, Result},
};
use astral_grove_api_types::auth::SessionResponse;
use axum::{extract::FromRequestParts, http::request::Parts};
use std::sync::Arc;

pub fn error(status: u16, code: &str, message: &str) -> AppError {
    AppError::json(
        status,
        serde_json::json!({"code": code, "message": message}),
    )
}

pub struct RouteUser(pub SessionResponse);
impl FromRequestParts<Arc<AppState>> for RouteUser {
    type Rejection = AppError;
    async fn from_request_parts(parts: &mut Parts, state: &Arc<AppState>) -> Result<Self> {
        let session = service::get_session(state, &parts.headers).await?;
        session.map(Self).ok_or_else(AppError::unauthorized)
    }
}

#[expect(
    clippy::expect_used,
    reason = "The checked-in endpoint schema is verified during generation and tests"
)]
pub fn document(document: &mut serde_json::Value) {
    use serde_json::json;
    let definitions: serde_json::Value =
        serde_json::from_str(include_str!("auth/request-schemas.json")).expect("auth schemas");
    for (name, endpoint) in definitions.as_object().expect("auth definitions") {
        if DISABLED_ENDPOINTS.contains(&name.as_str()) {
            continue;
        }
        let Some(path) = endpoint["path"].as_str() else {
            continue;
        };
        let path = format!(
            "/api/auth{}",
            path.replace(":id", "{id}").replace(":token", "{token}")
        );
        let methods = endpoint["method"]
            .as_array()
            .cloned()
            .unwrap_or_else(|| vec![endpoint["method"].clone()]);
        for method in methods {
            let Some(method) = method.as_str() else {
                continue;
            };
            let operation = &mut document["paths"][&path][method.to_lowercase()];
            if let Some(schema) = endpoint.get("body").filter(|_| method != "GET") {
                operation["requestBody"] = json!({"required":!endpoint["bodyOptional"].as_bool().unwrap_or(false),"content":{"application/json":{"schema":schema}}});
            }
            if let Some(schema) = endpoint["query"]["properties"].as_object() {
                let required = endpoint["query"]["required"].as_array();
                operation["parameters"]=json!(schema.iter().map(|(key,value)|json!({"in":"query","name":key,"required":required.is_some_and(|r|r.iter().any(|v|v==key)),"schema":value})).collect::<Vec<_>>());
            }
            let response = match name.as_str() {
                "signUpEmail" => Some(json!({"$ref":"#/components/schemas/SignUpResponse"})),
                "signInEmail" => Some(json!({"$ref":"#/components/schemas/SignInResponse"})),
                "getSession" => Some(
                    json!({"anyOf":[{"$ref":"#/components/schemas/SessionResponse"},{"type":"null"}]}),
                ),
                "ok" => Some(
                    json!({"type":"object","properties":{"ok":{"type":"boolean","enum":[true]}},"required":["ok"]}),
                ),
                _ => None,
            };
            if let Some(response) = response {
                operation["responses"]["200"]["content"]["application/json"]["schema"] = response;
            }
        }
    }
    fn normalize(value: &mut serde_json::Value) {
        match value {
            serde_json::Value::Array(values) => {
                for value in values {
                    normalize(value)
                }
            }
            serde_json::Value::Object(values) => {
                values.remove("$schema");
                if let Some(value) = values.remove("const") {
                    values.insert("enum".into(), json!([value]));
                }
                for value in values.values_mut() {
                    normalize(value)
                }
            }
            _ => {}
        }
    }
    normalize(document);
}
