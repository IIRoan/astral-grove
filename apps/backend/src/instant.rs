//! Millisecond parsing retained from the Rocal migration.

/// JavaScript keeps three fraction digits and drops the rest, so `.1234567890` is 123 ms and `.9999` before 1970 is -1 ms.
pub(crate) fn milliseconds_only(text: &str) -> std::borrow::Cow<'_, str> {
    let Some(dot) = text.find('.') else {
        return text.into();
    };
    let digits = text[dot + 1..]
        .bytes()
        .take_while(u8::is_ascii_digit)
        .count();
    if digits <= 3 {
        return text.into();
    }
    format!("{}{}", &text[..dot + 4], &text[dot + 1 + digits..]).into()
}

/// `new Date(text)` for the forms clients send: ISO 8601 (a date-time without offset is UTC, the servers' zone) and RFC 2822.
pub fn parse_js_date(text: &str) -> Option<i64> {
    let text = milliseconds_only(text.trim());
    let text = text.as_ref();
    if let Ok(timestamp) = text.parse::<jiff::Timestamp>() {
        return Some(timestamp.as_millisecond());
    }
    let utc = |datetime: jiff::civil::DateTime| {
        datetime
            .to_zoned(jiff::tz::TimeZone::UTC)
            .ok()
            .map(|zoned| zoned.timestamp().as_millisecond())
    };
    if let Ok(datetime) = text.parse::<jiff::civil::DateTime>() {
        return utc(datetime);
    }
    if let Ok(date) = text.parse::<jiff::civil::Date>() {
        return utc(date.to_datetime(jiff::civil::Time::midnight()));
    }
    jiff::fmt::rfc2822::parse(text)
        .ok()
        .map(|zoned| zoned.timestamp().as_millisecond())
}
