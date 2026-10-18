use serde_json::{Value, json};
fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    value[key].as_str().unwrap_or("")
}
fn entries<'a>(input: &'a Value, key: &str) -> &'a [Value] {
    input[key].as_array().map(Vec::as_slice).unwrap_or(&[])
}
fn count(input: &Value, key: &str) -> i64 {
    entries(input, key)
        .iter()
        .filter_map(|row| row["count"].as_i64())
        .sum()
}
fn name(card: &Value) -> &str {
    text(card, "name")
}
fn primary(card: &Value) -> &str {
    name(card)
        .split(" - ")
        .next()
        .unwrap_or("")
        .split(',')
        .next()
        .unwrap_or("")
        .trim()
}
fn tags(card: &Value) -> Vec<String> {
    card["tags"]
        .as_array()
        .map(|tags| {
            tags.iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|tag| !tag.is_empty())
                .map(str::to_lowercase)
                .collect()
        })
        .unwrap_or_default()
}
fn shares_tag(legend: &Value, card: &Value) -> bool {
    let mut legend_tags = tags(legend);
    if legend_tags.is_empty() && !primary(legend).is_empty() {
        legend_tags.push(primary(legend).to_lowercase());
    }
    if legend_tags.is_empty() {
        return true;
    }
    let card_name = name(card).to_lowercase();
    let primary = primary(legend).to_lowercase();
    (!primary.is_empty() && card_name.contains(&primary))
        || tags(card).iter().any(|tag| legend_tags.contains(tag))
        || legend_tags.iter().any(|tag| card_name.contains(tag))
}
fn domains(card: &Value) -> Vec<&str> {
    card["colors"]
        .as_array()
        .map(|colors| {
            colors
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|color| !color.is_empty())
                .collect()
        })
        .unwrap_or_default()
}
pub fn rules(format: &str) -> Value {
    serde_json::from_str(if format == "pre-rift" {
        include_str!("rules/pre-rift.json")
    } else {
        include_str!("rules/constructed.json")
    })
    .unwrap_or_else(|_| unreachable!("checked-in rule constants"))
}
pub fn validate(input: &Value) -> Vec<Value> {
    let mut messages = Vec::new();
    let sealed = input["format"] == "pre-rift";
    let mut push = |kind: &str, code: &str, message: String| {
        messages.push(json!({"type":kind,"code":code,"message":message}))
    };
    let legend = (!input["legend"].is_null()).then_some(&input["legend"]);
    let champion = (!input["champion"].is_null()).then_some(&input["champion"]);
    if legend.is_none() {
        push(
            if sealed { "warning" } else { "error" },
            "missing_legend",
            "No Champion Legend selected (need 1).".into(),
        );
    }
    if let Some(champion) = champion {
        if !sealed
            && let Some(legend) = legend
            && !shares_tag(legend, champion)
        {
            push(
                "error",
                "champion_tag_mismatch",
                format!(
                    "Chosen Champion \"{}\" must share a champion tag with your Legend \"{}\".",
                    name(champion),
                    name(legend)
                ),
            );
        }
        if text(champion, "super").to_lowercase() != "champion" {
            push(
                "error",
                "champion_supertype",
                format!(
                    "Chosen Champion \"{}\" must be a Champion Unit (supertype: Champion).",
                    name(champion)
                ),
            );
        }
    } else {
        push(
            if sealed { "warning" } else { "error" },
            "missing_champion",
            "No Chosen Champion selected (need 1).".into(),
        );
    }
    if sealed {
        let mut all = Vec::new();
        for card in legend.into_iter().chain(champion).chain(
            ["mainDeck", "runes", "battlefields", "sideboard"]
                .iter()
                .flat_map(|section| entries(input, section).iter().map(|row| &row["card"])),
        ) {
            for domain in domains(card) {
                if !all.contains(&domain) {
                    all.push(domain);
                }
            }
        }
        if all.len() > 3 {
            push(
                "error",
                "domain_cap",
                format!(
                    "Deck uses {} domains ({}); Pre-Rift allows at most 3.",
                    all.len(),
                    all.join(", ")
                ),
            );
        }
    } else if let Some(legend) = legend {
        let identity = domains(legend);
        for (section, prefix) in [("mainDeck", ""), ("runes", "Rune ")] {
            for row in entries(input, section) {
                let card = &row["card"];
                if !domains(card).iter().all(|domain| identity.contains(domain)) {
                    push(
                        "error",
                        "domain_identity",
                        format!(
                            "{prefix}\"{}\" does not match your Legend's Domain Identity.",
                            name(card)
                        ),
                    );
                }
            }
        }
        if let Some(champion) = champion
            && !domains(champion)
                .iter()
                .all(|domain| identity.contains(domain))
        {
            push(
                "error",
                "domain_identity",
                format!(
                    "Chosen Champion \"{}\" does not match your Legend's Domain Identity.",
                    name(champion)
                ),
            );
        }
    }
    let mut counts: Vec<(&str, i64)> = Vec::new();
    for (card, amount) in champion.into_iter().map(|card| (card, 1)).chain(
        ["mainDeck", "runes", "battlefields", "sideboard"]
            .iter()
            .flat_map(|section| {
                entries(input, section)
                    .iter()
                    .map(|row| (&row["card"], row["count"].as_i64().unwrap_or(0)))
            }),
    ) {
        let name = name(card);
        if let Some(row) = counts.iter_mut().find(|row| row.0 == name) {
            row.1 += amount;
        } else {
            counts.push((name, amount));
        }
    }
    for (name, total) in counts {
        if name == "Spiderling"
            || entries(input, "battlefields")
                .iter()
                .any(|row| self::name(&row["card"]) == name)
        {
            continue;
        }
        let rune = entries(input, "runes")
            .iter()
            .any(|row| self::name(&row["card"]) == name);
        let cap = if rune {
            Some(12)
        } else if sealed {
            None
        } else {
            Some(3)
        };
        if let Some(cap) = cap
            && total > cap
        {
            push(
                "error",
                "copy_limit",
                format!("\"{name}\" has {total} copies (max {cap})."),
            );
        }
    }
    let signatures: i64 = entries(input, "mainDeck")
        .iter()
        .filter(|row| row["card"]["isSignature"] == true)
        .filter_map(|row| row["count"].as_i64())
        .sum();
    if !sealed && signatures > 3 {
        push(
            "error",
            "signature_cap",
            format!("{signatures} Signature cards in deck (max 3 total)."),
        );
    }
    if !sealed && let Some(legend) = legend {
        for row in entries(input, "mainDeck") {
            let card = &row["card"];
            if card["isSignature"] == true && !shares_tag(legend, card) {
                push(
                    "error",
                    "signature_tag",
                    format!(
                        "Signature card \"{}\" must share a Champion tag with your Legend.",
                        name(card)
                    ),
                );
            }
        }
    }
    let main = count(input, "mainDeck");
    let minimum = if sealed { 25 } else { 39 };
    if main < minimum {
        push(
            "warning",
            "main_deck_count",
            if sealed {
                format!("Main Deck has {main} cards (need at least {minimum}).")
            } else {
                format!(
                    "Main Deck has {main} cards (need at least {minimum}, plus Chosen Champion = 40)."
                )
            },
        );
    }
    let runes = count(input, "runes");
    if runes != 12 {
        push(
            if runes < 12 { "warning" } else { "error" },
            "rune_count",
            format!("Rune Deck has {runes} cards (need exactly 12)."),
        );
    }
    let battlefields = count(input, "battlefields");
    if sealed {
        if battlefields > 3 {
            push(
                "error",
                "battlefield_count",
                format!("Battlefields: {battlefields} (max 3)."),
            );
        }
    } else if battlefields != 3 {
        push(
            if battlefields < 3 { "warning" } else { "error" },
            "battlefield_count",
            format!("Battlefields: {battlefields} (need exactly 3)."),
        );
    }
    let cap = if sealed { 3 } else { 1 };
    for row in entries(input, "battlefields") {
        let amount = row["count"].as_i64().unwrap_or(0);
        if amount > cap {
            push(
                "error",
                "battlefield_unique",
                format!(
                    "Battlefield \"{}\" appears {amount} times (max {cap}).",
                    name(&row["card"])
                ),
            );
        }
    }
    let sideboard = count(input, "sideboard");
    let cap = if sealed { 8 } else { 10 };
    if sideboard > cap {
        push(
            "error",
            "sideboard_count",
            format!("Sideboard has {sideboard} cards (max {cap})."),
        );
    }
    for row in entries(input, "sideboard") {
        if row["card"]["isSignature"] == true {
            push(
                "error",
                "signature_sideboard",
                format!(
                    "Signature card \"{}\" cannot be in the sideboard.",
                    name(&row["card"])
                ),
            );
        }
    }
    if messages.is_empty() {
        messages.push(json!({"type":"valid","code":"deck_valid","message":"Deck is valid!"}));
    }
    messages
}
