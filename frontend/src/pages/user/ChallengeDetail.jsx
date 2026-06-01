import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

/* ── Styles ─────────────────────────────────────────────────────── */
const css = `
  .cd-root {
    --bg: #ffffff;
    --fg: #000000;
    --border: #000000;
    --text1: #000000;
    --text2: #000000;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .dark .cd-root,
  [data-theme="dark"] .cd-root {
    --bg: #000000;
    --fg: #ffffff;
    --border: #ffffff;
    --text1: #ffffff;
    --text2: #ffffff;
  }

  .cd-root * { box-sizing: border-box; }

  /* Back link */
  .cd-back {
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--fg);
    text-decoration: none;
    opacity: 0.5;
    display: inline-block;
    margin-bottom: 24px;
    text-transform: uppercase;
  }
  .cd-back:hover { opacity: 1; }

  /* Card */
  .cd-card {
    background: var(--bg);
    border: 1.5px solid var(--border);
    padding: 24px;
    margin-bottom: 12px;
  }

  /* Badge */
  .cd-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 10px;
    font-family: inherit;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1.5px solid var(--border);
    color: var(--text1);
    background: var(--bg);
    border-radius: 0;
    white-space: nowrap;
  }

  /* Tag */
  .cd-tag {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text1);
    border: 1.5px solid var(--border);
    background: var(--bg);
    border-radius: 0;
    opacity: 0.6;
  }

  /* Buttons */
  .cd-btn-primary {
    display: inline-flex;
    align-items: center;
    height: 36px;
    padding: 0 18px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-decoration: none;
    background: var(--fg);
    color: var(--bg);
    border: 1.5px solid var(--border);
    cursor: pointer;
    white-space: nowrap;
  }
  .cd-btn-ghost {
    display: inline-flex;
    align-items: center;
    height: 36px;
    padding: 0 18px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-decoration: none;
    background: var(--bg);
    color: var(--fg);
    border: 1.5px solid var(--border);
    cursor: pointer;
    white-space: nowrap;
  }
  .cd-btn-ghost:hover { background: var(--fg); color: var(--bg); }

  /* Divider */
  .cd-divider {
    border: none;
    border-top: 1.5px solid var(--border);
    margin: 20px 0;
    opacity: 0.15;
  }

  /* Meta label */
  .cd-meta-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text1);
    opacity: 0.4;
    margin: 0 0 4px;
  }
  .cd-meta-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text1);
    margin: 0;
  }
  .cd-meta-sub {
    font-size: 11px;
    color: var(--text1);
    opacity: 0.45;
    margin: 2px 0 0;
  }

  /* Submission row */
  .cd-sub-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1.5px solid var(--border);
    text-decoration: none;
    margin-bottom: 8px;
    transition: background 0.12s;
    opacity: 0.9;
  }
  .cd-sub-row:last-child { margin-bottom: 0; }
  .cd-sub-row:hover { background: var(--fg); }
  .cd-sub-row:hover .cd-sub-rank,
  .cd-sub-row:hover .cd-sub-name,
  .cd-sub-row:hover .cd-sub-score { color: var(--bg); }

  .cd-sub-rank {
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    color: var(--text1);
    opacity: 0.35;
    width: 24px;
  }
  .cd-sub-name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--text1);
  }
  .cd-sub-score {
    font-size: 14px;
    font-weight: 700;
    color: var(--text1);
  }

  /* Skeleton */
  .cd-skeleton {
    border: 1.5px solid var(--border);
    background: var(--fg);
    animation: cd-pulse 1.4s ease-in-out infinite;
    margin-bottom: 12px;
  }
  @keyframes cd-pulse {
    0%, 100% { opacity: 0.06; }
    50% { opacity: 0.14; }
  }
`;

const DiffBadge = ({ d }) => <span className="cd-badge">{d}</span>;

