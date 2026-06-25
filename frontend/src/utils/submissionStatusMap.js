/**
 * utils/submissionStatusMap.js
 *
 * Single source of truth for turning a submission's two backend fields
 * (repoStatus, status) into ONE of the 7 user-facing states:
 *
 *   Submitted | Indexing | Indexed | Evaluation Pending |
 *   Evaluating | Evaluated | Failed
 *
 * WHY THIS EXISTS AS ITS OWN FILE:
 *   Without it, every place that shows a status badge (Dashboard,
 *   SubmissionDetail, AdminSubmissions) would each write their own
 *   if/else logic deciding "what do I call this combination of fields,"
 *   and they'd inevitably drift out of sync (e.g. one place calling it
 *   "Processing" and another "Indexing" for the exact same backend
 *   state). Centralizing it here means the label + color shown to a
 *   user is always identical no matter which page they're on — same
 *   reasoning as why STATUS_COLORS already exists as one constant in
 *   AdminSubmissions.jsx, just promoted to a shared file since this
 *   needs to be used in 3+ places instead of 1.
 *
 * WHY repoStatus AND status TOGETHER (not just one field):
 *   repoStatus tracks indexing (clone/chunk/embed). status tracks
 *   evaluation (AI scoring). They're independent pipelines that happen
 *   to share one Submission document. A submission can be
 *   repoStatus='ready' AND status='pending' at the same time — that
 *   combination IS "Evaluation Pending," a real, meaningful state that
 *   neither field alone represents.
 *
 * PRECEDENCE RULES (checked in this order):
 *   1. If repoStatus is 'failed' -> show Failed, regardless of `status`
 *      (an evaluation can't meaningfully happen without indexed content,
 *      so a repo failure is the more urgent thing to surface)
 *   2. If repoStatus is 'queued' or 'processing' -> show Submitted/Indexing
 *      (evaluation can't have started yet if indexing hasn't finished —
 *      adminController.aiEvaluate enforces this server-side too)
 *   3. Otherwise (repoStatus is 'ready'), fall through to whatever
 *      `status` says about evaluation progress
 */

// Color tokens reused from the existing theme system (index.css CSS
// variables) — not new colors, just referencing what's already there.
const COLORS = {
  neutral: { color: 'var(--text2)', border: 'var(--border)', bg: 'var(--bg2)' },
  blue:    { color: 'var(--blue)',   border: 'rgba(96,165,250,0.3)',  bg: 'rgba(96,165,250,0.06)' },
  amber:   { color: 'var(--amber)',  border: 'rgba(251,191,36,0.3)',  bg: 'rgba(251,191,36,0.06)' },
  emerald: { color: 'var(--emerald)',border: 'rgba(74,222,128,0.3)',  bg: 'rgba(74,222,128,0.06)' },
  red:     { color: 'var(--red)',    border: 'rgba(248,113,113,0.3)', bg: 'rgba(248,113,113,0.06)' },
  violet:  { color: 'var(--violet)', border: 'rgba(167,139,250,0.3)', bg: 'rgba(167,139,250,0.06)' },
};

/**
 * @param {{ repoStatus: string, status: string }} submission - only
 *   needs these two fields, so this works equally well with a full
 *   Submission object or the lightweight /status endpoint response.
 * @returns {{ key: string, label: string, ...COLORS[x], isTerminal: boolean, canRetryIndexing: boolean }}
 *   isTerminal: true once nothing will change without a user/admin
 *   action (used by useSubmissionStatus to know when to stop polling).
 */
