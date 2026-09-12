import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  flushCollectionLiveInvalidate,
  onCollectionLiveChanged,
} from '@/hooks/collectionLiveSync';
import { useCollectionShareStatus } from '@/hooks/useCollectionShare';
import { isLiveStreamDisconnect } from '@/lib/live-stream-disconnect';
import { logActionFailure, wasActionFailureLogged } from '@/lib/logger';
import { subscribeCollectionLiveEvents } from '@/services/collectionLiveService';
import { authClient } from '@/src/lib/auth-client';

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/** Hermes has no DOMException — use Error with AbortError name. */
function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? abortError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Shared-collection SSE: invalidate on remote changes; defer while local mutations are in flight. */
export function useCollectionLiveSync(enabled = true) {
  const queryClient = useQueryClient();
  const sessionQuery = authClient.useSession();
  const userId = sessionQuery.data?.user?.id;
  const signedIn = Boolean(userId);
  const shareStatus = useCollectionShareStatus(enabled && signedIn);
  const isShared = shareStatus.data?.shared === true;

  useEffect(() => {
    if (!enabled || !signedIn || !isShared) return;

    const controller = new AbortController();
    let attempt = 0;
    let stopped = false;
    let pendingInvalidate = false;

    const unsubMutations = queryClient.getMutationCache().subscribe(() => {
      pendingInvalidate = flushCollectionLiveInvalidate(queryClient, pendingInvalidate);
    });

    const run = async () => {
      while (!stopped && !controller.signal.aborted) {
        try {
          await subscribeCollectionLiveEvents({
            signal: controller.signal,
            onEvent: (event) => {
              if (event.type === 'heartbeat') return;
              if (
                event.type === 'collection.changed' &&
                event.actorUserId === userId
              ) {
                return;
              }
              // Apply remote changes (incl. other sessions / invite-ready); defer only while local mutations are in flight.
              if (onCollectionLiveChanged(queryClient)) {
                pendingInvalidate = true;
              } else {
                pendingInvalidate = false;
              }
            },
          });
          attempt = 0;
        } catch (error) {
          if (stopped || controller.signal.aborted) break;
          if (!isLiveStreamDisconnect(error) && !wasActionFailureLogged(error)) {
            logActionFailure('collection.live.subscribe', error, {
              attempt,
              platform: Platform.OS,
            });
          }
          const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
          attempt += 1;
          try {
            await sleep(delay, controller.signal);
          } catch {
            break;
          }
        }
      }
    };

    void run();

    return () => {
      stopped = true;
      controller.abort();
      unsubMutations();
    };
  }, [enabled, signedIn, isShared, queryClient]);
}
