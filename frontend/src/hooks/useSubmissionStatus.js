/**
 * hooks/useSubmissionStatus.js
 *
 * Polls GET /api/submissions/:id/status on an interval, and stops
 * automatically once the submission reaches a terminal state (no
 * further backend action will change it without the user/admin doing
 * something — e.g. 'ready'+'ai_evaluated', or 'failed').
 *
 * WHY A CUSTOM HOOK rather than inlining setInterval in each page:
 *   SubmissionDetail, Dashboard, and AdminSubmissions all need the same
 *   polling behavior. Without this hook, each page would reimplement
 *   its own setInterval + cleanup + race-condition handling, and subtle
 *   bugs (like the ones described below) would likely diverge between
 *   the copies. This mirrors how ChatContext/NotificationContext
 *   already centralize logic that's needed in multiple places — except
 *   this is a plain hook, not a Context, because the data here is local
 *   to whichever single submission a given page is showing, not global
 *   app state that many unrelated components need simultaneously.
 *
 * RACE CONDITIONS THIS HOOK SPECIFICALLY HANDLES:
 *
 *   1. "Stale state on mount" — if a user opens SubmissionDetail when
 *      indexing already finished 10 seconds ago, waiting for the first
 *      interval tick (e.g. 4s) would show a wrong/stale state for that
 *      long. Fix: fetch immediately on mount, THEN start the interval.
 *
 *   2. "Unmounted component still updating state" — if the user
 *      navigates away from the page while a fetch is in flight, the
 *      fetch's .then() would later call setState on an unmounted
 *      component (a real, common React bug — causes console warnings
 *      and can mask memory leaks). Fix: an `isMounted` flag checked
 *      before every setState call, set to false in the cleanup function.
 *
 *   3. "Two intervals running at once" — if `submissionId` changes
 *      (e.g. this hook is reused across a route param change) without
 *      proper cleanup, the OLD interval could keep firing alongside a
 *      NEW one. Fix: the useEffect cleanup function always clears the
 *      interval before any new one is created, and the effect re-runs
 *      whenever submissionId changes (it's in the dependency array).
 *
 *   4. "Polling forever after the tab is backgrounded" — not solved
 *      here deliberately, to keep this simple; see note at the bottom
 *      for why this was intentionally left out.
 *
 * @param {string} submissionId
 * @param {number} [intervalMs=4000]
 * @returns {{ data: {repoStatus, status, finalScore, rank}|null, loading: boolean, error: string|null, refetch: Function }}
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { getSubmissionDisplayState } from '../utils/submissionStatusMap';

export function useSubmissionStatus(submissionId, intervalMs = 4000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    if (!submissionId) return;
    try {
      const res = await api.get(`/submissions/${submissionId}/status`);
      if (!isMountedRef.current) return; // race condition #2 guard
      setData(res.data.data);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err.response?.data?.message || 'Failed to load status');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    isMountedRef.current = true;
    setLoading(true);

    // Race condition #1 guard: fetch immediately, don't wait for the
    // first interval tick.
    fetchStatus();

    let intervalId = null;

    // We can't know yet (before the first fetch resolves) whether this
    // submission is already in a terminal state, so we always start
    // the interval — the tick handler below checks terminality itself
    // and clears the interval the moment it observes a terminal state,
    // rather than polling forever once nothing will change.
    intervalId = setInterval(async () => {
      if (!isMountedRef.current) return;

      try {
        const res = await api.get(`/submissions/${submissionId}/status`);
        if (!isMountedRef.current) return;

        setData(res.data.data);
        setError(null);

        const state = getSubmissionDisplayState(res.data.data);
        if (state.isTerminal && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(err.response?.data?.message || 'Failed to load status');
        // Deliberately NOT stopping the interval on a fetch error —
        // a single failed poll (e.g. a momentary network blip) shouldn't
        // permanently stop status updates. It'll just try again on the
        // next tick.
      }
    }, intervalMs);

    // Race condition #3 guard: always clear this effect's own interval
    // and mark unmounted before React runs this effect again (e.g. if
    // submissionId changes) or before the component unmounts.
    return () => {
      isMountedRef.current = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [submissionId, intervalMs, fetchStatus]);

  return { data, loading, error, refetch: fetchStatus };
}

/**
 * NOTE ON BACKGROUND TABS (race condition #4, deliberately not solved):
 *   This hook keeps polling even if the browser tab is backgrounded or
 *   minimized. A more "production-grade" version would pause polling
 *   using the Page Visibility API (document.visibilitychange) and
 *   resume on focus. This was deliberately left out to keep the hook
 *   simple and easy to fully explain — at this project's scale (a
 *   developer checking their own submission status), a few extra
 *   background poll requests per user is not a meaningful cost. If
 *   this ever needs to scale to many concurrent users polling
 *   simultaneously, adding a visibilitychange listener here would be
 *   the natural next improvement — it would NOT require changing any
 *   of the three page components that consume this hook.
 */