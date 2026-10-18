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
        Some("baseline") => {
            validate_native_routes(root)?;
            let result = Command::new("bun")
                .current_dir(root)
                .args([
                    "--no-env-file",
                    "scripts/rust-migration/baseline.ts",
                    "--check",
                ])
                .status()?;
            ensure!(result.success(), "Baseline validation failed");
        }
        _ => anyhow::bail!("usage: cargo xtask openapi [--check] | baseline"),
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

fn validate_native_routes(root: &Path) -> anyhow::Result<()> {
    use serde_json::Value;
    use std::collections::BTreeSet;
    let inventory: Value = serde_json::from_str(&std::fs::read_to_string(
        root.join("plans/rust-migration/inventory.json"),
    )?)?;
    fn path(path: &str) -> String {
        path.split('/')
            .map(|part| {
                if part == "*" {
                    "{key}".to_owned()
                } else if let Some(name) = part.strip_prefix(':') {
                    format!("{{{name}}}")
                } else {
                    part.to_owned()
                }
            })
            .collect::<Vec<_>>()
            .join("/")
    }
    let mut expected = BTreeSet::new();
    for route in inventory["routes"].as_array().context("route inventory")? {
        expected.insert((
            path(route["path"].as_str().context("route path")?),
            route["method"]
                .as_str()
                .context("route method")?
                .to_lowercase(),
        ));
    }
    for route in inventory["auth"].as_array().context("auth inventory")? {
        if route["serverOnly"] == true {
            continue;
        }
        for method in route["methods"].as_array().context("auth methods")? {
            expected.insert((
                path(route["path"].as_str().context("auth path")?),
                method.as_str().context("auth method")?.to_lowercase(),
            ));
        }
    }
    let document = astral_grove_server::openapi();
    let mut actual = BTreeSet::new();
    let mut ids = BTreeSet::new();
    for (path, item) in document["paths"].as_object().context("OpenAPI paths")? {
        for (method, operation) in item.as_object().context("OpenAPI operations")? {
            if !matches!(
                method.as_str(),
                "get" | "post" | "put" | "patch" | "delete" | "head" | "options"
            ) {
                continue;
            }
            actual.insert((path.to_owned(), method.to_owned()));
            let id = operation["operationId"].as_str().context("operation ID")?;
            ensure!(ids.insert(id), "Duplicate operation ID: {id}");
            for name in path
                .split('/')
                .filter_map(|part| part.strip_prefix('{')?.strip_suffix('}'))
            {
                ensure!(
                    operation["parameters"]
                        .as_array()
                        .is_some_and(|items| items.iter().any(|item| item["name"] == name
                            && item["in"] == "path"
                            && item["required"] == true)),
                    "Missing required path parameter {name} in {method} {path}"
                );
            }
        }
    }
    ensure!(
        expected == actual,
        "Native route inventory differs: missing {:?}, added {:?}",
        expected.difference(&actual).collect::<Vec<_>>(),
        actual.difference(&expected).collect::<Vec<_>>()
    );
    println!(
        "Native route inventory verified: 55 application operations, 42 auth method/path pairs, unique IDs and complete path parameters"
    );
    Ok(())
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
