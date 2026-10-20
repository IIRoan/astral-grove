use crate::db;
use serde_json::{Value, json};
pub const HEADERS: [&str; 15] = [
    "Variant Number",
    "Card Name",
    "Set",
    "Set Prefix",
    "Rarity",
    "Variant Type",
    "Variant Label",
    "Foil",
    "Quantity",
    "Language",
    "Condition",
    "Grading Company",
    "Grading Value",
    "Grading Label",
    "Notes",
];
const CONDITIONS: [(&str, &str); 7] = [
    ("mint", "Mint"),
    ("near_mint", "Near Mint"),
    ("lightly_played", "Lightly Played"),
    ("moderately_played", "Moderately Played"),
    ("heavily_played", "Heavily Played"),
    ("damaged", "Damaged"),
    ("unspecified", ""),
];
const LANGUAGES: [(&str, &str); 9] = [
    ("en", "English"),
    ("de", "German"),
    ("fr", "French"),
    ("es", "Spanish"),
    ("it", "Italian"),
    ("pt", "Portuguese"),
    ("ja", "Japanese"),
    ("ko", "Korean"),
    ("zh", "Chinese"),
];
fn trim(raw: &str) -> &str {
    raw.trim_matches(|ch: char| ch.is_whitespace() || ch == '\u{feff}')
}
pub fn aggregate(items: Vec<Value>) -> Vec<Value> {
    let mut merged = Vec::<Value>::with_capacity(items.len());
    let mut positions = std::collections::HashMap::<String, usize>::new();
    for item in items {
        let finish = match item["isFoil"].as_bool() {
            Some(true) => "foil",
            Some(false) => "std",
            None => "auto",
        };
        let key = format!(
            "{}|{}|{}|{finish}",
            db::string(&item, "variantNumber"),
            db::string(&item, "condition"),
            db::string(&item, "language")
        );
        if let Some(existing) = positions.get(&key).map(|index| &mut merged[*index]) {
            let quantity = existing["quantity"]
                .as_i64()
                .unwrap_or(0)
                .saturating_add(item["quantity"].as_i64().unwrap_or(0));
            existing["quantity"] = json!(quantity);
            for key in ["notes", "gradeCompany", "gradeScore"] {
                if db::string(existing, key).is_empty() && !db::string(&item, key).is_empty() {
                    existing[key] = item[key].clone();
                }
            }
            existing["isGraded"] = json!(
                !db::string(existing, "gradeCompany").is_empty()
                    || !db::string(existing, "gradeScore").is_empty()
            );
        } else {
            positions.insert(key, merged.len());
            merged.push(item);
        }
    }
    merged
}
pub fn tts(text: &str) -> Value {
    static PATTERN: std::sync::LazyLock<regex_lite::Regex> = std::sync::LazyLock::new(|| {
        regex_lite::Regex::new(r"(?i)^([A-Za-z]+)-((?:R|SP)?\d+)-([123])$")
            .unwrap_or_else(|_| unreachable!("TTS pattern"))
    });
    let tokens: Vec<_> = trim(text)
        .split(|ch: char| ch.is_whitespace() || ch == ',' || ch == ';')
        .filter(|token| !token.is_empty())
        .collect();
    let mut items = Vec::new();
    let mut errors = Vec::new();
    for token in &tokens {
        if let Some(captures) = PATTERN.captures(token) {
            let set = captures
                .get(1)
                .map(|group| group.as_str().to_uppercase())
                .unwrap_or_default();
            let number = captures
                .get(2)
                .map(|group| group.as_str())
                .unwrap_or_default();
            let suffix = match captures.get(3).map(|group| group.as_str()) {
                Some("2") => "a",
                Some("3") => "b",
                _ => "",
            };
            items.push(json!({"variantNumber":format!("{set}-{number}{suffix}"),"quantity":1,"condition":"near_mint","language":"en"}));
        } else {
            errors.push(json!({"token":token,"message":format!("Invalid TTS token: {token}")}));
        }
    }
    let items = aggregate(items);
    json!({"totalTokens":tokens.len(),"totalCopies":items.iter().filter_map(|item|item["quantity"].as_i64()).sum::<i64>(),"uniquePrintings":items.len(),"items":items,"errors":errors})
}
fn records(content: &str) -> Vec<Vec<String>> {
    let mut records = Vec::new();
    let mut row = Vec::new();
    let mut field = String::new();
    let mut quoted = false;
    let mut chars = trim(content).chars().peekable();
    while let Some(ch) = chars.next() {
        if quoted {
            if ch == '"' && chars.peek() == Some(&'"') {
                field.push('"');
                chars.next();
            } else if ch == '"' {
                quoted = false;
            } else {
                field.push(ch);
            }
            continue;
        }
        match ch {
            '"' => quoted = true,
            ',' => row.push(std::mem::take(&mut field)),
            '\n' | '\r' => {
                row.push(std::mem::take(&mut field));
                if row.iter().any(|field| !field.is_empty()) {
                    records.push(std::mem::take(&mut row));
                } else {
                    row.clear();
                }
                if ch == '\r' && chars.peek() == Some(&'\n') {
                    chars.next();
                }
            }
            _ => field.push(ch),
        }
    }
    row.push(field);
    if row.iter().any(|field| !field.is_empty()) {
        records.push(row);
    }
    records
}
pub fn csv(content: &str) -> Value {
    let records = records(content);
    let Some(headers) = records.first() else {
        return json!({"items":[],"errors":[],"rowsProcessed":0,"totalCopies":0,"uniquePrintings":0});
    };
    let index: std::collections::HashMap<_, _> = headers
        .iter()
        .enumerate()
        .map(|(index, header)| (trim(header), index))
        .collect();
    let missing: Vec<_> = HEADERS
        .into_iter()
        .filter(|header| !index.contains_key(header))
        .collect();
    if !missing.is_empty() {
        return json!({"items":[],"errors":[{"row":1,"message":format!("Missing CSV headers: {}",missing.join(", "))}],"rowsProcessed":0,"totalCopies":0,"uniquePrintings":0});
    }
    let mut items = Vec::new();
    let mut errors = Vec::new();
    for (row_number, row) in records.iter().skip(1).enumerate() {
        let field = |header: &str| {
            index
                .get(header)
                .and_then(|index| row.get(*index))
                .map(|value| trim(value))
                .unwrap_or("")
        };
        let parsed = (|| -> std::result::Result<Value, String> {
            let variant = field("Variant Number");
            if variant.is_empty() {
                return Err("Missing variant number".into());
            }
            let quantity = field("Quantity");
            let mut digits = String::new();
            for (index, ch) in quantity.chars().enumerate() {
                if ch.is_ascii_digit() || index == 0 && matches!(ch, '+' | '-') {
                    digits.push(ch);
                } else {
                    break;
                }
            }
            let quantity = if quantity.is_empty() {
                Some(0)
            } else {
                digits.parse::<i64>().ok()
            };
            let Some(quantity) = quantity.filter(|value| *value >= 0) else {
                return Err(format!("Invalid quantity: {}", field("Quantity")));
            };
            if quantity == 0 {
                return Err("Quantity must be greater than zero".into());
            }
            let condition = field("Condition");
            let snake = condition
                .to_lowercase()
                .split_whitespace()
                .collect::<Vec<_>>()
                .join("_");
            let condition = CONDITIONS
                .iter()
                .find(|(code, label)| *code == snake || label.eq_ignore_ascii_case(condition))
                .map(|(code, _)| *code)
                .ok_or_else(|| format!("Unknown condition: {condition}"))?;
            let language = field("Language");
            let language = if language.is_empty() {
                "en".into()
            } else {
                LANGUAGES
                    .iter()
                    .find(|(_, label)| label.eq_ignore_ascii_case(language))
                    .map(|(code, _)| (*code).into())
                    .unwrap_or_else(|| language.to_lowercase())
            };
            let foil = field("Foil");
            let foil = match foil.to_lowercase().as_str() {
                "true" | "yes" | "1" | "foil" => true,
                "" | "false" | "no" | "0" | "non-foil" | "nonfoil" | "standard" => false,
                _ => return Err(format!("Invalid foil value: {foil}")),
            };
            let nullable = |key: &str| {
                if field(key).is_empty() {
                    Value::Null
                } else {
                    json!(field(key))
                }
            };
            Ok(
                json!({"variantNumber":variant,"quantity":quantity,"condition":condition,"language":language,"isFoil":foil,"notes":nullable("Notes"),"gradeCompany":nullable("Grading Company"),"gradeScore":nullable("Grading Value"),"isGraded":!field("Grading Company").is_empty()||!field("Grading Value").is_empty()}),
            )
        })();
        match parsed {
            Ok(item) => match crate::http::schemas::collection_import_item().parse(Some(&item)) {
                Ok(Some(item)) => items.push(item),
                _ => errors.push(json!({"row":row_number+2,"message":"Invalid collection item: check field lengths and quantity"})),
            },
            Err(message) => errors.push(json!({"row":row_number+2,"message":message})),
        }
    }
    let items = aggregate(items);
    json!({"rowsProcessed":records.len()-1,"totalCopies":items.iter().filter_map(|item|item["quantity"].as_i64()).sum::<i64>(),"uniquePrintings":items.len(),"items":items,"errors":errors})
}
fn escape(value: &str) -> String {
    if value.contains(['"', ',', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.into()
    }
}
pub fn export(rows: &[Value]) -> String {
    let mut lines = vec![HEADERS.join(",")];
    for row in rows {
        let condition = CONDITIONS
            .iter()
            .find(|(key, _)| *key == db::string(row, "condition"))
            .map(|(_, label)| *label)
            .unwrap_or("");
        let language = LANGUAGES
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(db::string(row, "language")))
            .map(|(_, label)| *label)
            .unwrap_or(db::string(row, "language"));
        let fields = vec![
            db::string(row, "variantNumber").to_owned(),
            db::string(row, "name").into(),
            db::string(row, "setName").into(),
            db::string(row, "setCode").into(),
            db::string(row, "rarity").into(),
            db::string(row, "variantType").into(),
            db::string(row, "variantLabel").into(),
            (row["isFoil"] == true).to_string(),
            row["quantity"].to_string(),
            language.into(),
            condition.into(),
            db::string(row, "gradeCompany").into(),
            db::string(row, "gradeScore").into(),
            String::new(),
            db::string(row, "notes").into(),
        ];
        lines.push(
            fields
                .iter()
                .map(|field| escape(field))
                .collect::<Vec<_>>()
                .join(","),
        );
    }
    lines.join("\n")
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    #[test]
    fn aggregate_merges_stacks_in_first_seen_order_at_scale() {
        let item = |number: String, quantity: i64, notes: Option<&str>| json!({"variantNumber":number,"condition":"near_mint","language":"en","quantity":quantity,"notes":notes});
        let mut items: Vec<_> = (0..40_000)
            .map(|index| item(format!("OGN-{index}"), 1, None))
            .collect();
        items.push(item("OGN-7".into(), 2, Some("second copy")));
        items.push(json!({"variantNumber":"OGN-7","condition":"near_mint","language":"en","quantity":1,"isFoil":true}));
        let merged = aggregate(items);
        assert_eq!(merged.len(), 40_001);
        assert_eq!(merged[7]["quantity"], 3);
        assert_eq!(merged[7]["notes"], "second copy");
        assert_eq!(merged[7]["isGraded"], false);
        assert_eq!(merged[40_000]["isFoil"], true);
        assert_eq!(merged[39_999]["variantNumber"], "OGN-39999");
    }
    #[test]
    fn csv_items_use_the_same_limits_as_json_imports() {
        for (field, limit) in [
            ("Language", 16),
            ("Notes", 2000),
            ("Grading Company", 64),
            ("Grading Value", 32),
        ] {
            let mut fields = vec![String::new(); HEADERS.len()];
            fields[0] = "OGN-001".into();
            fields[8] = "1".into();
            fields[10] = "Near Mint".into();
            let index = HEADERS.iter().position(|value| *value == field).unwrap();
            fields[index] = "a".repeat(limit);
            assert_eq!(
                csv(&format!("{}\n{}", HEADERS.join(","), fields.join(",")))["items"]
                    .as_array()
                    .unwrap()
                    .len(),
                1
            );
            fields[index].push('a');
            let parsed = csv(&format!("{}\n{}", HEADERS.join(","), fields.join(",")));
            assert_eq!(parsed["items"], json!([]));
            assert_eq!(parsed["errors"][0]["row"], 2);
        }
    }
}
