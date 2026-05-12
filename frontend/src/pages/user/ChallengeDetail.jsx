import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const DiffBadge = ({ d }) => <span className={`badge-${d}`}>{d}</span>;

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
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 16px" }}>
      <div className="skeleton" style={{ height: 240, borderRadius: 14, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 160, borderRadius: 14 }} />
    </div>
  );

  if (error) return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
      <div className="ix-card" style={{ padding: 40 }}>
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
        <Link to="/challenges" className="btn-ghost">← Back to Challenges</Link>
      </div>
    </div>
  );

  if (!assignment) return null;

  const expired = isPast(new Date(assignment.deadline));
  const isPremiumActive = user?.plan !== "free" && user?.planExpiresAt && new Date() < new Date(user.planExpiresAt);
  const canSubmit = user && !mySubmission && !expired && (!assignment.isPremium || isPremiumActive);

  return (
    <div className="page-enter" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 16px" }}>
      <Link to="/challenges" style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}>
        ← All Challenges
      </Link>

      <div className="ix-card" style={{ padding: "24px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <DiffBadge d={assignment.difficulty} />
            {assignment.isPremium && <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--amber)", border: "0.5px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)", padding: "2px 8px", borderRadius: 100 }}>✦ Premium</span>}
            {expired && <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--red)", border: "0.5px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.05)", padding: "2px 8px", borderRadius: 100 }}>Ended</span>}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            {canSubmit && <Link to={`/challenges/${id}/submit`} className="btn-primary" style={{ fontSize: 12 }}>Submit Project →</Link>}
            {mySubmission && <Link to={`/submissions/${mySubmission._id}`} className="btn-ghost" style={{ fontSize: 12 }}>View My Submission</Link>}
            {!user && !expired && <Link to="/login" className="btn-primary" style={{ fontSize: 12 }}>Sign in to Submit →</Link>}
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--text1)", margin: "0 0 12px", letterSpacing: "-0.4px" }}>{assignment.title}</h1>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 18 }}>{assignment.description}</p>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {(assignment.tags || []).map((t) => (
            <span key={t} style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)", border: "0.5px solid var(--border)", padding: "2px 8px", borderRadius: 4 }}>{t}</span>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 16, borderTop: "0.5px solid var(--border)", paddingTop: 18 }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--text3)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Deadline</p>
            <p style={{ fontSize: 13, color: "var(--text1)", margin: "0 0 2px" }}>{format(new Date(assignment.deadline), "MMM d, yyyy")}</p>
            {!expired && <p style={{ fontSize: 11, color: "var(--emerald)", margin: 0 }}>{formatDistanceToNow(new Date(assignment.deadline), { addSuffix: true })}</p>}
          </div>
          {assignment.prize && (
            <div>
              <p style={{ fontSize: 11, color: "var(--text3)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Prize</p>
              <p style={{ fontSize: 13, color: "var(--text1)", margin: 0 }}>{assignment.prize}</p>
            </div>
          )}
        </div>
      </div>

      {/* 🔹 NEW — Teams card */}
      <div className="ix-card" style={{ padding: "18px 20px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", margin: "0 0 2px" }}>
            Looking for teammates?
          </p>
          <p style={{ fontSize: 12, color: "var(--text2)", margin: 0 }}>
            Browse teams for this challenge or create your own.
          </p>
        </div>
        <Link
          to={`/challenges/${id}/teams`}
          className="btn-ghost"
          style={{ fontSize: 12, flexShrink: 0 }}
        >
          Browse Teams →
        </Link>
      </div>

      {/* Top Submissions */}
      <div className="ix-card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", margin: 0 }}>Top Submissions</h2>
          <Link to={`/leaderboard/challenge/${id}`} style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none" }}>Full leaderboard →</Link>
        </div>
        {topSubs.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text2)" }}>No submissions yet — be the first!</p>
        ) : (
          <div className="space-y-2">
            {topSubs.map((sub, i) => (
              <Link
                key={sub._id}
                to={`/submissions/${sub._id}`}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "0.5px solid var(--border)", background: "var(--bg3)", textDecoration: "none", transition: "border-color 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border2)"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text3)", width: 20 }}>#{i + 1}</span>
                <img src={sub.userId?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${sub.userId?.name}&backgroundColor=111111&textColor=ffffff`} style={{ width: 26, height: 26, borderRadius: 7 }} alt="" />
                <span style={{ flex: 1, fontSize: 13, color: "var(--text1)" }}>{sub.userId?.name}</span>
                {sub.finalScore !== null && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)" }}>{sub.finalScore}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}