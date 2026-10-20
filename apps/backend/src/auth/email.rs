use super::error;
use crate::{AppState, error::Result};
use serde_json::{Value, json};

/// Runs account-dependent lookups and delivery after responding, so timing does not reveal registered addresses.
pub fn detach(
    state: &AppState,
    job: impl std::future::Future<Output = Result<()>> + Send + 'static,
) -> Result<()> {
    if state.emails.spawn(async move {
        if let Err(failure) = job.await {
            tracing::warn!(
                category = "email",
                status = failure.status.as_u16(),
                "Account email delivery failed"
            );
        }
    }) {
        Ok(())
    } else {
        Err(error(503, "SERVICE_UNAVAILABLE", "Please retry shortly"))
    }
}

pub struct Message {
    pub subject: String,
    pub text: String,
    pub html: String,
}
fn params(pairs: &[(&str, &str)]) -> String {
    url::form_urlencoded::Serializer::new(String::new())
        .extend_pairs(pairs.iter().copied())
        .finish()
}
pub fn verification(state: &AppState, email: &str, otp: &str, token: &str) -> Message {
    let query = params(&[
        ("email", &email.trim().to_lowercase()),
        ("token", token.trim()),
    ]);
    let link = format!(
        "{}/verify-email?{query}",
        state.config.public_url.trim_end_matches('/')
    );
    Message {
        subject: "Verify your Astral Grove email".into(),
        text: format!(
            "Confirm your email to finish setting up The Astral Grove.\n\nVerification code: {otp}\n\nOr open this link: {link}\n"
        ),
        html: format!(
            "<p>Confirm your email to finish setting up The Astral Grove.</p><p>Your verification code is <strong style=\"font-size:1.25em;letter-spacing:0.08em\">{otp}</strong></p><p><a href=\"{link}\">Verify email with this link</a></p>"
        ),
    }
}
pub fn change_email(current: &str, otp: &str) -> Message {
    Message {
        subject: "Verify your new Astral Grove email".into(),
        text: format!(
            "Verify this address to make it your new sign-in email for The Astral Grove.\nCurrent address on the account: {}\n\nVerification code: {otp}\n\nEnter the code in Settings → Credentials. The address is verified when the change completes.\nIf you did not ask for this, you can ignore the email.\n",
            current.trim().to_lowercase()
        ),
        html: format!(
            "<p>Verify this address to make it your new sign-in email for The Astral Grove.</p><p style=\"color:#666;font-size:0.9em\">Current address on the account: {current}</p><p>Your verification code is <strong style=\"font-size:1.25em;letter-spacing:0.08em\">{otp}</strong></p><p>Enter the code in <strong>Settings → Credentials</strong>. The address is verified when the change completes.</p><p style=\"color:#666;font-size:0.9em\">If you did not ask for this, you can ignore the email.</p>"
        ),
    }
}
pub fn reset(state: &AppState, email: &str, token: &str, callback: &str) -> Message {
    let query = params(&[
        ("token", token.trim()),
        ("email", &email.trim().to_lowercase()),
    ]);
    let link = format!(
        "{}/reset-password?{query}",
        state.config.public_url.trim_end_matches('/')
    );
    Message {
        subject: "Reset your Astral Grove password".into(),
        text: format!(
            "Choose a new password for The Astral Grove.\n\nOpen this link: {link}\n\nIf the links above do not work, use this fallback:\n{callback}\n\nIf you did not ask for this, you can ignore the email.\n"
        ),
        html: format!(
            "<p>Choose a new password for The Astral Grove.</p><p><a href=\"{link}\">Choose a new password</a></p><p style=\"color:#666;font-size:0.85em\"><a href=\"{callback}\">Fallback reset link</a></p><p style=\"color:#666;font-size:0.9em\">If you did not ask for this, you can ignore the email.</p>"
        ),
    }
}
fn failed() -> crate::error::AppError {
    error(500, "INTERNAL_SERVER_ERROR", "Internal Server Error")
}
async fn call(
    state: &AppState,
    url: &str,
    username: &str,
    password: &str,
    calls: Value,
) -> Result<Value> {
    let response=state.client.post(url).basic_auth(username,Some(password)).timeout(std::time::Duration::from_secs(15)).json(&json!({"using":["urn:ietf:params:jmap:core","urn:ietf:params:jmap:mail","urn:ietf:params:jmap:submission"],"methodCalls":calls})).send().await.map_err(|_|failed())?;
    if !response.status().is_success() {
        return Err(failed());
    }
    let result: Value = response.json().await.map_err(|_| failed())?;
    let responses = result["methodResponses"]
        .as_array()
        .filter(|r| !r.is_empty())
        .ok_or_else(failed)?;
    for response in responses {
        let name = response[0].as_str().ok_or_else(failed)?;
        if name == "error"
            || name.ends_with("/error")
            || ["notCreated", "notUpdated", "notDestroyed"]
                .iter()
                .any(|key| response[1][key].as_object().is_some_and(|v| !v.is_empty()))
        {
            return Err(failed());
        }
    }
    Ok(result)
}
fn method<'a>(envelope: &'a Value, name: &str) -> Result<&'a Value> {
    envelope["methodResponses"]
        .as_array()
        .and_then(|r| r.iter().find(|r| r[0] == name))
        .map(|r| &r[1])
        .ok_or_else(failed)
}
pub async fn send(state: &AppState, to: &str, message: Message) -> Result<()> {
    if !state.config.email_enabled() {
        return Err(failed());
    }
    let setting = |name: &str| {
        state
            .config
            .values
            .get(name)
            .map(String::as_str)
            .unwrap_or("")
    };
    let base = state
        .config
        .values
        .get("STALWART_JMAP_URL")
        .map(String::as_str)
        .unwrap_or("https://mail.solace.onl")
        .trim_end_matches('/');
    let mut session = None;
    for path in ["/jmap/session", "/.well-known/jmap"] {
        let response = state
            .client
            .get(format!("{base}{path}"))
            .basic_auth(
                setting("STALWART_JMAP_USERNAME"),
                Some(setting("STALWART_JMAP_PASSWORD")),
            )
            .header("accept", "application/json")
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
            .map_err(|_| failed())?;
        if response.status().as_u16() == 401 {
            return Err(failed());
        }
        if response.status().is_success() {
            session = Some(response.json::<Value>().await.map_err(|_| failed())?);
            break;
        }
    }
    let session = session.ok_or_else(failed)?;
    let account = session["primaryAccounts"]["urn:ietf:params:jmap:mail"]
        .as_str()
        .or_else(|| session["primaryAccounts"]["urn:stalwart:jmap"].as_str())
        .or_else(|| {
            session["accounts"]
                .as_object()?
                .keys()
                .next()
                .map(String::as_str)
        })
        .ok_or_else(failed)?;
    let submission = session["primaryAccounts"]["urn:ietf:params:jmap:submission"]
        .as_str()
        .unwrap_or(account);
    let mut api = session["apiUrl"]
        .as_str()
        .and_then(|v| url::Url::parse(v).ok())
        .unwrap_or(url::Url::parse(&format!("{base}/jmap/")).map_err(|_| failed())?);
    let origin = url::Url::parse(base).map_err(|_| failed())?;
    api.set_scheme(origin.scheme()).map_err(|_| failed())?;
    api.set_host(origin.host_str()).map_err(|_| failed())?;
    api.set_port(origin.port()).map_err(|_| failed())?;
    let username = setting("STALWART_JMAP_USERNAME");
    let password = setting("STALWART_JMAP_PASSWORD");
    let from = setting("EMAIL_FROM");
    let context=call(state,api.as_str(),username,password,json!([["Mailbox/get",{"accountId":account,"ids":null,"properties":["id","role","name"]},"m"],["Identity/get",{"accountId":account},"i"]])).await?;
    let mailboxes = method(&context, "Mailbox/get")?["list"]
        .as_array()
        .ok_or_else(failed)?;
    let mailbox = |role: &str| {
        mailboxes
            .iter()
            .find(|m| {
                m["role"]
                    .as_str()
                    .is_some_and(|v| v.eq_ignore_ascii_case(role))
            })
            .or_else(|| {
                mailboxes.iter().find(|m| {
                    m["name"]
                        .as_str()
                        .is_some_and(|v| v.eq_ignore_ascii_case(role))
                })
            })
            .and_then(|m| m["id"].as_str())
    };
    let drafts = mailbox("drafts").ok_or_else(failed)?;
    let sent = mailbox("sent");
    let identity = method(&context, "Identity/get")?["list"]
        .as_array()
        .and_then(|ids| {
            ids.iter().find(|i| {
                i["email"]
                    .as_str()
                    .is_some_and(|e| e.trim().eq_ignore_ascii_case(from.trim()))
            })
        })
        .and_then(|i| i["id"].as_str())
        .ok_or_else(failed)?;
    let mut submission_body = json!({"accountId":submission,"create":{"s1":{"emailId":"#draft1","identityId":identity,"envelope":{"mailFrom":{"email":from},"rcptTo":[{"email":to}]}}}});
    if let Some(sent) = sent {
        submission_body["onSuccessUpdateEmail"] = json!({"#s1":{format!("mailboxIds/{sent}"):true,format!("mailboxIds/{drafts}"):null,"keywords/$draft":null}})
    }
    let envelope=call(state,api.as_str(),username,password,json!([["Email/set",{"accountId":account,"create":{"draft1":{"mailboxIds":{drafts:true},"keywords":{"$seen":true,"$draft":true},"from":[{"email":from,"name":state.config.values.get("EMAIL_FROM_NAME").map(String::as_str).unwrap_or("The Astral Grove")}],"to":[{"email":to}],"subject":message.subject,"bodyValues":{"text":{"value":message.text},"html":{"value":message.html}},"textBody":[{"partId":"text","type":"text/plain"}],"htmlBody":[{"partId":"html","type":"text/html"}]}}},"c1"],["EmailSubmission/set",submission_body,"c2"]])).await?;
    if method(&envelope, "EmailSubmission/set")?["created"]["s1"]["id"]
        .as_str()
        .is_none()
    {
        return Err(failed());
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    #[test]
    fn link_values_are_encoded() {
        assert_eq!(
            super::params(&[("email", "a+b@example.com"), ("otp", "123456")]),
            "email=a%2Bb%40example.com&otp=123456"
        );
    }
}
