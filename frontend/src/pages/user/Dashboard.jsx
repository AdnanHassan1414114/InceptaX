import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { GitBranch, BadgeCheck, Gauge, Zap, ArrowRight, Inbox, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
// 🔹 NEW — repo+evaluation lifecycle badge, replaces the old STATUS_MAP/
// db-pill rendering below, which only ever showed evaluation status and
// had no 'evaluating' entry (would have silently fallen back to
// STATUS_MAP.pending and shown "Pending" during active evaluation).
import RepoStatusBadge from "../../components/RepoStatusBadge";

/* ── Styles ──────────────────────────────────────────────────────── */
const css = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes db-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.85; } }

  .db-root {
    --bg: #07070a;
    --surface: #111114;
    --surface-2: #17171b;
    --line: rgba(255,255,255,0.08);
    --line-soft: rgba(255,255,255,0.06);
    --text1: #f3f3f4;
    --text2: rgba(243,243,244,0.55);
    --text3: rgba(243,243,244,0.36);
    --orange: #f5934a;
    --amber: #e8b34a;
    --purple: #9b7af0;
    --green: #4ade80;
    --red: #ff6b6b;
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg);
  }
  .db-root * { box-sizing: border-box; }

  .db-shell { max-width: 920px; margin: 0 auto; padding: 56px 24px 80px; }

  /* Card with signature bottom glow, like the feature cards on the home page */
  .db-card {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    overflow: hidden;
  }
  .db-card::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -40%;
    width: 70%;
    height: 60%;
    transform: translateX(-50%);
    background: radial-gradient(ellipse at center, rgba(255,255,255,0.06), transparent 70%);
    pointer-events: none;
  }

  /* Header */
  .db-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 8px; }
  .db-title { font-size: 30px; font-weight: 700; color: var(--text1); margin: 0 0 8px; letter-spacing: -0.02em; }
  .db-subtitle { font-size: 14px; color: var(--text2); margin: 0; }

  /* Buttons — same system as the home page hero */
  .db-btn-primary {
    display: inline-flex; align-items: center; gap: 6px;
    height: 40px; padding: 0 20px;
    font-size: 13px; font-weight: 600;
    text-decoration: none;
    background: #ffffff; color: #0a0a0a;
    border: 1px solid #ffffff;
    border-radius: 10px;
    cursor: pointer; white-space: nowrap;
    transition: opacity 0.12s, transform 0.12s;
  }
  .db-btn-primary:hover { opacity: 0.88; }
  .db-btn-primary:active { transform: scale(0.98); }

  .db-btn-ghost {
    display: inline-flex; align-items: center; gap: 6px;
    height: 40px; padding: 0 20px;
    font-size: 13px; font-weight: 600;
    text-decoration: none;
    background: rgba(255,255,255,0.03); color: var(--text1);
    border: 1px solid var(--line);
    border-radius: 10px;
    cursor: pointer; white-space: nowrap;
    transition: background 0.12s, border-color 0.12s;
  }
  .db-btn-ghost:hover { background: var(--surface-2); border-color: rgba(255,255,255,0.18); }

  /* Pill badge, matching "✓ Code quality" style */
  .db-pill {
    display: inline-flex; align-items: center; gap: 4px;
    height: 22px; padding: 0 10px;
    font-size: 11px; font-weight: 500;
    border-radius: 999px;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--line);
    color: var(--text2);
    white-space: nowrap;
  }
  .db-pill.is-published { color: var(--green); background: rgba(74,222,128,0.08); border-color: rgba(74,222,128,0.22); }
  .db-pill.is-rejected  { color: var(--red); background: rgba(255,107,107,0.08); border-color: rgba(255,107,107,0.22); }
  .db-pill.is-review    { color: var(--amber); background: rgba(232,179,74,0.08); border-color: rgba(232,179,74,0.22); }

  /* Icon chip, matching the colored rounded-square icon on feature cards */
  .db-chip {
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 10px;
    flex-shrink: 0;
  }

  /* Plan banner */
  .db-banner {
    padding: 20px 24px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap;
    margin-bottom: 28px;
  }
  .db-banner-title { font-size: 14px; font-weight: 700; color: var(--text1); margin: 0 0 4px; }
  .db-banner-copy { font-size: 12px; color: var(--text2); margin: 0; }

  /* Stat cards */
  .db-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 36px; }
  .db-stat { padding: 20px; }
  .db-stat-value { font-size: 28px; font-weight: 700; color: var(--text1); letter-spacing: -0.03em; margin: 14px 0 4px; line-height: 1; }
  .db-stat-label { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text3); }

  /* Section head */
  .db-sechead { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px; }
  .db-sechead-title { font-size: 17px; font-weight: 700; color: var(--text1); margin: 0; letter-spacing: -0.01em; }
  .db-sechead-count { font-size: 12px; font-weight: 500; color: var(--text3); }

  /* Submission rows inside the card */
  .db-row {
    position: relative; z-index: 1;
    display: flex; align-items: center; gap: 16px;
    padding: 16px 22px;
    text-decoration: none;
    border-top: 1px solid var(--line-soft);
    transition: background 0.12s;
  }
  .db-row:first-child { border-top: none; }
  .db-row:hover { background: var(--surface-2); }

  .db-row-title { font-size: 14px; font-weight: 600; color: var(--text1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .db-row-time { font-size: 12px; color: var(--text3); margin: 4px 0 0; }
  .db-row-score { font-size: 20px; font-weight: 700; color: var(--text1); letter-spacing: -0.02em; text-align: right; line-height: 1; }
  .db-row-rank { font-size: 11px; font-weight: 500; color: var(--text3); text-align: right; margin-top: 3px; }

  .db-skeleton { height: 76px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); animation: db-pulse 1.4s ease-in-out infinite; margin-bottom: 8px; }

  .db-empty { position: relative; z-index: 1; padding: 64px 24px; text-align: center; }
  .db-empty-icon { width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--line); color: var(--text3); }
  .db-empty-title { font-size: 15px; font-weight: 700; color: var(--text1); margin: 0 0 6px; }
  .db-empty-copy { font-size: 13px; color: var(--text2); margin: 0 0 22px; }

  .db-spinner { width: 16px; height: 16px; color: var(--text3); animation: spin 0.8s linear infinite; flex-shrink: 0; }

  @media (max-width: 640px) {
    .db-stats { grid-template-columns: repeat(2, 1fr); }
  }
