//! Masks objectionable words in deck text other users can see (community and shared decks).
use serde_json::Value;

const BLOCKED: [&str; 40] = [
    "fuck",
    "fucker",
    "fuckers",
    "fucking",
    "fucked",
    "motherfucker",
    "shit",
    "shitty",
    "bullshit",
    "cunt",
    "cunts",
    "bitch",
    "bitches",
    "asshole",
    "assholes",
    "dick",
    "dicks",
    "cock",
    "cocks",
    "pussy",
    "whore",
    "whores",
    "slut",
    "sluts",
    "bastard",
    "wanker",
    "twat",
    "nigger",
    "niggers",
    "nigga",
    "niggas",
    "faggot",
    "faggots",
    "fag",
    "fags",
    "retard",
    "retards",
    "kike",
    "spic",
    "chink",
];

fn push_word(word: &mut String, out: &mut String) {
    if BLOCKED.contains(&word.to_lowercase().as_str()) {
        out.extend(word.chars().map(|_| '*'));
    } else {
        out.push_str(word);
    }
    word.clear();
}

pub fn mask(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut word = String::new();
    for ch in text.chars() {
        if ch.is_alphanumeric() {
            word.push(ch);
        } else {
            push_word(&mut word, &mut out);
            out.push(ch);
        }
    }
    push_word(&mut word, &mut out);
    out
}

/// Applies [`mask`] to the user-written fields of a deck payload.
pub fn mask_deck(deck: &mut Value) {
    for key in ["name", "description", "authorName"] {
        if let Some(text) = deck.get(key).and_then(Value::as_str) {
            let masked = mask(text);
            deck[key] = Value::String(masked);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn masks_whole_words_case_insensitively_and_keeps_the_rest() {
        assert_eq!(mask("Fuck this Shit deck!"), "**** this **** deck!");
        assert_eq!(
            mask("Scunthorpe aggro, Dickens tempo"),
            "Scunthorpe aggro, Dickens tempo"
        );
        assert_eq!(mask(""), "");
    }

    #[test]
    fn masks_only_user_written_deck_fields() {
        let mut deck = json!({
            "name": "shit list",
            "description": null,
            "authorName": "Bitch",
            "legend": {"name": "fuck"}
        });
        mask_deck(&mut deck);
        assert_eq!(deck["name"], "**** list");
        assert_eq!(deck["description"], Value::Null);
        assert_eq!(deck["authorName"], "*****");
        assert_eq!(deck["legend"]["name"], "fuck");
    }
}
