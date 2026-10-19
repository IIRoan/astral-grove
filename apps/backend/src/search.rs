use crate::db;
use serde_json::Value;
use std::{cmp::Ordering, collections::HashSet, sync::LazyLock};
use unicode_normalization::{UnicodeNormalization, char::is_combining_mark};

pub fn compare(left: &str, right: &str) -> Ordering {
    static COLLATOR: LazyLock<icu_collator::CollatorBorrowed<'static>> = LazyLock::new(|| {
        icu_collator::Collator::try_new(Default::default(), Default::default())
            .unwrap_or_else(|_| unreachable!("compiled collation data"))
    });
    COLLATOR.compare(left, right)
}
pub fn normalize(raw: &str) -> String {
    let mut folded = String::new();
    for ch in raw.to_lowercase().chars() {
        folded.push_str(match ch {
            'æ' => "ae",
            'œ' => "oe",
            'ø' => "o",
            'ð' => "d",
            'þ' => "th",
            'ß' => "ss",
            'ł' => "l",
            'đ' => "d",
            'ħ' => "h",
            'ı' => "i",
            'ŋ' => "n",
            'ĸ' => "k",
            'ſ' => "s",
            'ﬀ' => "ff",
            'ﬁ' => "fi",
            'ﬂ' => "fl",
            'ﬃ' => "ffi",
            'ﬄ' => "ffl",
            'ﬅ' | 'ﬆ' => "st",
            _ => {
                folded.push(ch);
                continue;
            }
        });
    }
    let mut result = String::new();
    let mut space = false;
    for ch in folded.nfd().filter(|ch| !is_combining_mark(*ch)) {
        if ch.is_ascii_lowercase() || ch.is_ascii_digit() {
            if space && !result.is_empty() {
                result.push(' ');
            }
            space = false;
            result.push(ch);
        } else {
            space = true;
        }
    }
    result
}
pub struct Query {
    pub normalized: String,
    pub squashed: String,
    pub identity: Vec<String>,
    pub intents: Vec<String>,
}
pub fn parse(raw: &str) -> Query {
    let normalized = normalize(raw);
    let squashed = normalized.replace(' ', "");
    let mut identity = Vec::new();
    let mut intents = Vec::new();
    for word in normalized.split(' ').filter(|word| !word.is_empty()) {
        if ["a", "an", "and", "of", "the", "to", "for", "in", "on", "at"].contains(&word) {
            continue;
        }
        if [
            "legend",
            "champion",
            "spell",
            "unit",
            "gear",
            "rune",
            "battlefield",
            "signature",
        ]
        .contains(&word)
        {
            if !intents.iter().any(|value| value == word) {
                intents.push(word.into());
            }
        } else {
            identity.push(word.into());
        }
    }
    Query {
        normalized,
        squashed,
        identity,
        intents,
    }
}
pub fn similarity(left: &str, right: &str) -> f64 {
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    if left == right {
        return 1.0;
    }
    let trigrams = |text: &str| {
        let padded = format!("  {text} ");
        padded
            .as_bytes()
            .windows(3)
            .map(|bytes| bytes.to_vec())
            .collect::<HashSet<_>>()
    };
    let left = trigrams(left);
    let right = trigrams(right);
    let overlap = left.intersection(&right).count();
    overlap as f64 / (left.len() + right.len() - overlap) as f64
}
fn word_similarity(query: &str, name: &str) -> f64 {
    let normalized = normalize(name);
    let squashed = normalized.replace(' ', "");
    normalized
        .split(' ')
        .chain(std::iter::once(squashed.as_str()))
        .filter(|word| word.len().abs_diff(query.len()) <= 2)
        .map(|word| similarity(query, word))
        .fold(0.0, f64::max)
}
pub fn hits(name: &str, query: &Query) -> usize {
    let normalized = normalize(name);
    query
        .identity
        .iter()
        .filter(|token| normalized.split(' ').any(|word| word == token.as_str()))
        .count()
}
pub fn score(card: &Value, query: &Query) -> u8 {
    if query.identity.is_empty() && query.intents.is_empty() {
        return 99;
    }
    let name = normalize(db::string(card, "name"));
    let squashed = name.replace(' ', "");
    let kind = normalize(db::string(card, "type"));
    let supertype = normalize(db::string(card, "super"));
    let family = query.identity.first().is_some_and(|token| {
        name.split(' ').any(|word| word == token)
            || card["tags"].as_array().is_some_and(|tags| {
                tags.iter()
                    .filter_map(Value::as_str)
                    .map(normalize)
                    .any(|tag| tag.split(' ').any(|word| word == token))
            })
    });
    let type_ok = query
        .intents
        .iter()
        .all(|intent| kind.contains(intent) || supertype.contains(intent));
    if family && kind.contains("legend") && type_ok {
        return 0;
    }
    if family && supertype == "champion" && type_ok {
        return 1;
    }
    if family && !query.intents.is_empty() && type_ok {
        return 2;
    }
    if !query.identity.is_empty() && hits(db::string(card, "name"), query) == query.identity.len() {
        return 3;
    }
    if query
        .identity
        .first()
        .is_some_and(|token| name.split(' ').next() == Some(token))
        || name == query.normalized
        || squashed == query.squashed
    {
        return 3;
    }
    if !query.identity.is_empty()
        && (name.starts_with(&query.identity.join(" "))
            || !query.squashed.is_empty() && squashed.starts_with(&query.squashed))
    {
        return 4;
    }
    if query.squashed.len() >= 4
        && query.squashed.len().abs_diff(squashed.len()) <= 2
        && similarity(&query.squashed, &squashed) >= 0.45
        || query
            .identity
            .first()
            .is_some_and(|token| token.len() >= 4 && word_similarity(token, &name) >= 0.45)
    {
        return 4;
    }
    if query
        .identity
        .iter()
        .any(|token| name.split(' ').any(|word| word.starts_with(token)))
    {
        return 5;
    }
    let mut print_text = format!(
        "{} {} {}",
        db::string(card, "variantNumber"),
        db::string(card, "variantType"),
        db::string(card, "variantLabel")
    );
    if let Some(printings) = card["printings"].as_array() {
        for printing in printings {
            print_text.push_str(&format!(
                " {} {}",
                db::string(printing, "variantNumber"),
                db::string(printing, "variantLabel")
            ));
        }
    }
    let printing = normalize(&print_text);
    if query
        .identity
        .iter()
        .any(|token| printing.starts_with(token))
    {
        return 6;
    }
    if query.identity.iter().all(|token| name.contains(token))
        || !query.squashed.is_empty() && squashed.contains(&query.squashed)
    {
        return 7;
    }
    if query.identity.iter().any(|token| printing.contains(token)) {
        return 8;
    }
    if family {
        return 9;
    }
    10
}
#[derive(Default)]
pub struct Sql {
    pub values: Vec<sea_orm::Value>,
}
impl Sql {
    pub fn bind(&mut self, value: impl Into<sea_orm::Value>) -> String {
        self.values.push(value.into());
        format!("${}", self.values.len())
    }
}
fn split(query: &Value, key: &str, lower: bool) -> Vec<String> {
    db::string(query, key)
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            if lower {
                value.to_lowercase()
            } else {
                value.into()
            }
        })
        .collect()
}
fn like(value: &str) -> String {
    format!(
        "%{}%",
        value
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_")
    )
}
fn fuzzy(sql: &mut Sql, token: &str, threshold: f64) -> String {
    if token.len() < 4 {
        return "false".into();
    }
    let parameter = sql.bind(token);
    let length = token.len();
    format!(
        "(EXISTS(SELECT 1 FROM unnest(string_to_array(c.name_norm,' ')) AS w WHERE char_length(w)>=4 AND abs(char_length(w)-{length})<=2 AND similarity(w,{parameter})>={threshold}) OR (abs(char_length(c.name_squashed)-{length})<=2 AND similarity(c.name_squashed,{parameter})>={threshold}))"
    )
}
pub fn filters(query: &Value, sql: &mut Sql) -> String {
    let mut clauses = Vec::new();
    let q = db::string(query, "q");
    if !q.is_empty() {
        let parsed = parse(q);
        if parsed.identity.is_empty() && parsed.intents.is_empty() {
            if !parsed.normalized.is_empty() {
                clauses.push("false".into());
            }
        } else {
            let type_gate = parsed
                .intents
                .iter()
                .map(|intent| {
                    let p = sql.bind(like(intent));
                    format!("(lower(c.type) LIKE {p} OR lower(coalesce(c.super,'')) LIKE {p})")
                })
                .collect::<Vec<_>>()
                .join(" AND ");
            let mut gates = Vec::new();
            for token in &parsed.identity {
                let p = sql.bind(like(token));
                let regex = sql.bind(format!(
                    "(^|[^[:alnum:]_]){}([^[:alnum:]_]|$)",
                    regex_lite::escape(token)
                ));
                let fuzzy = fuzzy(sql, token, 0.35);
                gates.push(format!("(c.name ILIKE {p} OR c.name_norm LIKE {p} OR lower(c.type) LIKE {p} OR c.tags::text ILIKE {p} OR c.rules_search_text ~* {regex} OR {fuzzy} OR lower(v.variant_number) LIKE {p} OR lower(v.variant_label) LIKE {p} OR lower(v.variant_type) LIKE {p} OR v.variant_types::text ILIKE {p} OR lower(coalesce(v.artist,'')) LIKE {p} OR v.flavor_text ~* {regex} OR lower(s.name) LIKE {p} OR lower(s.code) LIKE {p})"));
            }
            let mut alternatives = Vec::new();
            if !gates.is_empty() {
                alternatives.push(format!("({})", gates.join(" AND ")));
                if !parsed.squashed.is_empty() {
                    let p = sql.bind(like(&parsed.squashed));
                    alternatives.push(format!("c.name_squashed LIKE {p}"));
                }
                if parsed.normalized.len() >= 4 {
                    alternatives.push(fuzzy(sql, &parsed.normalized, 0.35));
                }
            }
            let identity = if alternatives.is_empty() {
                "true".into()
            } else {
                format!("({})", alternatives.join(" OR "))
            };
            clauses.push(if type_gate.is_empty() {
                identity
            } else {
                format!("({identity} AND {type_gate})")
            });
        }
    }
    for (key, column, lower) in [
        ("sets", "s.code", false),
        ("rarities", "v.rarity", false),
        ("super", "lower(c.super)", true),
    ] {
        let values = split(query, key, lower);
        if !values.is_empty() {
            let p = sql.bind(values);
            clauses.push(format!("{column}=ANY({p}::text[])"));
        }
    }
    let values = split(query, "types", true);
    if !values.is_empty() {
        let p = sql.bind(values);
        clauses.push(format!(
            "string_to_array(lower(trim(c.type)),' ') && {p}::text[]"
        ));
    }
    let values = split(query, "variants", true);
    if !values.is_empty() {
        let p = sql.bind(values);
        clauses.push(format!("(lower(v.variant_type)=ANY({p}::text[]) OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(v.variant_types) AS vt(value) WHERE lower(vt.value)=ANY({p}::text[])))"));
    }
    if query["sortBy"] == "energy"
        || query.get("energyMin").is_some()
        || query.get("energyMax").is_some()
    {
        clauses.push("NOT (string_to_array(lower(trim(c.type)),' ') && ARRAY['legend','battlefield']::text[])".into());
    }
    for (key, column, operator) in [
        ("energyMin", "c.energy", ">="),
        ("energyMax", "c.energy", "<="),
        ("mightMin", "c.might", ">="),
        ("mightMax", "c.might", "<="),
        ("powerMin", "c.power", ">="),
        ("powerMax", "c.power", "<="),
    ] {
        if let Some(value) = query[key].as_i64() {
            let p = sql.bind(value);
            clauses.push(format!("{column}{operator}{p}"));
        }
    }
    let colors = split(query, "colors", true);
    if !colors.is_empty() {
        if query["colorMode"] == "within" {
            let p = sql.bind(colors);
            clauses.push(format!("NOT EXISTS(SELECT 1 FROM card_colors cc JOIN colors co ON co.id=cc.color_id WHERE cc.card_id=c.id AND NOT(lower(co.name)=ANY({p}::text[])))"));
        } else {
            for color in colors {
                let p = sql.bind(color);
                clauses.push(format!("EXISTS(SELECT 1 FROM card_colors cc JOIN colors co ON co.id=cc.color_id WHERE cc.card_id=c.id AND lower(co.name)={p})"));
            }
        }
    }
    if query["excludeTokens"] == true {
        clauses.push("v.variant_number !~* '-T[0-9]+$'".into());
    }
    if clauses.is_empty() {
        "true".into()
    } else {
        clauses.join(" AND ")
    }
}
