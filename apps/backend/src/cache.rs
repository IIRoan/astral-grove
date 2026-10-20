use std::{
    collections::{HashMap, VecDeque},
    time::{Duration, Instant},
};
struct Entry<T> {
    value: T,
    expires: Instant,
    bytes: usize,
}
pub struct TtlCache<T> {
    entries: HashMap<String, Entry<T>>,
    order: VecDeque<String>,
    ttl: Duration,
    max_entries: usize,
    max_bytes: Option<usize>,
    bytes: usize,
}
impl<T> TtlCache<T> {
    pub fn new(ttl: Duration, max_entries: usize, max_bytes: Option<usize>) -> Self {
        Self {
            entries: HashMap::new(),
            order: VecDeque::new(),
            ttl,
            max_entries: max_entries.max(1),
            max_bytes,
            bytes: 0,
        }
    }
    pub fn get(&mut self, key: &str) -> Option<&T> {
        if self
            .entries
            .get(key)
            .is_some_and(|entry| Instant::now() > entry.expires)
        {
            self.remove(key);
        }
        self.entries.get(key).map(|entry| &entry.value)
    }
    pub fn contains(&mut self, key: &str) -> bool {
        self.get(key).is_some()
    }
    pub fn insert(&mut self, key: String, value: T, bytes: usize) {
        self.remove(&key);
        if self.max_bytes.is_some_and(|max| bytes > max) {
            return;
        }
        while self.entries.len() >= self.max_entries
            || self
                .max_bytes
                .is_some_and(|max| self.bytes.saturating_add(bytes) > max)
        {
            let Some(key) = self.order.front().cloned() else {
                break;
            };
            self.remove(&key);
        }
        self.bytes += bytes;
        self.order.push_back(key.clone());
        self.entries.insert(
            key,
            Entry {
                value,
                expires: Instant::now() + self.ttl,
                bytes,
            },
        );
    }
    pub fn remove(&mut self, key: &str) -> Option<T> {
        let entry = self.entries.remove(key)?;
        self.bytes -= entry.bytes;
        self.order.retain(|other| other != key);
        Some(entry.value)
    }
    pub fn clear(&mut self) {
        self.entries.clear();
        self.order.clear();
        self.bytes = 0;
    }
    pub fn len(&self) -> usize {
        self.entries.len()
    }
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
    pub fn byte_len(&self) -> usize {
        self.bytes
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn returns_values_before_expiry() {
        let mut cache = TtlCache::new(Duration::from_secs(60), 2, None);
        cache.insert("a".into(), 42, 0);
        assert_eq!(cache.get("a"), Some(&42));
        assert!(cache.contains("a"));
        assert!(!cache.contains("absent"));
    }
    #[test]
    fn expired_reads_remove_the_entry_and_release_its_bytes() {
        let mut cache = TtlCache::new(Duration::ZERO, 2, Some(10));
        cache.insert("a".into(), 42, 5);
        assert_eq!(cache.get("a"), None);
        assert_eq!(cache.len(), 0);
        assert_eq!(cache.byte_len(), 0);
    }
    #[test]
    fn fifo_eviction_retains_newer_entries() {
        let mut cache = TtlCache::new(Duration::from_secs(60), 2, None);
        for key in ["a", "b", "c"] {
            cache.insert(key.into(), key, 0);
        }
        assert!(!cache.contains("a"));
        assert_eq!(cache.get("b"), Some(&"b"));
        assert_eq!(cache.get("c"), Some(&"c"));
    }
    #[test]
    fn replacing_an_entry_moves_it_to_the_end() {
        let mut cache = TtlCache::new(Duration::from_secs(60), 2, None);
        for (key, value) in [("a", 1), ("b", 2), ("a", 3), ("c", 4)] {
            cache.insert(key.into(), value, 0);
        }
        assert_eq!(cache.get("a"), Some(&3));
        assert!(!cache.contains("b"));
    }
    #[test]
    fn byte_budget_evicts_oldest_and_rejects_oversized_values() {
        let mut cache = TtlCache::new(Duration::from_secs(60), 10, Some(8));
        cache.insert("a".into(), 1, 5);
        cache.insert("b".into(), 2, 5);
        assert!(!cache.contains("a"));
        assert_eq!(cache.byte_len(), 5);
        cache.insert("huge".into(), 3, 9);
        assert!(!cache.contains("huge"));
        assert_eq!(cache.get("b"), Some(&2));
    }
    #[test]
    fn clear_and_remove_release_all_state() {
        let mut cache = TtlCache::new(Duration::from_secs(60), 2, None);
        cache.insert("a".into(), 42, 5);
        assert_eq!(cache.remove("a"), Some(42));
        cache.insert("b".into(), 43, 6);
        cache.clear();
        assert!(cache.is_empty());
        assert_eq!(cache.byte_len(), 0);
    }
}
