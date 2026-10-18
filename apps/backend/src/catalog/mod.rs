pub mod mapper;
pub mod query;
pub mod routes;
pub mod store;
use serde_json::Value;
use sha2::{Digest, Sha256};
pub fn hash(value: &Value) -> String {
    fn sorted(value: &Value) -> Value {
        match value {
            Value::Object(map) => {
                let mut keys: Vec<_> = map.keys().collect();
                keys.sort();
                Value::Object(
                    keys.into_iter()
                        .map(|key| (key.clone(), sorted(&map[key])))
                        .collect(),
                )
            }
            Value::Array(items) => Value::Array(items.iter().map(sorted).collect()),
            value => value.clone(),
        }
    }
    hex::encode(Sha256::digest(
        serde_json::to_vec(&sorted(value)).unwrap_or_default(),
    ))
}

pub mod metadata;
