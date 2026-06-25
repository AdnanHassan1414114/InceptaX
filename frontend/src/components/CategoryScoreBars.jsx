/**
 * components/CategoryScoreBars.jsx
 *
 * Renders the per-provider AI evaluation scores (aiEvaluations[] —
 * already returned by the backend, see Submission.js's aiEvaluationSchema
 * and adminController.aiEvaluate) as horizontal comparison bars.
 *
 * WHY THIS IS NEW:
 *   Today, AdminSubmissions.jsx already displays aiEvaluations as a
 *   plain list of "provider name: score" text lines (see the existing
 *   review modal). That's functional but doesn't make it easy to
 *   visually compare 5 scores at a glance, and it's never shown to the
 *   USER at all — only admins see it. This component gives both admins
 *   and users a quick visual read of "which AI scored this highest/
 *   lowest," reusing the existing premium-badge / progress-bar visual
 *   language already present in this codebase's CSS (ix-card, skeleton
 *   shimmer pattern) rather than introducing a charting library.
 *
 * WHY NOT A CHARTING LIBRARY (e.g. recharts):
 *   5 static horizontal bars is a single <div> per bar with a width
 *   percentage — there is no interactivity, animation complexity, or
 *   axis/legend requirement that would justify pulling in a charting
 *   dependency. Plain divs keep this consistent with the rest of the
 *   project's "inline styles + CSS variables" approach and avoid adding
 *   a library for something CSS already does well.
 *
 * Props:
 *   evaluations - array of { provider, score, strengths, weaknesses,
 *     improvements, issues } — exactly Submission.aiEvaluations as
 *     returned by the API, no transformation needed by the caller.
 */

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  groq: 'Groq (Llama)',
};

function scoreColor(score) {
  if (score >= 75) return 'var(--emerald)';
  if (score >= 50) return 'var(--amber)';
  return 'var(--red)';
}

export default function CategoryScoreBars({ evaluations }) {
  if (!evaluations || evaluations.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
        No per-provider breakdown available for this submission.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {evaluations.map((ev) => (
        <div key={ev.provider}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text1)', fontWeight: 500 }}>
              {PROVIDER_LABELS[ev.provider] || ev.provider}
            </span>
            <span
              style={{
                fontSize: 13,
                fontFamily: 'monospace',
                fontWeight: 600,
                color: scoreColor(ev.score),
              }}
            >
              {ev.score}
            </span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 4,
              background: 'var(--bg3)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, ev.score))}%`,
                background: scoreColor(ev.score),
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}