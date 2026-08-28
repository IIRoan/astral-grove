import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';
import {
  blurHoldResultsSearchState,
  changeHoldResultsSearchState,
  clearHoldResultsSearchState,
  holdClearHoldResultsSearchState,
  createHoldResultsSearchState,
  focusHoldResultsSearchState,
  syncHoldResultsSearchState,
} from '@/utils/holdResultsSearchInput';

/** Debounce parent commits so catalog work cannot thrash the field mid-keystroke. */
export const HOLD_RESULTS_COMMIT_MS = 150;

/** Clears draft on focus without committing empty; results keep `committed` until type/clear. */
export function useHoldResultsSearchInput(
  committed: string,
  onCommit: (next: string) => void
) {
  const [state, setState] = useState(() => createHoldResultsSearchState(committed));
  const committedRef = useLatestRef(committed);
  const onCommitRef = useLatestRef(onCommit);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCommitRef = useRef<string | null>(null);

  const cancelPendingCommit = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    pendingCommitRef.current = null;
  }, []);

  const flushCommit = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    const pending = pendingCommitRef.current;
    pendingCommitRef.current = null;
    if (pending == null) return;
    startTransition(() => {
      onCommitRef.current(pending);
    });
  }, [onCommitRef]);

  const scheduleCommit = useCallback(
    (next: string) => {
      pendingCommitRef.current = next;
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => {
        commitTimerRef.current = null;
        flushCommit();
      }, HOLD_RESULTS_COMMIT_MS);
    },
    [flushCommit]
  );

  useEffect(() => {
    setState((prev) => syncHoldResultsSearchState(prev, committed));
  }, [committed]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      const pending = pendingCommitRef.current;
      pendingCommitRef.current = null;
      if (pending != null) onCommitRef.current(pending);
    };
  }, [onCommitRef]);

  const onFocus = useCallback(() => {
    setState((prev) => focusHoldResultsSearchState(prev, committedRef.current));
  }, [committedRef]);

  const onBlur = useCallback(() => {
    setState((prev) => blurHoldResultsSearchState(prev));
    flushCommit();
  }, [flushCommit]);

  const onChangeText = useCallback(
    (text: string) => {
      setState(changeHoldResultsSearchState(text));
      scheduleCommit(text);
    },
    [scheduleCommit]
  );

  const onClear = useCallback(() => {
    cancelPendingCommit();
    setState(clearHoldResultsSearchState());
    onCommitRef.current('');
  }, [cancelPendingCommit, onCommitRef]);

  /** Clear the visible draft without committing — results keep using `committed`. */
  const onHoldClear = useCallback(() => {
    cancelPendingCommit();
    setState(holdClearHoldResultsSearchState(committedRef.current));
  }, [cancelPendingCommit, committedRef]);

  return {
    draft: state.draft,
    onFocus,
    onBlur,
    onChangeText,
    onClear,
    onHoldClear,
    flush: flushCommit,
  };
}
