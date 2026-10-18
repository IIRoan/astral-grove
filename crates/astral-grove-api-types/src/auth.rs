use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
    pub email_verified: bool,
    #[schema(required = true)]
    pub image: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub user_id: String,
    pub token: String,
    pub expires_at: String,
    pub created_at: String,
    pub updated_at: String,
    #[schema(required = true)]
    pub ip_address: Option<String>,
    #[schema(required = true)]
    pub user_agent: Option<String>,
}
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct SessionResponse {
    pub user: User,
    pub session: Session,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SignUpRequest {
    pub remember_me: Option<bool>,
    pub name: String,
    pub email: String,
    pub password: String,
    pub image: Option<String>,
    #[serde(rename = "callbackURL")]
    pub callback_url: Option<String>,
}
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SignInRequest {
    pub email: String,
    pub password: String,
    pub remember_me: Option<bool>,
    #[serde(rename = "callbackURL")]
    pub callback_url: Option<String>,
}
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SignUpResponse {
    #[schema(required = true)]
    pub token: Option<String>,
    pub user: User,
}
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SignInResponse {
    pub redirect: bool,
    pub token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    pub user: User,
}
#[derive(Debug, Serialize, ToSchema)]
pub struct StatusResponse {
    pub success: bool,
}
