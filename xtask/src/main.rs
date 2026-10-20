use anyhow::{Context, ensure};
use std::{path::Path, process::Command};

fn main() -> anyhow::Result<()> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .context("workspace root")?;
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("openapi") => {
            let text = format!(
                "{}\n",
                serde_json::to_string_pretty(&astral_grove_server::openapi())?
            );
            let path = root.join("packages/api-contracts/openapi.json");
            if args.iter().any(|arg| arg == "--check") {
                let mut actual =
                    serde_json::from_str::<serde_json::Value>(&std::fs::read_to_string(&path)?)?;
                let mut expected = serde_json::from_str::<serde_json::Value>(&text)?;
                normalize_json_numbers(&mut actual);
                normalize_json_numbers(&mut expected);
                ensure!(actual == expected, "OpenAPI is stale");
            } else {
                std::fs::create_dir_all(path.parent().context("contract directory")?)?;
                std::fs::write(path, text)?;
            }
            let result = Command::new("bun")
                .current_dir(root.join("packages/api-contracts"))
                .args(if args.iter().any(|arg| arg == "--check") {
                    vec!["run", "generate:check"]
                } else {
                    vec!["run", "generate"]
                })
                .status()?;
            ensure!(result.success(), "TypeScript contract generation failed");
        }
        _ => anyhow::bail!("usage: cargo xtask openapi [--check]"),
    }
    Ok(())
}

fn normalize_json_numbers(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Number(number) => {
            if let Some(normalized) = number.as_f64().and_then(serde_json::Number::from_f64) {
                *number = normalized
            }
        }
        serde_json::Value::Array(items) => items.iter_mut().for_each(normalize_json_numbers),
        serde_json::Value::Object(items) => items.values_mut().for_each(normalize_json_numbers),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn json_schema_numeric_comparison_matches_javascript_generation() {
        let mut native = serde_json::json!({"minimum":1.0,"maximum":100.0,"array":[-0.0,3.5]});
        let mut generated = serde_json::json!({"minimum":1,"maximum":100,"array":[0,3.5]});
        normalize_json_numbers(&mut native);
        normalize_json_numbers(&mut generated);
        assert_eq!(native, generated);
        generated["minimum"] = serde_json::json!(2.0);
        assert_ne!(native, generated);
    }
}
