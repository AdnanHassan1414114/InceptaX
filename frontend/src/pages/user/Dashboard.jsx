import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const STATUS_MAP = {
  pending:        { label: "Pending",     color: "var(--text3)",  border: "var(--border)" },
  ai_evaluated:   { label: "AI Done",     color: "var(--amber)",  border: "rgba(251,191,36,0.3)" },
  admin_reviewed: { label: "In Review",   color: "var(--blue)",   border: "rgba(96,165,250,0.3)" },
  published:      { label: "Published",   color: "var(--emerald)",border: "rgba(74,222,128,0.3)" },
  rejected:       { label: "Rejected",    color: "var(--red)",    border: "rgba(248,113,113,0.3)" },
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

  return (
    <div className="page-enter" style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--text1)", margin: "0 0 4px", letterSpacing: "-0.4px" }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>Track your submissions and progress</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to={`/u/${user?.username}`} className="btn-ghost" style={{ fontSize: 12 }}>My Profile →</Link>
          <Link to="/challenges" className="btn-primary" style={{ fontSize: 12 }}>+ Submit</Link>
        </div>
      </div>

      {/* Plan banner */}
      {!isPremiumActive && (
        <div className="ix-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24, borderColor: "var(--border2)" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", margin: "0 0 3px" }}>Unlock premium challenges</p>
            <p style={{ fontSize: 12, color: "var(--text2)", margin: 0 }}>Team collaboration, premium challenges, priority evaluation — from ₹99</p>
          </div>
          <Link to="/pricing" className="btn-primary" style={{ fontSize: 12, flexShrink: 0, padding: "8px 16px" }}>Upgrade →</Link>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginBottom: 32 }}>
        {[
          { label: "Total",     value: submissions.length, icon: "◈" },
          { label: "Published", value: published.length,   icon: "◉" },
          { label: "Best Score",value: bestScore || "—",   icon: "◎" },
          { label: "Plan",      value: user?.plan === "free" ? "Free" : user?.plan === "ten_day" ? "Sprint" : "Pro", icon: "✦" },
        ].map((s) => (
          <div key={s.label} className="ix-card" style={{ padding: "18px 16px" }}>
            <div style={{ fontFamily: "monospace", color: "var(--text3)", fontSize: 15, marginBottom: 10 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.5px", marginBottom: 2 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Submissions */}
      <h2 style={{ fontSize: 15, fontWeight: 500, color: "var(--text1)", margin: "0 0 16px", letterSpacing: "-0.2px" }}>My Submissions</h2>

      {loading ? (
        <div className="space-y-2">
          {Array(3).fill(0).map((_, i) => <div key={i} className="ix-card skeleton" style={{ height: 72 }} />)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="ix-card" style={{ padding: "56px 24px", textAlign: "center" }}>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 16 }}>No submissions yet</p>
          <Link to="/challenges" className="btn-primary">Browse Challenges →</Link>
        </div>
      ) : (
        <div className="ix-card" style={{ overflow: "hidden" }}>
          {submissions.map((sub, i) => {
            const sm = STATUS_MAP[sub.status] || STATUS_MAP.pending;
            return (
              <Link
                key={sub._id}
                to={`/submissions/${sub._id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 20px",
                  borderTop: i > 0 ? "0.5px solid var(--border)" : "none",
                  textDecoration: "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sub.assignmentId?.title}
                    </span>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: sm.color, border: `0.5px solid ${sm.border}`, padding: "2px 8px", borderRadius: 100, background: `${sm.border}20`, flexShrink: 0 }}>
                      {sm.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text3)", fontFamily: "monospace", margin: 0 }}>
                    {formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {sub.status === "published" && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.5px" }}>{sub.finalScore}</div>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text3)" }}>Rank #{sub.rank}</div>
                  </div>
                )}
                {sub.status === "pending" && (
                  <div style={{ width: 16, height: 16, border: "1.5px solid var(--border2)", borderTop: "1.5px solid var(--text2)", borderRadius: "50%", animation: "spin 1s linear infinite", flexShrink: 0 }} />
                )}
              </Link>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}