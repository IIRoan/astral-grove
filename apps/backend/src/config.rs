use std::collections::BTreeMap;
use url::Url;

#[derive(Clone)]
pub struct Config {
    pub values: BTreeMap<String, String>,
    pub production: bool,
    pub database_url: String,
    pub pool_max: u32,
    pub host: String,
    pub port: u16,
    pub auth_secret: String,
    pub auth_url: Url,
    pub public_url: String,
    pub admin_token: String,
    pub pa_key: String,
    pub pa_url: String,
    pub trusted_origins: Vec<String>,
    pub cookie_domain: Option<String>,
    pub secure_cookies: bool,
    pub retain_days: i64,
    pub retain_snapshots: i64,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Self::from_map(std::env::vars().collect())
    }
    pub fn from_map(mut values: BTreeMap<String, String>) -> anyhow::Result<Self> {
        let get =
            |key: &str, fallback: &str| values.get(key).cloned().unwrap_or_else(|| fallback.into());
        let mode = get("NODE_ENV", "development");
        anyhow::ensure!(
            ["development", "production", "test"].contains(&mode.as_str()),
            "Invalid NODE_ENV"
        );
        let production = mode == "production";
        let mut database_url = get("DATABASE_URL", "");
        if production && let Ok(mut parsed) = Url::parse(&database_url) {
            let mode = parsed
                .query_pairs()
                .find(|(key, _)| key == "sslmode")
                .map(|(_, value)| value.into_owned());
            if !matches!(
                mode.as_deref(),
                Some("disable" | "require" | "verify-full" | "verify-ca")
            ) {
                let pairs = parsed
                    .query_pairs()
                    .filter(|(key, _)| key != "sslmode")
                    .map(|(key, value)| (key.into_owned(), value.into_owned()))
                    .collect::<Vec<_>>();
                parsed.set_query(None);
                parsed
                    .query_pairs_mut()
                    .extend_pairs(pairs)
                    .append_pair("sslmode", "require");
                database_url = parsed.into();
            }
        }
        anyhow::ensure!(!database_url.is_empty(), "DATABASE_URL is required");
        let port_value = crate::http::zod::js_number(&get("PORT", "7000"));
        anyhow::ensure!(
            port_value.fract() == 0.0 && (1.0..=65535.0).contains(&port_value),
            "Invalid PORT"
        );
        let port = port_value as u16;
        anyhow::ensure!(port > 0, "Invalid PORT");
        let pool_value =
            crate::http::zod::js_number(&get("DB_POOL_MAX", if production { "10" } else { "20" }));
        anyhow::ensure!(
            pool_value.fract() == 0.0 && (1.0..=50.0).contains(&pool_value),
            "Invalid DB_POOL_MAX"
        );
        let pool_max = pool_value as u32;
        anyhow::ensure!((1..=50).contains(&pool_max), "Invalid DB_POOL_MAX");
        let auth_secret = get("BETTER_AUTH_SECRET", "");
        anyhow::ensure!(
            auth_secret.encode_utf16().count() >= 32,
            "BETTER_AUTH_SECRET must have at least 32 characters"
        );
        let admin_token = get("ADMIN_SYNC_TOKEN", "");
        anyhow::ensure!(
            admin_token.encode_utf16().count() >= 16,
            "ADMIN_SYNC_TOKEN must have at least 16 characters"
        );
        let pa_key = get("PA_API_KEY", "");
        anyhow::ensure!(pa_key.starts_with("ak_"), "Invalid PA_API_KEY");
        for key in [
            "UPSTREAM_DECK_WRITE_EXTRA_HEADER_NAME",
            "UPSTREAM_DECK_WRITE_EXTRA_HEADER_VALUE",
            "AUTH_COOKIE_DOMAIN",
            "S3_ACCESS_KEY_ID",
            "S3_SECRET_ACCESS_KEY",
            "S3_BUCKET",
            "S3_REGION",
            "STALWART_JMAP_USERNAME",
            "STALWART_JMAP_PASSWORD",
            "EMAIL_FROM_NAME",
        ] {
            if let Some(value) = values.get(key) {
                anyhow::ensure!(!value.is_empty(), "{key} must not be empty");
            }
        }
        for key in [
            "S3_ENDPOINT",
            "STALWART_JMAP_URL",
            "IMAGE_CDN_BASE_URL",
            "CARDMARKET_EXPORT_BASE_URL",
        ] {
            if let Some(value) = values.get(key) {
                Url::parse(value).map_err(|_| anyhow::anyhow!("Invalid {key}"))?;
            }
        }
        if let Some(value) = values.get("EMAIL_FROM") {
            anyhow::ensure!(crate::http::is_zod_email(value), "Invalid EMAIL_FROM");
        }
        for (key, maximum) in [
            ("CARDMARKET_GAME_ID", None),
            ("PRICE_HISTORY_RETAIN_DAYS", Some(3650.0)),
            ("PRICE_HISTORY_RETAIN_SNAPSHOTS", Some(1000.0)),
        ] {
            if let Some(value) = values.get(key) {
                let value = crate::http::zod::js_number(value);
                anyhow::ensure!(
                    value.is_finite()
                        && value.fract() == 0.0
                        && value > 0.0
                        && maximum.is_none_or(|maximum| value <= maximum),
                    "Invalid {key}"
                );
            }
        }
        let retain = |key: &str, default: i64| {
            values
                .get(key)
                .map_or(default, |value| crate::http::zod::js_number(value) as i64)
        };
        let retain_days = retain("PRICE_HISTORY_RETAIN_DAYS", 90);
        let retain_snapshots = retain("PRICE_HISTORY_RETAIN_SNAPSHOTS", 30);
        let auth_url = Url::parse(&get("BETTER_AUTH_URL", "http://localhost:7000"))?;
        let public = get("PUBLIC_APP_URL", "");
        anyhow::ensure!(
            !production || !public.is_empty(),
            "PUBLIC_APP_URL is required in production"
        );
        let public_url = if !public.is_empty() {
            Url::parse(&public)?;
            public.trim_end_matches('/').into()
        } else if !matches!(auth_url.host_str(), Some("localhost" | "127.0.0.1")) {
            auth_url.origin().ascii_serialization()
        } else {
            "http://localhost:7001".into()
        };
        let trusted: Vec<String> = get("TRUSTED_ORIGINS", "")
            .split(',')
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .collect();
        let cookie_domain = values.get("AUTH_COOKIE_DOMAIN").cloned().or_else(|| {
            if !production {
                return None;
            }
            let api = auth_url.host_str()?;
            let mut hosts = vec![api.to_owned()];
            hosts.extend(
                trusted
                    .iter()
                    .filter_map(|value| Url::parse(value).ok()?.host_str().map(str::to_owned)),
            );
            let parts: Vec<Vec<&str>> = hosts
                .iter()
                .map(|host| host.split('.').collect::<Vec<_>>())
                .filter(|parts| parts.len() >= 3)
                .collect();
            let mut shared = None;
            if trusted.is_empty() {
                return (api.split('.').count() >= 3).then(|| {
                    api.split('.')
                        .rev()
                        .take(2)
                        .collect::<Vec<_>>()
                        .into_iter()
                        .rev()
                        .collect::<Vec<_>>()
                        .join(".")
                });
            }
            let first = parts.first()?;
            for depth in 2..=parts.iter().map(Vec::len).min()? {
                let suffix = &first[first.len() - depth..];
                if parts
                    .iter()
                    .all(|part| &part[part.len() - depth..] == suffix)
                {
                    shared = Some(suffix.join("."));
                }
            }
            shared
        });
        let mut trusted_origins = trusted;
        trusted_origins.extend([
            auth_url.origin().ascii_serialization(),
            Url::parse(&public_url)?.origin().ascii_serialization(),
            "astral-grove://".into(),
            "astral-grove://*".into(),
        ]);
        if !production {
            trusted_origins.extend(
                [
                    "http://localhost:7000",
                    "http://localhost:7001",
                    "http://localhost:7011",
                    "exp://*",
                    "exp+astral-grove://*",
                    "astral-grove-dev://*",
                    "https://u.expo.dev",
                    "https://*.u.expo.dev",
                ]
                .map(str::to_owned),
            );
        }
        let secure_cookies = production || auth_url.scheme() == "https";
        let host = get("HOST", "::");
        anyhow::ensure!(!host.is_empty(), "HOST is required");
        let pa_url = get("PA_BASE_URL", "https://piltoverarchive.com/api/external")
            .trim_end_matches('/')
            .to_owned();
        Url::parse(&pa_url)?;
        if let Some(value) = values.get("CARDMARKET_GAME_ID") {
            let normalized = crate::http::zod::js_number_string(crate::http::zod::js_number(value));
            values.insert("CARDMARKET_GAME_ID".into(), normalized);
        }
        Ok(Self {
            retain_days,
            retain_snapshots,
            host,
            pa_url,
            values,
            production,
            database_url,
            pool_max,
            port,
            auth_secret,
            auth_url,
            public_url,
            admin_token,
            pa_key,
            trusted_origins,
            cookie_domain,
            secure_cookies,
        })
    }
    pub fn email_enabled(&self) -> bool {
        [
            "STALWART_JMAP_USERNAME",
            "STALWART_JMAP_PASSWORD",
            "EMAIL_FROM",
        ]
        .iter()
        .all(|key| self.values.get(*key).is_some_and(|value| !value.is_empty()))
    }
    pub fn origin_allowed(&self, origin: &str) -> bool {
        self.trusted_origins
            .iter()
            .any(|pattern| crate::auth::pipeline::matches_origin(origin, pattern, false))
    }
    #[cfg(test)]
    pub fn for_test(extra: &[(&str, &str)]) -> anyhow::Result<Self> {
        let base = [
            ("DATABASE_URL", "postgres://localhost/riftbound_test"),
            ("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret"),
            ("ADMIN_SYNC_TOKEN", "test-admin-token"),
            ("PA_API_KEY", "ak_test"),
        ];
        Self::from_map(
            base.iter()
                .chain(extra)
                .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
                .collect(),
        )
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::Config;
    #[test]
    fn price_retention_defaults_and_rejects_values_that_would_prune_everything() {
        let config = Config::for_test(&[]).unwrap();
        assert_eq!((config.retain_days, config.retain_snapshots), (90, 30));
        let config = Config::for_test(&[("PRICE_HISTORY_RETAIN_SNAPSHOTS", "12")]).unwrap();
        assert_eq!(config.retain_snapshots, 12);
        for bad in ["", "thirty", "30d", "0", "-1", "1.5"] {
            assert!(Config::for_test(&[("PRICE_HISTORY_RETAIN_SNAPSHOTS", bad)]).is_err());
            assert!(Config::for_test(&[("PRICE_HISTORY_RETAIN_DAYS", bad)]).is_err());
        }
    }
}
