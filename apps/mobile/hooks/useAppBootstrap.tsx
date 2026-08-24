import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import {
  bootstrapAppColdStart,
  bootstrapSignedInUser,
  type BootstrapPhase,
} from '@/services/appBootstrapService';

export type BootstrapPhaseStatus = 'pending' | 'running' | 'done' | 'error';

export type AppBootstrapState = {
  phases: Record<BootstrapPhase, BootstrapPhaseStatus>;
  isRestoring: boolean;
  isLocalReady: boolean;
  isCatalogReady: boolean;
  isUserReady: boolean;
  isDeferredReady: boolean;
  signedInUserId: string | null;
};

const initialPhaseState = (): Record<BootstrapPhase, BootstrapPhaseStatus> => ({
  local: 'pending',
  catalog: 'pending',
  user: 'pending',
  deferred: 'pending',
});

const AppBootstrapContext = createContext<AppBootstrapState | null>(null);

function useAppBootstrapController(signedInUserId: string | null): AppBootstrapState {
  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();
  const [phases, setPhases] = useState(initialPhaseState);
  const coldStartStarted = useRef(false);
  const bootstrappedUserId = useRef<string | null>(null);

  const markPhase = useCallback(
    (phase: BootstrapPhase, status: BootstrapPhaseStatus) => {
      setPhases((prev) => ({ ...prev, [phase]: status }));
    },
    []
  );

  useEffect(() => {
    if (isRestoring || coldStartStarted.current) return;
    coldStartStarted.current = true;

    void (async () => {
      markPhase('local', 'running');
      try {
        await bootstrapAppColdStart(queryClient, {
          onPhaseComplete: (phase) => markPhase(phase, 'done'),
        });
      } catch {
        markPhase('local', 'error');
        markPhase('catalog', 'error');
      }
    })();
  }, [isRestoring, queryClient, markPhase]);

  useEffect(() => {
    if (isRestoring) return;

    if (!signedInUserId) {
      bootstrappedUserId.current = null;
      setPhases((prev) =>
        prev.user === 'pending' ? prev : { ...prev, user: 'pending' }
      );
      return;
    }

    if (bootstrappedUserId.current === signedInUserId) return;
    bootstrappedUserId.current = signedInUserId;

    void (async () => {
      markPhase('user', 'running');
      try {
        await bootstrapSignedInUser(queryClient, {
          userId: signedInUserId,
          onPhaseComplete: (phase) => markPhase(phase, 'done'),
        });
      } catch {
        markPhase('user', 'error');
      }
    })();
  }, [isRestoring, signedInUserId, queryClient, markPhase]);

  return useMemo(
    () => ({
      phases,
      isRestoring,
      isLocalReady:
        !isRestoring && (phases.local === 'done' || phases.local === 'error'),
      isCatalogReady: phases.catalog === 'done',
      isUserReady: !signedInUserId || phases.user === 'done' || phases.user === 'error',
      isDeferredReady: phases.deferred === 'done',
      signedInUserId,
    }),
    [phases, signedInUserId, isRestoring]
  );
}

export function AppBootstrapProvider({
  signedInUserId,
  children,
}: {
  signedInUserId: string | null;
  children: ReactNode;
}) {
  const state = useAppBootstrapController(signedInUserId);
  return (
    <AppBootstrapContext.Provider value={state}>
      {children}
    </AppBootstrapContext.Provider>
  );
}

/** Global bootstrap progress — catalog, user lists, and deferred warm-up. */
export function useAppBootstrap(): AppBootstrapState {
  const state = useContext(AppBootstrapContext);
  if (!state) {
    throw new Error('useAppBootstrap must be used within AppBootstrapProvider');
  }
  return state;
}