`;

// 🔹 NOTE: STATUS_MAP / db-pill classes (.is-published, .is-rejected,
// .is-review) are kept in the CSS above and this constant is left
// defined below for backward compatibility, but the submission row
// rendering further down no longer uses either — it now renders
// RepoStatusBadge instead, which independently covers all 7 lifecycle
// states (Submitted, Indexing, Indexed, Evaluation Pending, Evaluating,
// Evaluated, Failed) rather than only the 5 evaluation-only states this
// map covered. Left in place rather than deleted in case anything else
// in this file referenced it — confirmed nothing else does, but
// removing working code that isn't actively broken adds risk without
// benefit.
const STATUS_MAP = {
  pending:        { label: "Pending",   cls: ""            },
  ai_evaluated:   { label: "AI Done",   cls: ""            },
  admin_reviewed: { label: "In Review", cls: "is-review"   },
  published:      { label: "Published", cls: "is-published"},
  rejected:       { label: "Rejected",  cls: "is-rejected" },
};

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const isPremiumActive =
    user?.plan !== "free" && user?.planExpiresAt && new Date() < new Date(user?.planExpiresAt);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.username) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setLoading(true);
    api.get(`/users/${user.username}/submissions`)
      .then((res) => setSubmissions(res.data.data.data || []))
      .catch((err) => { console.error("Dashboard error:", err.response?.data); setSubmissions([]); })
      .finally(() => setLoading(false));
  }, [user?.username, authLoading]);

  const published = submissions.filter((s) => s.status === "published");
  const bestScore = published.length ? Math.max(...published.map((s) => s.finalScore || 0)) : 0;

  const planLabel =
    user?.plan === "free"     ? "Free"   :
    user?.plan === "ten_day"  ? "Sprint" : "Pro";

  const stats = [
    // GitBranch — submissions are GitHub projects, not generic "layers"
    { label: "Total Submissions", value: submissions.length, Icon: GitBranch,  bg: "rgba(245,147,74,0.12)",  color: "var(--orange)" },
    // BadgeCheck — "verified/live" framing fits a published leaderboard entry better than a plain checkmark
    { label: "Published",         value: published.length,   Icon: BadgeCheck, bg: "rgba(74,222,128,0.12)",  color: "var(--green)" },
    // Gauge — score as a measurement you're improving, not a trophy you "win once"
    { label: "Best Score",        value: bestScore || "—",   Icon: Gauge,      bg: "rgba(232,179,74,0.12)",  color: "var(--amber)" },
    // Zap — matches the lightning-bolt icon already used for "AI Evaluation" on the home page
    { label: "Plan",              value: planLabel,          Icon: Zap,        bg: "rgba(155,122,240,0.12)", color: "var(--purple)" },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="db-root">
        <div className="db-shell">

          {/* Header */}
          <div className="db-header" style={{ marginBottom: 32 }}>
            <div>
              <h1 className="db-title">Dashboard</h1>
              <p className="db-subtitle">Track your submissions and progress</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Link to={`/u/${user?.username}`} className="db-btn-ghost">My Profile <ArrowRight size={14} /></Link>
              <Link to="/challenges" className="db-btn-primary">+ Submit</Link>
            </div>
          </div>

          {/* Plan banner */}
          {!isPremiumActive && (
            <div className="db-card db-banner">
              <div style={{ display: "flex", alignItems: "center", gap: 14, zIndex: 1, position: "relative" }}>
                <div className="db-chip" style={{ background: "rgba(155,122,240,0.15)" }}>
                  <Zap size={17} color="var(--purple)" />
                </div>
                <div>
                  <p className="db-banner-title">Unlock premium challenges</p>
                  <p className="db-banner-copy">Team collaboration, premium challenges, priority evaluation — from ₹99</p>
                </div>
              </div>
              <Link to="/pricing" className="db-btn-primary" style={{ flexShrink: 0, zIndex: 1, position: "relative" }}>
                Upgrade <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {/* Stats */}
          <div className="db-stats">
            {stats.map((s) => (
              <div key={s.label} className="db-card db-stat">
                <div className="db-chip" style={{ background: s.bg, position: "relative", zIndex: 1 }}>
                  <s.Icon size={17} color={s.color} />
                </div>
                <div className="db-stat-value" style={{ position: "relative", zIndex: 1 }}>{s.value}</div>
                <div className="db-stat-label" style={{ position: "relative", zIndex: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Section head */}
          <div className="db-sechead">
            <h2 className="db-sechead-title">My Submissions</h2>
            <span className="db-sechead-count">{submissions.length} total</span>
          </div>

          {/* Submissions */}
          {loading ? (
            <div>
              {Array(3).fill(0).map((_, i) => <div key={i} className="db-skeleton" />)}
            </div>
          ) : submissions.length === 0 ? (
            <div className="db-card db-empty">
              <div className="db-empty-icon"><Inbox size={22} /></div>
              <p className="db-empty-title">No submissions yet</p>
              <p className="db-empty-copy">Pick a challenge and submit your first project</p>
              <Link to="/challenges" className="db-btn-primary" style={{ display: "inline-flex", position: "relative", zIndex: 1 }}>
                Browse Challenges <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="db-card" style={{ overflow: "hidden" }}>
              {submissions.map((sub) => {
                return (
                  <Link key={sub._id} to={`/submissions/${sub._id}`} className="db-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                        <span className="db-row-title">{sub.assignmentId?.title}</span>
                        {/* 🔹 CHANGED — was: <span className={`db-pill ${sm.cls}`}>{sm.label}</span>
                            Now shows BOTH indexing and evaluation state as
                            one consistent badge (Submitted, Indexing,
                            Indexed, Evaluation Pending, Evaluating,
                            Evaluated, Failed), instead of only ever
                            showing evaluation status. See
                            utils/submissionStatusMap.js for the
                            precedence rules behind which label wins. */}
                        <RepoStatusBadge submission={sub} />
                      </div>
                      <p className="db-row-time">{formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}</p>
                    </div>

                    {sub.status === "published" && (
                      <div>
                        <div className="db-row-score">{sub.finalScore}</div>
                        <div className="db-row-rank">Rank #{sub.rank}</div>
                      </div>
                    )}
                    {/* 🔹 CHANGED — spinner now also shows during
                        'evaluating', not just 'pending', since
                        'evaluating' is a new status that didn't exist
                        when this condition was first written. Without
                        this, a submission actively being evaluated
                        would show no spinner and no badge-equivalent
                        visual cue in this specific spot (the badge above
                        already covers it, but the spinner was a second,
                        separate "something is happening" signal that
                        would otherwise have silently stopped applying). */}
                    {(sub.status === "pending" || sub.status === "evaluating") && <Loader2 className="db-spinner" />}
                  </Link>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </>
  );
}