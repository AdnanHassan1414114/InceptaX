/**
 * components/RepoStatusBadge.jsx
 *
 * Renders a submission's current state (one of the 7: Submitted,
 * Indexing, Indexed, Evaluation Pending, Evaluating, Evaluated, Failed)
 * as a small colored pill.
 *
 * WHY THIS IS A SEPARATE COMPONENT rather than inline JSX in each page:
 *   It's used in at least 3 places (Dashboard, SubmissionDetail,
 *   AdminSubmissions) — same reasoning as why badge-easy/medium/hard
 *   exist as shared CSS classes in index.css rather than being
 *   recreated inline each time they're needed.
 *
 * STYLING: deliberately matches the EXISTING badge visual language
 * already used throughout this codebase (see badge-easy/medium/hard in
 * index.css, and the inline-styled status pills in AdminSubmissions.jsx
 * and Dashboard.jsx's db-pill classes) — small pill, ~10-11px font,
 * thin border, low-opacity tinted background, no new visual pattern
 * introduced.
 *
 * Props:
 *   submission - any object with { repoStatus, status } fields. Works
 *     with both a full Submission object AND the lightweight response
 *     from GET /api/submissions/:id/status.
 *   size - 'sm' (default, for list rows) | 'md' (for detail page header)
 */
import { getSubmissionDisplayState } from '../utils/submissionStatusMap';

// Inject the pulse keyframes ONCE, globally, the first time this module
// loads — not per-render. Re-rendering 15 badges in a submissions list
// would otherwise create 15 duplicate <style> tags if this were inline
// JSX inside the component body. This is a plain, dependency-free way
// to register a global animation once; no new library needed for it.
if (typeof document !== 'undefined' && !document.getElementById('repo-status-pulse-keyframes')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'repo-status-pulse-keyframes';
  styleEl.textContent = `
    @keyframes repoStatusPulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(styleEl);
}

export default function RepoStatusBadge({ submission, size = 'sm' }) {
  const state = getSubmissionDisplayState(submission);

  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: isSm ? 10 : 11,
        fontFamily: 'monospace',
        color: state.color,
        border: `0.5px solid ${state.border}`,
        background: state.bg,
        padding: isSm ? '2px 8px' : '3px 10px',
        borderRadius: 100,
        whiteSpace: 'nowrap',
      }}
    >
      {!state.isTerminal && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: state.color,
            animation: 'repoStatusPulse 1.4s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
      )}
      {state.label}
    </span>
  );
}