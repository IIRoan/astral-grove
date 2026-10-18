use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};

#[derive(Debug, thiserror::Error)]
#[error("{status} API error")]
pub struct AppError {
    pub status: StatusCode,
    pub body: Value,
}

impl AppError {
    pub fn new(status: u16, error: &str, message: &str) -> Self {
        Self {
            status: StatusCode::from_u16(status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
            body: json!({"error": error, "message": message}),
        }
    }
    pub fn validation() -> Self {
        Self::new(422, "VALIDATION_ERROR", "Request validation failed")
    }
    pub fn unauthorized() -> Self {
        Self::new(401, "UNAUTHORIZED", "Sign in required")
    }
    pub fn internal() -> Self {
        Self::new(500, "INTERNAL_ERROR", "An unexpected error occurred")
    }
    pub fn not_found(message: &str) -> Self {
        Self::new(404, "NOT_FOUND", message)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(self.body)).into_response()
    }
}

impl From<sea_orm::DbErr> for AppError {
    fn from(error: sea_orm::DbErr) -> Self {
        let message = error.to_string().to_lowercase();
        if (message.contains("user_decks") || message.contains("user_deck_versions"))
            && message.contains("does not exist")
        {
            return Self::new(
                503,
                "DECKS_STORAGE_UNAVAILABLE",
                "Deck storage is not migrated yet. Run database migrations.",
            );
        }
        tracing::error!(category = "database", "Database operation failed");
        Self::internal()
    }
}
impl From<serde_json::Error> for AppError {
    fn from(_: serde_json::Error) -> Self {
        Self::internal()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
