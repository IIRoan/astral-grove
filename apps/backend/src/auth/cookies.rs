use crate::config::Config;
use axum::http::HeaderMap;
use base64::{Engine, engine::general_purpose::STANDARD};
use hmac::{KeyInit, Mac};

type Hmac = hmac::Hmac<sha2::Sha256>;

pub fn sign(secret: &str, token: &str) -> Option<String> {
    let mut mac = <Hmac as KeyInit>::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(token.as_bytes());
    Some(format!(
        "{token}.{}",
        STANDARD.encode(mac.finalize().into_bytes())
    ))
}
pub fn verify(secret: &str, value: &str) -> Option<String> {
    let decoded = percent_encoding::percent_decode_str(value)
        .decode_utf8()
        .ok()?;
    let (token, signature) = decoded.rsplit_once('.')?;
    let signature = STANDARD.decode(signature).ok()?;
    let mut mac = <Hmac as KeyInit>::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(token.as_bytes());
    mac.verify_slice(&signature).ok()?;
    (!token.is_empty()).then(|| token.to_owned())
}
pub fn encode(value: &str) -> String {
    const SET: &percent_encoding::AsciiSet = &percent_encoding::NON_ALPHANUMERIC
        .remove(b'-')
        .remove(b'_')
        .remove(b'.')
        .remove(b'!')
        .remove(b'~')
        .remove(b'*')
        .remove(b'\'')
        .remove(b'(')
        .remove(b')');
    percent_encoding::utf8_percent_encode(value, SET).to_string()
}
pub fn name(config: &Config) -> &'static str {
    if config.secure_cookies {
        "__Secure-better-auth.session_token"
    } else {
        "better-auth.session_token"
    }
}
pub fn cookie(config: &Config, value: &str, age: Option<i64>) -> String {
    cookie_kind(config, "session_token", value, age)
}
pub fn cookie_kind(config: &Config, kind: &str, value: &str, age: Option<i64>) -> String {
    let prefix = if config.secure_cookies {
        "__Secure-"
    } else {
        ""
    };
    let mut cookie = format!("{prefix}better-auth.{kind}={value}; Path=/; HttpOnly; SameSite=Lax");
    if let Some(age) = age {
        cookie.push_str(&format!("; Max-Age={age}"));
    }
    if config.secure_cookies {
        cookie.push_str("; Secure");
    }
    if let Some(domain) = &config.cookie_domain {
        cookie.push_str(&format!("; Domain={domain}"));
    }
    cookie
}
pub fn token(config: &Config, headers: &HeaderMap) -> Option<String> {
    if let Some(value) = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        && value
            .get(..7)
            .is_some_and(|scheme| scheme.eq_ignore_ascii_case("bearer "))
    {
        let value = value.get(7..)?.trim();
        return if value.contains('.') {
            verify(&config.auth_secret, value)
        } else {
            (!value.is_empty()).then(|| value.to_owned())
        };
    }
    for header in headers.get_all("cookie") {
        for pair in header.to_str().ok()?.split(';') {
            if let Some((key, value)) = pair.trim().split_once('=')
                && key == name(config)
            {
                return verify(&config.auth_secret, value.trim_matches('"'));
            }
        }
    }
    None
}

pub fn dont_remember(config: &Config, headers: &HeaderMap) -> bool {
    let name = format!(
        "{}better-auth.dont_remember",
        if config.secure_cookies {
            "__Secure-"
        } else {
            ""
        }
    );
    headers
        .get_all("cookie")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .filter_map(|v| v.trim().split_once('='))
        .any(|(key, value)| {
            key == name && verify(&config.auth_secret, value).as_deref() == Some("true")
        })
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    #[test]
    fn signed_cookie_tampering_is_rejected() {
        let value = sign("test-secret", "test-token").unwrap();
        assert_eq!(
            verify("test-secret", &encode(&value)).as_deref(),
            Some("test-token")
        );
        assert!(verify("other-secret", &value).is_none());
        assert!(verify("test-secret", "forged.token").is_none());
    }
}
