use crate::{
    db,
    error::{AppError, Result},
};
use serde_json::{Value, json};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tokio::sync::broadcast;
struct Channel {
    sender: broadcast::Sender<Value>,
    active: usize,
}
#[derive(Default)]
pub struct Hub {
    channels: Mutex<HashMap<String, Channel>>,
}
pub struct Subscription {
    collection: String,
    hub: Arc<Hub>,
    receiver: broadcast::Receiver<Value>,
}
impl Drop for Subscription {
    fn drop(&mut self) {
        if let Ok(mut channels) = self.hub.channels.lock()
            && let Some(channel) = channels.get_mut(&self.collection)
        {
            channel.active = channel.active.saturating_sub(1);
            if channel.active == 0 {
                channels.remove(&self.collection);
            }
        }
    }
}
impl Hub {
    pub fn subscribe(self: &Arc<Self>, collection: &str) -> Result<Subscription> {
        let mut channels = self.channels.lock().map_err(|_| AppError::internal())?;
        let channel = channels
            .entry(collection.into())
            .or_insert_with(|| Channel {
                sender: broadcast::channel(1024).0,
                active: 0,
            });
        if channel.active >= 8 {
            return Err(AppError::new(
                429,
                "RATE_LIMITED",
                "Too many live listeners",
            ));
        }
        channel.active += 1;
        Ok(Subscription {
            collection: collection.into(),
            hub: self.clone(),
            receiver: channel.sender.subscribe(),
        })
    }
    pub fn publish(&self, collection: &str, reason: &str, actor: &str) {
        if let Ok(channels) = self.channels.lock()
            && let Some(channel) = channels.get(collection)
        {
            let _=channel.sender.send(json!({"type":"collection.changed","collectionId":collection,"reason":reason,"actorUserId":actor,"at":db::iso(time::OffsetDateTime::now_utc())}));
        }
    }
}
fn stream(
    mut subscription: Subscription,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) -> impl futures_util::Stream<
    Item = std::result::Result<axum::response::sse::Event, std::convert::Infallible>,
> + Send
+ 'static {
    async_stream::stream! {
        use axum::response::sse::Event;
        if *shutdown.borrow(){return}
        yield Ok(Event::default().event("ready").data(json!({"type":"ready","collectionId":subscription.collection}).to_string()));
        let mut interval=tokio::time::interval(std::time::Duration::from_secs(25));interval.tick().await;
        loop{tokio::select!{
            result=subscription.receiver.recv()=>{match result{Ok(value)=>yield Ok(Event::default().event("collection.changed").data(value.to_string())),Err(_)=>break}},
            _=interval.tick()=>yield Ok(Event::default().event("heartbeat").data(json!({"type":"heartbeat","at":db::iso(time::OffsetDateTime::now_utc())}).to_string())),
            _=shutdown.changed()=>break,
        }}
    }
}

pub fn authenticated_stream(
    subscription: Subscription,
    shutdown: tokio::sync::watch::Receiver<bool>,
    state: Arc<crate::AppState>,
    user_id: String,
    session_id: String,
) -> impl futures_util::Stream<
    Item = std::result::Result<axum::response::sse::Event, std::convert::Infallible>,
> + Send
+ 'static {
    async_stream::stream! {
        use futures_util::StreamExt;
        let collection = subscription.collection.clone();
        let events = stream(subscription,shutdown);
        futures_util::pin_mut!(events);
        while let Some(event) = events.next().await {
            let authorized = db::rows(&state.db,"SELECT EXISTS(SELECT 1 FROM collection_members m JOIN session s ON s.user_id=m.user_id WHERE m.collection_id=$1::uuid AND m.user_id=$2 AND s.id=$3 AND s.expires_at>now()) AS allowed",vec![collection.clone().into(),user_id.clone().into(),session_id.clone().into()]).await;
            if !authorized.is_ok_and(|rows|rows.first().is_some_and(|row|row["allowed"]==true)){break}
            yield event;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::StreamExt;
    #[tokio::test]
    async fn shutdown_before_subscription_closes_without_waiting() {
        let hub = Arc::new(Hub::default());
        let subscription = hub.subscribe("fixture").unwrap_or_else(|_| unreachable!());
        let (sender, _receiver) = tokio::sync::watch::channel(false);
        let _ = sender.send(true);
        let mut events = Box::pin(stream(subscription, sender.subscribe()));
        let first = tokio::time::timeout(std::time::Duration::from_secs(1), events.next()).await;
        assert!(matches!(first, Ok(None)));
        assert!(
            hub.channels
                .lock()
                .is_ok_and(|channels| channels.is_empty())
        );
    }
    #[test]
    fn subscriber_limits_and_disconnect_cleanup_are_per_collection() {
        let hub = Arc::new(Hub::default());
        let mut subscriptions = (0..8)
            .map(|_| hub.subscribe("one"))
            .collect::<Result<Vec<_>>>()
            .unwrap_or_else(|_| unreachable!());
        assert!(hub.subscribe("one").is_err());
        assert!(hub.subscribe("two").is_ok());
        subscriptions.pop();
        assert!(hub.subscribe("one").is_ok());
        drop(subscriptions);
        assert!(
            hub.channels
                .lock()
                .is_ok_and(|channels| channels.is_empty())
        );
    }
}
