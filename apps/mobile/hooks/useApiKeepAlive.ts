import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  API_KEEP_ALIVE_INTERVAL_MS,
  pingApiKeepAlive,
} from '@/lib/api-keep-alive';

/** Ping the API on an interval while signed in and foregrounded so Railway serverless stays warm. */
export function useApiKeepAlive(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let abortController: AbortController | null = null;

    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      abortController?.abort();
      abortController = null;
    };

    const tick = () => {
      abortController?.abort();
      abortController = new AbortController();
      void pingApiKeepAlive(undefined, abortController.signal);
    };

    const start = () => {
      stop();
      tick();
      intervalId = setInterval(tick, API_KEEP_ALIVE_INTERVAL_MS);
    };

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        start();
      } else {
        stop();
      }
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    if (AppState.currentState === 'active') {
      start();
    }

    return () => {
      subscription.remove();
      stop();
    };
  }, [enabled]);
}
