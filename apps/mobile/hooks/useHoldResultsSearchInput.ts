import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';
import {
  blurHoldResultsSearchState,
  changeHoldResultsSearchState,
  clearHoldResultsSearchState,
  holdClearHoldResultsSearchState,
  createHoldResultsSearchState,
  focusHoldResultsSearchState,
  holdResultsActiveQuery,
  syncHoldResultsSearchState,
} from '@/utils/holdResultsSearchInput';

/** Debounce parent commits so catalog work cannot thrash the field mid-keystroke. */
export const HOLD_RESULTS_COMMIT_MS = 150;

/** Clears draft on focus without committing empty; results keep `committed` until type/clear. */
export function useHoldResultsSearchInput(
  committed: string,
  onCommit: (next: string) => void,
  onActiveQueryChange?: (query: string) => void
) {
  const [state, setState] = useState(() => createHoldResultsSearchState(committed));
  const committedRef = useLatestRef(committed);
  const onCommitRef = useLatestRef(onCommit);
  const onActiveQueryChangeRef = useLatestRef(onActiveQueryChange);
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
    onCommitRef.current(pending);
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

  // FlashList 2 throws during React concurrent renders; keep catalog data updates synchronous.
  const notifyActiveQuery = useCallback(
    (next: { draft: string; holdingFrom: string | null }) => {
      const onChange = onActiveQueryChangeRef.current;
      if (!onChange) return;
      const query = holdResultsActiveQuery(
        next.draft,
        committedRef.current,
        next.holdingFrom
      );
      onChange(query);
    },
    [committedRef, onActiveQueryChangeRef]
  );

  useEffect(() => {
    setState((prev) => syncHoldResultsSearchState(prev, committed));
  }, [committed]);

  useEffect(() => {
    notifyActiveQuery({ draft: state.draft, holdingFrom: state.holdingFrom });
  }, [committed, state.draft, state.holdingFrom, notifyActiveQuery]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      const pending = pendingCommitRef.current;
      pendingCommitRef.current = null;
      if (pending != null) onCommitRef.current(pending);
    };
  }, [onCommitRef]);

  const onFocus = useCallback(() => {
    let next = createHoldResultsSearchState(committedRef.current);
    setState((prev) => {
      next = focusHoldResultsSearchState(prev, committedRef.current);
      return next;
    });
    notifyActiveQuery(next);
  }, [committedRef, notifyActiveQuery]);

  const onBlur = useCallback(() => {
    let next = createHoldResultsSearchState(committedRef.current);
    setState((prev) => {
      next = blurHoldResultsSearchState(prev);
      return next;
    });
    notifyActiveQuery(next);
    flushCommit();
  }, [committedRef, flushCommit, notifyActiveQuery]);

  const onChangeText = useCallback(
    (text: string) => {
      const next = changeHoldResultsSearchState(text);
      setState(next);
      notifyActiveQuery(next);
      scheduleCommit(text);
    },
    [notifyActiveQuery, scheduleCommit]
  );

  const onClear = useCallback(() => {
    cancelPendingCommit();
    const next = clearHoldResultsSearchState();
    setState(next);
    notifyActiveQuery(next);
    onCommitRef.current('');
  }, [cancelPendingCommit, notifyActiveQuery, onCommitRef]);

  /** Clear the visible draft without committing — results keep using `committed`. */
  const onHoldClear = useCallback(() => {
    cancelPendingCommit();
    const next = holdClearHoldResultsSearchState(committedRef.current);
    setState(next);
    notifyActiveQuery(next);
  }, [cancelPendingCommit, committedRef, notifyActiveQuery]);

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
