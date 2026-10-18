use astral_grove_server::http::schemas;
use serde_json::{Value, json};
use std::io::{BufRead, Write};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut out = std::io::BufWriter::new(std::io::stdout().lock());
    for line in std::io::stdin().lock().lines() {
        let row: Value = serde_json::from_str(&line?)?;
        let name = row["schema"].as_str().ok_or("Missing schema")?;
        if row["auth"] == true {
            let input = if row["hasInput"] == true {
                row.get("input")
            } else {
                None
            };
            let empty = serde_json::json!({});
            let body = if row["kind"] == "body" { input } else { None };
            let query = if row["kind"] == "query" {
                input.unwrap_or(&empty)
            } else {
                &empty
            };
            let output = match astral_grove_server::auth::pipeline::validate_kind(
                name,
                row["kind"].as_str().ok_or("kind")?,
                if row["kind"] == "body" {
                    body
                } else {
                    Some(query)
                },
            ) {
                Ok(()) => json!({"ok":true}),
                Err(error) => json!({"ok":false,"message":error.body["message"]}),
            };
            serde_json::to_writer(&mut out, &output)?;
            writeln!(out)?;
            continue;
        }
        let result = schemas::schema(name).parse(if row["hasInput"] == true {
            row.get("input")
        } else {
            None
        });
        let output = match result {
            Ok(Some(value)) => {
                match astral_grove_api_types::checks::round_trip(name, value.clone()) {
                    Ok(_) => json!({"ok": true, "value": value, "hasValue": true}),
                    Err(_) => {
                        json!({"ok": true, "value": value, "hasValue": true, "dtoError": true})
                    }
                }
            }
            Ok(None) => json!({"ok": true, "hasValue": false}),
            Err(_) => json!({"ok": false}),
        };
        serde_json::to_writer(&mut out, &output)?;
        writeln!(out)?;
    }
    Ok(())
}
