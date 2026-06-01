import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

/* ── Styles ──────────────────────────────────────────────────────── */
const css = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes db-pulse {
    0%, 100% { opacity: 0.06; }
    50%       { opacity: 0.14; }
  }

  .db-root {
    --bg: #ffffff;
    --fg: #000000;
    --border: #000000;
    --text1: #000000;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .dark .db-root,
  [data-theme="dark"] .db-root {
    --bg: #000000;
    --fg: #ffffff;
    --border: #ffffff;
    --text1: #ffffff;
  }
  .db-root * { box-sizing: border-box; }

  /* Card */
  .db-card {
    background: var(--bg);
    border: 1.5px solid var(--border);
  }

  /* Stat card */
  .db-stat {
    padding: 20px 18px;
    background: var(--bg);
    border: 1.5px solid var(--border);
  }

  /* Badge */
  .db-badge {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    font-family: inherit;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1.5px solid var(--border);
    color: var(--text1);
    background: var(--bg);
    border-radius: 0;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Buttons */
  .db-btn-primary {
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
  .db-btn-ghost {
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
    transition: background 0.12s, color 0.12s;
  }
  .db-btn-ghost:hover { background: var(--fg); color: var(--bg); }

  /* Submission row */
  .db-sub-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 20px;
    text-decoration: none;
    border-top: 1.5px solid var(--border);
    transition: background 0.12s;
  }
  .db-sub-row:first-child { border-top: none; }
  .db-sub-row:hover { background: var(--fg); }
  .db-sub-row:hover .db-sub-title,
  .db-sub-row:hover .db-sub-time,
  .db-sub-row:hover .db-sub-score,
  .db-sub-row:hover .db-sub-rank,
  .db-sub-row:hover .db-badge { color: var(--bg); border-color: rgba(255,255,255,0.3); }

  .db-sub-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .db-sub-time {
    font-size: 11px;
    color: var(--text1);
    opacity: 0.4;
    margin: 3px 0 0;
  }
  .db-sub-score {
    font-size: 20px;
    font-weight: 700;
    color: var(--text1);
    letter-spacing: -0.03em;
    text-align: right;
  }
  .db-sub-rank {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text1);
    opacity: 0.4;
    text-align: right;
  }

  /* Skeleton */
  .db-skeleton {
    background: var(--fg);
    border: 1.5px solid var(--border);
    animation: db-pulse 1.4s ease-in-out infinite;
    margin-bottom: 8px;
  }

  /* Divider */
  .db-divider {
    border: none;
    border-top: 1.5px solid var(--border);
    opacity: 0.12;
    margin: 24px 0;
  }

  /* Spinner */
  .db-spinner {
    width: 16px;
    height: 16px;
    border: 1.5px solid var(--border);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
    opacity: 0.4;
  }
`;

const STATUS_MAP = {
  pending:        { label: "Pending"   },
  ai_evaluated:   { label: "AI Done"   },
  admin_reviewed: { label: "In Review" },
  published:      { label: "Published" },
  rejected:       { label: "Rejected"  },
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
    { label: "Total Submissions", value: submissions.length, icon: "◈" },
    { label: "Published",         value: published.length,   icon: "◉" },
    { label: "Best Score",        value: bestScore || "—",   icon: "◎" },
    { label: "Plan",              value: planLabel,           icon: "✦" },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="db-root" style={{ maxWidth: 900, margin: "0 auto", padding: "48px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 36, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text1)", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Dashboard</h1>
            <p style={{ fontSize: 13, color: "var(--text1)", margin: 0, opacity: 0.45 }}>Track your submissions and progress</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to={`/u/${user?.username}`} className="db-btn-ghost">My Profile →</Link>
            <Link to="/challenges" className="db-btn-primary">+ Submit</Link>
          </div>
        </div>

        {/* Plan banner */}
        {!isPremiumActive && (
          <div className="db-card" style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text1)", margin: "0 0 4px" }}>Unlock premium challenges</p>
              <p style={{ fontSize: 12, color: "var(--text1)", margin: 0, opacity: 0.5 }}>Team collaboration, premium challenges, priority evaluation — from ₹99</p>
            </div>
            <Link to="/pricing" className="db-btn-primary" style={{ flexShrink: 0 }}>Upgrade →</Link>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 36 }}>
          {stats.map((s) => (
            <div key={s.label} className="db-stat">
              <div style={{ fontSize: 16, marginBottom: 14, color: "var(--text1)", opacity: 0.3 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text1)", letterSpacing: "-0.04em", marginBottom: 4, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text1)", opacity: 0.4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Section title */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text1)", margin: 0, letterSpacing: "-0.02em" }}>My Submissions</h2>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text1)", opacity: 0.35 }}>
            {submissions.length} total
          </span>
        </div>

        {/* Submissions list */}
        {loading ? (
          <div>
            {Array(3).fill(0).map((_, i) => <div key={i} className="db-skeleton" style={{ height: 72 }} />)}
          </div>
        ) : submissions.length === 0 ? (
          <div className="db-card" style={{ padding: "64px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text1)", opacity: 0.45, marginBottom: 20 }}>No submissions yet</p>
            <Link to="/challenges" className="db-btn-primary">Browse Challenges →</Link>
          </div>
        ) : (
          <div className="db-card" style={{ overflow: "hidden" }}>
            {submissions.map((sub) => {
              const sm = STATUS_MAP[sub.status] || STATUS_MAP.pending;
              return (
                <Link key={sub._id} to={`/submissions/${sub._id}`} className="db-sub-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                      <span className="db-sub-title">{sub.assignmentId?.title}</span>
                      <span className="db-badge">{sm.label}</span>
                    </div>
                    <p className="db-sub-time">{formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}</p>
                  </div>

                  {sub.status === "published" && (
                    <div style={{ flexShrink: 0 }}>
                      <div className="db-sub-score">{sub.finalScore}</div>
                      <div className="db-sub-rank">Rank #{sub.rank}</div>
                    </div>
                  )}

                  {sub.status === "pending" && (
                    <div className="db-spinner" />
                  )}
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </>
  );
}