function getSubmissionDisplayState({ repoStatus, status } = {}) {
  // 🔹 FIXED — defensive guard against a missing/undefined argument
  // entirely (e.g. before the first poll resolves). Without the `= {}`
  // default above, calling this with `undefined` would throw at the
  // destructuring step itself.

  // 🔹 FIXED — ROOT CAUSE of several downstream bugs (false "Indexed"
  // label on Dashboard/SubmissionDetail, permanently-disabled "Run AI"
  // button in AdminSubmissions for old data). Submissions created
  // BEFORE this RAG feature existed have NO repoStatus field at all —
  // not 'queued', not 'ready', genuinely absent, since this app's
  // owner deliberately chose not to backfill old data. Every earlier
  // check below tests for SPECIFIC string values ('failed', 'queued',
  // 'processing'), so `repoStatus === undefined` fails all of them and
  // fell through to the final `return` — which assumed "repoStatus is
  // 'ready'" by elimination. That assumption was wrong: "no value at
  // all" and "value is ready" are different facts and need different
  // labels. This check makes the distinction explicit, BEFORE any of
  // the value-specific checks run.
  if (repoStatus === undefined || repoStatus === null) {
    if (status === 'evaluating') {
      return {
        key: 'evaluating',
        label: 'Evaluating…',
        ...COLORS.violet,
        isTerminal: false,
        canRetryIndexing: false,
      };
    }
    if (status === 'ai_evaluated' || status === 'admin_reviewed' || status === 'published') {
      return {
        key: 'evaluated',
        label: 'Evaluated',
        ...COLORS.emerald,
        isTerminal: true,
        canRetryIndexing: false,
      };
    }
    if (status === 'rejected') {
      return {
        key: 'rejected',
        label: 'Rejected',
        ...COLORS.red,
        isTerminal: true,
        canRetryIndexing: false,
      };
    }
    // status is 'pending' and there is no repo indexing data at all —
    // this is a pre-RAG submission. Label it honestly as not-indexed
    // rather than falsely claiming "Indexed — Awaiting Evaluation."
    // isTerminal: true here is deliberate — unlike a real 'queued'/
    // 'processing' submission, NOTHING will ever change this state on
    // its own (no background job will pick it up), so polling for it
    // would be wasted work. canRetryIndexing is also deliberately
    // false: retryIndexing's backend route only accepts
    // repoStatus === 'failed', and there's no repoLink-aware action to
    // offer here without backfilling, which was explicitly out of scope.
    return {
      key: 'not_indexed',
      label: 'Not Indexed (Legacy Submission)',
      ...COLORS.neutral,
      isTerminal: true,
      canRetryIndexing: false,
    };
  }

  // 1. Indexing failure takes precedence over everything else.
  if (repoStatus === 'failed') {
    return {
      key: 'failed',
      label: 'Indexing Failed',
      ...COLORS.red,
      isTerminal: true,
      canRetryIndexing: true,
    };
  }

  // 2. Indexing still in flight — evaluation cannot have started.
  if (repoStatus === 'queued') {
    return {
      key: 'submitted',
      label: 'Submitted',
      ...COLORS.neutral,
      isTerminal: false,
      canRetryIndexing: false,
    };
  }
  if (repoStatus === 'processing') {
    return {
      key: 'indexing',
      label: 'Indexing…',
      ...COLORS.blue,
      isTerminal: false,
      canRetryIndexing: false,
    };
  }

  // 3. repoStatus is 'ready' from here on — fall through to evaluation state.
  if (status === 'evaluating') {
    return {
      key: 'evaluating',
      label: 'Evaluating…',
      ...COLORS.violet,
      isTerminal: false,
      canRetryIndexing: false,
    };
  }
  if (status === 'ai_evaluated' || status === 'admin_reviewed' || status === 'published') {
    return {
      key: 'evaluated',
      label: 'Evaluated',
      ...COLORS.emerald,
      isTerminal: true,
      canRetryIndexing: false,
    };
  }
  if (status === 'rejected') {
    return {
      key: 'rejected',
      label: 'Rejected',
      ...COLORS.red,
      isTerminal: true,
      canRetryIndexing: false,
    };
  }
  // status === 'pending' and repoStatus === 'ready'
  return {
    key: 'indexed',
    label: 'Indexed — Awaiting Evaluation',
    ...COLORS.amber,
    isTerminal: false, // not terminal: an admin action (running AI) is still expected
    canRetryIndexing: false,
  };
}

export { getSubmissionDisplayState };