use std::{future::Future, sync::Mutex, time::Duration};
use tokio::task::JoinSet;

#[derive(Default)]
struct State {
    closed: bool,
    jobs: JoinSet<()>,
}

pub(crate) struct Tasks {
    state: Mutex<State>,
    limit: usize,
}

impl Tasks {
    pub(crate) fn new(limit: usize) -> Self {
        Self {
            state: Mutex::new(State::default()),
            limit,
        }
    }

    pub(crate) fn spawn(&self, job: impl Future<Output = ()> + Send + 'static) -> bool {
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        while let Some(result) = state.jobs.try_join_next() {
            if result.is_err() {
                tracing::warn!(category = "background-task", "Background task failed");
            }
        }
        if state.closed || state.jobs.len() >= self.limit {
            return false;
        }
        state.jobs.spawn(job);
        true
    }

    pub(crate) async fn drain(&self) {
        self.drain_with_timeout(Duration::from_secs(3)).await;
    }

    async fn drain_with_timeout(&self, timeout: Duration) {
        let mut jobs = {
            let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
            state.closed = true;
            std::mem::take(&mut state.jobs)
        };
        if tokio::time::timeout(timeout, async {
            while let Some(result) = jobs.join_next().await {
                if result.is_err() {
                    tracing::warn!(category = "background-task", "Background task failed");
                }
            }
        })
        .await
        .is_err()
        {
            tracing::warn!(category = "background-task", "Background drain timed out");
            jobs.abort_all();
            while jobs.join_next().await.is_some() {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };
    use tokio::sync::oneshot;

    #[tokio::test]
    async fn work_survives_a_disconnected_caller_and_drains() {
        let tasks = Tasks::new(1);
        let completed = Arc::new(AtomicBool::new(false));
        let (release, blocked) = oneshot::channel();
        let (response, caller) = oneshot::channel();
        let finished = completed.clone();
        assert!(tasks.spawn(async move {
            let _ = blocked.await;
            finished.store(true, Ordering::SeqCst);
            let _ = response.send(());
        }));
        drop(caller);
        assert!(!tasks.spawn(async {}));
        let _ = release.send(());
        tasks.drain().await;
        assert!(completed.load(Ordering::SeqCst));
        assert!(!tasks.spawn(async {}));
    }

    #[tokio::test]
    async fn capacity_is_reusable_after_a_job_finishes() {
        let tasks = Tasks::new(1);
        assert!(tasks.spawn(async {}));
        tokio::task::yield_now().await;
        assert!(tasks.spawn(async {}));
        tasks.drain().await;
    }

    #[tokio::test]
    async fn stalled_jobs_are_aborted_and_release_resources() {
        struct Guard(Arc<AtomicBool>);
        impl Drop for Guard {
            fn drop(&mut self) {
                self.0.store(true, Ordering::SeqCst);
            }
        }
        let tasks = Tasks::new(1);
        let released = Arc::new(AtomicBool::new(false));
        let guard = Guard(released.clone());
        let (ready, started) = oneshot::channel();
        assert!(tasks.spawn(async move {
            let _guard = guard;
            let _ = ready.send(());
            std::future::pending::<()>().await;
        }));
        assert!(started.await.is_ok());
        tasks.drain_with_timeout(Duration::from_millis(10)).await;
        assert!(released.load(Ordering::SeqCst));
        assert!(!tasks.spawn(async {}));
    }
}
