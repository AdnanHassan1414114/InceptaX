import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom"; // 🔹 useNavigate added
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";

const STATUS_MAP = {
  pending:        { label: "Pending Review",  color: "var(--text3)",   border: "var(--border)" },
  ai_evaluated:   { label: "AI Evaluated",    color: "var(--amber)",   border: "rgba(251,191,36,0.3)" },
  admin_reviewed: { label: "Admin Reviewed",  color: "var(--blue)",    border: "rgba(96,165,250,0.3)" },
  published:      { label: "Published",       color: "var(--emerald)", border: "rgba(74,222,128,0.3)" },
  rejected:       { label: "Rejected",        color: "var(--red)",     border: "rgba(248,113,113,0.3)" },
};

// 🔹 Helper — consistent with chatController.js isPremiumUser()
//    Checks the stored user object from AuthContext (plan string + expiry).
function isPremiumActive(user) {
  if (!user) return false;
  if (user.plan === "free" || !user.plan) return false;
  if (!user.planExpiresAt) return false;
  return new Date() < new Date(user.planExpiresAt);
}

export default function SubmissionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate(); // 🔹 NEW

  const [sub, setSub]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [messages, setMessages]     = useState([]);
  const [msgText, setMsgText]       = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const chatBottomRef = useRef(null);

  // 🔹 Derived once, used in multiple places
  const userIsPremium = isPremiumActive(user);
  const userIsAdmin   = user?.role === "admin";

  // ── Fetch submission ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    api.get(`/submissions/${id}`)
      .then((res) => setSub(res.data.data.submission))
      .catch((err) => setError(err.response?.data?.message || "Failed to load submission"))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Fetch chat messages ──────────────────────────────────────────────────────
  // 🔹 UPDATED — only attempt if user is owner AND premium (or admin).
  //    Previously the logic was split across isPremiumActive (for loading) and
  //    canChat (for rendering), which were inconsistent.
  useEffect(() => {
    if (!sub || !user) return;

    const isOwner = sub.userId?._id === user._id ||
                    sub.userId?._id?.toString() === user._id?.toString() ||
                    sub.userId?.username === user.username;

    // 🔹 Only premium owners and admins fetch messages
    const canFetch = (isOwner && userIsPremium) || userIsAdmin;
    if (!canFetch) return;

    setLoadingMsgs(true);
    api.get(`/chat/${id}`)
      .then((res) => setMessages(res.data.data.data || []))
      .catch(() => {}) // silent — 403 here just means messages stay empty
      .finally(() => setLoadingMsgs(false));
  }, [sub, user, id, userIsPremium, userIsAdmin]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    setSendingMsg(true);
    try {
      const res = await api.post(`/chat/${id}`, { message: msgText.trim() });
      setMessages((prev) => [...prev, res.data.data.message]);
      setMsgText("");
    } catch (err) {
      // 🔹 If backend returns PREMIUM_REQUIRED sentinel, redirect to /pricing
      const msg = err.response?.data?.message || "";
      if (msg === "PREMIUM_REQUIRED" || err.response?.status === 403) {
        toast.error("Premium plan required for chat");
        navigate("/pricing");
      } else {
        toast.error(msg || "Failed to send message");
      }
    } finally {
      setSendingMsg(false);
    }
  };

  // ── Skeleton ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 16px" }}>
      <div className="skeleton" style={{ height: 220, borderRadius: 14, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 140, borderRadius: 14 }} />
    </div>
  );

  if (error) return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
      <div className="ix-card" style={{ padding: 40 }}>
        <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
        <Link to="/dashboard" className="btn-ghost">← Dashboard</Link>
      </div>
    </div>
  );

  if (!sub) return null;

  const sm = STATUS_MAP[sub.status] || STATUS_MAP.pending;

  const isOwner = sub.userId?._id === user?._id ||
                  sub.userId?._id?.toString() === user?._id?.toString() ||
                  sub.userId?.username === user?.username;

  // 🔹 UPDATED canChat logic — must be (owner AND premium) OR admin
  //    Old: isOwner || admin  (no plan check at all)
  //    New: (isOwner && premium) || admin
  const canChat         = (isOwner && userIsPremium) || userIsAdmin;

  // 🔹 NEW — owner but not premium: show upgrade prompt instead of chat
  const showUpgradePrompt = isOwner && !userIsPremium && !userIsAdmin;

  const Section = ({ title, children, style }) => (
    <div className="ix-card" style={{ padding: "20px", marginBottom: 12, ...style }}>
      <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", margin: "0 0 16px" }}>
        {title}
      </h3>
      {children}
    </div>
  );

  return (
    <div className="page-enter" style={{ maxWidth: 680, margin: "0 auto", padding: "40px 16px" }}>
      <Link
        to={`/challenges/${sub.assignmentId?._id}`}
        style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}
      >
        ← {sub.assignmentId?.title}
      </Link>

      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <div className="ix-card" style={{ padding: "22px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <img
                src={sub.userId?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${sub.userId?.name}&backgroundColor=111111&textColor=ffffff`}
                style={{ width: 26, height: 26, borderRadius: 7 }}
                alt=""
              />
              <Link to={`/u/${sub.userId?.username}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", textDecoration: "none" }}>
                {sub.userId?.name}
              </Link>
            </div>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: sm.color, border: `0.5px solid ${sm.border}`, padding: "2px 10px", borderRadius: 100, background: `${sm.border}20` }}>
              {sm.label}
            </span>
          </div>
          {sub.status === "published" && sub.finalScore !== null && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 32, fontWeight: 500, color: "var(--text1)", letterSpacing: "-1px" }}>{sub.finalScore}</div>
              <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)" }}>Rank #{sub.rank}</div>
            </div>
          )}
        </div>

        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, marginBottom: 18 }}>
          {sub.description}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={sub.repoLink} target="_blank" rel="noreferrer" className="btn-ghost" style={{ fontSize: 12 }}>
            GitHub Repo →
          </a>
          {sub.liveLink && (
            <a href={sub.liveLink} target="_blank" rel="noreferrer" className="btn-primary" style={{ fontSize: 12 }}>
              Live Demo →
            </a>
          )}
        </div>

        {sub.teamMembers?.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "0.5px solid var(--border)" }}>
            <p style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Team</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {sub.teamMembers.map((m) => (
                <span key={m} style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", border: "0.5px solid var(--border)", background: "var(--bg3)", borderRadius: 6, padding: "2px 10px" }}>
                  @{m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Score Breakdown ─────────────────────────────────────────────────── */}
      {sub.status !== "pending" && (
        <Section title="Score Breakdown">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { label: "AI Score",    value: sub.aiScore },
              { label: "Admin Score", value: sub.adminScore },
              { label: "Final Score", value: sub.finalScore },
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--bg3)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "16px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 500, color: "var(--text1)", marginBottom: 4 }}>
                  {s.value !== null ? s.value : "—"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── AI Feedback ─────────────────────────────────────────────────────── */}
      {(sub.aiFeedback?.strengths?.length > 0 || sub.aiFeedback?.weaknesses?.length > 0) && (
        <Section title="AI Feedback">
          {sub.aiFeedback.strengths?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--emerald)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>✓ Strengths</p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {sub.aiFeedback.strengths.map((s, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text2)", paddingLeft: 12, borderLeft: "2px solid rgba(74,222,128,0.3)", marginBottom: 6 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {sub.aiFeedback.weaknesses?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--red)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>✗ Weaknesses</p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {sub.aiFeedback.weaknesses.map((s, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text2)", paddingLeft: 12, borderLeft: "2px solid rgba(248,113,113,0.3)", marginBottom: 6 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {sub.aiFeedback.suggestions?.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--blue)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>→ Suggestions</p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {sub.aiFeedback.suggestions.map((s, i) => (
                  <li key={i} style={{ fontSize: 13, color: "var(--text2)", paddingLeft: 12, borderLeft: "2px solid rgba(96,165,250,0.3)", marginBottom: 6 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* ── Admin Notes ─────────────────────────────────────────────────────── */}
      {sub.adminNotes && (
        <Section title="Admin Notes">
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>{sub.adminNotes}</p>
        </Section>
      )}

      {/* ── Submission Chat ──────────────────────────────────────────────────── */}

      {/* 🔹 Case 1: owner but not premium → upgrade prompt */}
      {showUpgradePrompt && (
        <div
          className="ix-card"
          style={{
            padding: "28px 24px",
            textAlign: "center",
            borderColor: "rgba(251,191,36,0.3)",
            background: "rgba(251,191,36,0.03)",
          }}
        >
          {/* Lock icon */}
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", margin: "0 0 6px" }}>
            Chat is a Premium Feature
          </h3>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 20px", lineHeight: 1.6 }}>
            Upgrade to a Sprint or Pro plan to chat with admins about your submission,
            get faster feedback, and collaborate with your team.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/pricing" className="btn-primary" style={{ fontSize: 13 }}>
              View Plans →
            </Link>
            <Link to="/pricing" className="btn-ghost" style={{ fontSize: 13 }}>
              From ₹99 / 10 days
            </Link>
          </div>
        </div>
      )}

      {/* 🔹 Case 2: premium owner or admin → full chat UI (unchanged markup) */}
      {canChat && (
        <div className="ix-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", margin: 0 }}>
              Submission Chat
            </h3>
            {/* 🔹 Small premium badge so user knows why they have access */}
            <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--amber)", border: "0.5px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)", padding: "2px 8px", borderRadius: 100 }}>
              ✦ Premium
            </span>
          </div>

          <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {loadingMsgs ? (
              <p style={{ textAlign: "center", color: "var(--text2)", fontSize: 13 }}>Loading messages…</p>
            ) : messages.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text2)", fontSize: 13 }}>No messages yet</p>
            ) : (
              messages.map((m) => {
                const isMine =
                  m.senderId?._id === user?._id ||
                  m.senderId?._id?.toString() === user?._id?.toString() ||
                  m.senderId?.username === user?.username;
                return (
                  <div key={m._id} style={{ display: "flex", gap: 8, flexDirection: isMine ? "row-reverse" : "row" }}>
                    <img
                      src={m.senderId?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${m.senderId?.name}&backgroundColor=111111&textColor=ffffff`}
                      style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0 }}
                      alt=""
                    />
                    <div style={{ maxWidth: 260, padding: "8px 12px", borderRadius: 10, fontSize: 13, background: isMine ? "var(--btn-primary-bg)" : "var(--bg3)", color: isMine ? "var(--btn-primary-fg)" : "var(--text1)", border: isMine ? "none" : "0.5px solid var(--border)" }}>
                      {!isMine && (
                        <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text3)", marginBottom: 3 }}>
                          {m.senderId?.name}
                        </p>
                      )}
                      {m.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={sendMessage} style={{ display: "flex", gap: 8 }}>
            <input
              className="ix-input"
              style={{ flex: 1 }}
              placeholder="Type a message…"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
            />
            <button
              type="submit"
              disabled={sendingMsg || !msgText.trim()}
              className="btn-primary"
              style={{ padding: "9px 16px", fontSize: 13, opacity: sendingMsg || !msgText.trim() ? 0.5 : 1 }}
            >
              {sendingMsg ? "…" : "Send"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}