use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CollectionMutationResponse {
    #[schema(required = true)]
    pub data: Option<crate::CollectionItem>,
}