export default function ChallengeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [topSubs, setTopSubs] = useState([]);
  const [mySubmission, setMySubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/assignments/${id}`),
      api.get(`/submissions/assignment/${id}`, { params: { limit: 5 } }),
    ])
      .then(([aRes, sRes]) => {
        setAssignment(aRes.data.data.assignment);
        const subs = sRes.data.data.data || [];
        setTopSubs(subs);
        if (user) setMySubmission(subs.find((s) => s.userId?._id === user._id || s.userId?.username === user.username) || null);
      })
      .catch((err) => setError(err.response?.data?.message || "Failed to load challenge"))
      .finally(() => setLoading(false));
  }, [id, user]);

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="cd-root" style={{ maxWidth: 800, margin: "0 auto", padding: "48px 20px" }}>
        <div className="cd-skeleton" style={{ height: 260 }} />
        <div className="cd-skeleton" style={{ height: 72 }} />
        <div className="cd-skeleton" style={{ height: 180 }} />
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{css}</style>
      <div className="cd-root" style={{ maxWidth: 800, margin: "0 auto", padding: "48px 20px" }}>
        <div className="cd-card" style={{ textAlign: "center", padding: 48 }}>
          <p style={{ color: "var(--text1)", marginBottom: 20, opacity: 0.6 }}>{error}</p>
          <Link to="/challenges" className="cd-btn-ghost">← Back to Challenges</Link>
        </div>
      </div>
    </>
  );

  if (!assignment) return null;

  const expired = isPast(new Date(assignment.deadline));
  const isPremiumActive = user?.plan !== "free" && user?.planExpiresAt && new Date() < new Date(user.planExpiresAt);
  const canSubmit = user && !mySubmission && !expired && (!assignment.isPremium || isPremiumActive);

  return (
    <>
      <style>{css}</style>
      <div className="cd-root" style={{ maxWidth: 800, margin: "0 auto", padding: "48px 20px" }}>

        {/* Back */}
        <Link to="/challenges" className="cd-back">← All Challenges</Link>

        {/* Main card */}
        <div className="cd-card">

          {/* Top row: badges + actions */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <DiffBadge d={assignment.difficulty} />
              {assignment.isPremium && <span className="cd-badge">✦ Premium</span>}
              {expired && <span className="cd-badge">Ended</span>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {canSubmit && <Link to={`/challenges/${id}/submit`} className="cd-btn-primary">Submit Project →</Link>}
              {mySubmission && <Link to={`/submissions/${mySubmission._id}`} className="cd-btn-ghost">View My Submission</Link>}
              {!user && !expired && <Link to="/login" className="cd-btn-primary">Sign in to Submit →</Link>}
            </div>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text1)", margin: "0 0 12px", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
            {assignment.title}
          </h1>

          {/* Description */}
          <p style={{ fontSize: 14, color: "var(--text1)", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 18, opacity: 0.65 }}>
            {assignment.description}
          </p>

          {/* Tags */}
          {(assignment.tags || []).length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {assignment.tags.map((t) => (
                <span key={t} className="cd-tag">{t}</span>
              ))}
            </div>
          )}

          <hr className="cd-divider" />

          {/* Meta: deadline + prize */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 20 }}>
            <div>
              <p className="cd-meta-label">Deadline</p>
              <p className="cd-meta-value">{format(new Date(assignment.deadline), "MMM d, yyyy")}</p>
              {!expired && (
                <p className="cd-meta-sub">{formatDistanceToNow(new Date(assignment.deadline), { addSuffix: true })}</p>
              )}
            </div>
            {assignment.prize && (
              <div>
                <p className="cd-meta-label">Prize</p>
                <p className="cd-meta-value">{assignment.prize}</p>
              </div>
            )}
          </div>
        </div>

        {/* Teams card */}
        <div className="cd-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text1)", margin: "0 0 4px" }}>
              Looking for teammates?
            </p>
            <p style={{ fontSize: 12, color: "var(--text1)", margin: 0, opacity: 0.5 }}>
              Browse teams for this challenge or create your own.
            </p>
          </div>
          <Link to={`/challenges/${id}/teams`} className="cd-btn-ghost">Browse Teams →</Link>
        </div>

        {/* Top Submissions */}
        <div className="cd-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text1)", margin: 0, letterSpacing: "-0.01em" }}>
              Top Submissions
            </h2>
            <Link
              to={`/leaderboard/challenge/${id}`}
              style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text1)", textDecoration: "none", opacity: 0.45 }}
            >
              Full Leaderboard →
            </Link>
          </div>

          {topSubs.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text1)", opacity: 0.45, margin: 0 }}>
              No submissions yet — be the first!
            </p>
          ) : (
            <div>
              {topSubs.map((sub, i) => (
                <Link key={sub._id} to={`/submissions/${sub._id}`} className="cd-sub-row">
                  <span className="cd-sub-rank">#{i + 1}</span>
                  <img
                    src={sub.userId?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${sub.userId?.name}&backgroundColor=111111&textColor=ffffff`}
                    style={{ width: 28, height: 28, borderRadius: 0, border: "1.5px solid var(--border)" }}
                    alt=""
                  />
                  <span className="cd-sub-name">{sub.userId?.name}</span>
                  {sub.finalScore !== null && <span className="cd-sub-score">{sub.finalScore}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}