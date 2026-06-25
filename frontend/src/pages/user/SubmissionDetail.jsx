import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";
// 🔹 NEW — RAG lifecycle pieces. Added on top of the existing file;
// nothing below this line removes or alters the chat system, score
// breakdown, or AI evaluation breakdown sections that already existed.
import { useSubmissionStatus } from "../../hooks/useSubmissionStatus";
import { getSubmissionDisplayState } from "../../utils/submissionStatusMap";
import RepoStatusBadge from "../../components/RepoStatusBadge";

const STATUS_MAP = {
  pending:        { label: "Pending Review",  color: "var(--text3)",   border: "var(--border)" },
  ai_evaluated:   { label: "AI Evaluated",    color: "var(--amber)",   border: "rgba(251,191,36,0.3)" },
  admin_reviewed: { label: "Admin Reviewed",  color: "var(--blue)",    border: "rgba(96,165,250,0.3)" },
  published:      { label: "Published",       color: "var(--emerald)", border: "rgba(74,222,128,0.3)" },
  rejected:       { label: "Rejected",        color: "var(--red)",     border: "rgba(248,113,113,0.3)" },
  // 🔹 NEW — 'evaluating' didn't exist when STATUS_MAP was first written
  // (see evaluating-state-patch.txt). Without this entry, the fallback
  // `STATUS_MAP[sub.status] || STATUS_MAP.pending` would silently show
  // "Pending Review" while evaluation is actively running — confusing,
  // since the user would think nothing has started yet.
  evaluating:     { label: "Evaluating…",     color: "var(--violet)",  border: "rgba(167,139,250,0.3)" },
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
  const navigate = useNavigate();

  const [sub, setSub]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [messages, setMessages]     = useState([]);
  const [msgText, setMsgText]       = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const chatBottomRef = useRef(null);

  // 🔹 NEW — live polling for repoStatus/status, same hook used on
  // Dashboard/AdminSubmissions so all three pages show identical state.
  // This does NOT replace the existing api.get(`/submissions/${id}`)
  // fetch below — that fetch still loads the full submission (repoLink,
  // description, aiFeedback, aiEvaluations, chat eligibility, etc).
  // This hook only tracks the two small fields that change quickly
  // during indexing/evaluation, polled every 4s.
  const { data: liveStatus } = useSubmissionStatus(id);
  const [retrying, setRetrying] = useState(false);

  // Tracks the last state we already re-fetched the full submission
  // for, so a full re-fetch only happens when the displayed state
  // actually transitions (e.g. indexed -> evaluated) — not on every
  // single 4-second poll tick.
  const lastFetchedStateKeyRef = useRef(null);

  // 🔹 Derived once, used in multiple places
  const userIsPremium = isPremiumActive(user);
  const userIsAdmin   = user?.role === "admin";

  // ── Fetch submission ─────────────────────────────────────────────────────────
  const fetchSubmission = () => {
    setLoading(true);
    return api.get(`/submissions/${id}`)
      .then((res) => setSub(res.data.data.submission))
      .catch((err) => setError(err.response?.data?.message || "Failed to load submission"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubmission();
  }, [id]);

  // 🔹 NEW — re-fetch the full submission whenever the polled state
  // transitions to a state we haven't already fetched for. This is
  // what makes AI feedback / aiEvaluations appear automatically once
  // evaluation finishes, without the user manually refreshing the page.
  useEffect(() => {
    if (!liveStatus || !sub) return;
    const currentKey = getSubmissionDisplayState(liveStatus).key;
    if (currentKey !== lastFetchedStateKeyRef.current) {
      const isFirstObservation = lastFetchedStateKeyRef.current === null;
      lastFetchedStateKeyRef.current = currentKey;
      // Skip the re-fetch the very first time this effect runs right
      // after the initial mount fetch already completed — avoids a
      // redundant duplicate request on page load.
      if (!isFirstObservation) fetchSubmission();
    }
  }, [liveStatus, sub]);

  // 🔹 NEW — retry a failed indexing attempt.
  const handleRetryIndexing = async () => {
    setRetrying(true);
    try {
      await api.post(`/submissions/${id}/retry-indexing`);
      toast.success("Retrying indexing…");
      lastFetchedStateKeyRef.current = null; // force a re-fetch on next state change
    } catch (err) {
      toast.error(err.response?.data?.message || "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  // ── Fetch chat messages ──────────────────────────────────────────────────────
  // UNCHANGED from the original file — only attempt if user is owner AND
  // premium (or admin).
  useEffect(() => {
    if (!sub || !user) return;

    const isOwner = sub.userId?._id === user._id ||
                    sub.userId?._id?.toString() === user._id?.toString() ||
                    sub.userId?.username === user.username;

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

  // 🔹 NEW — merge polled live state over the full submission for
  // display purposes only (repoStatus/status badges + helper text).
  // Falls back to `sub`'s own fields before the first poll resolves,
  // so there's no flash of "undefined" state on initial render.
  const displaySource = liveStatus || sub;
  const ragState = getSubmissionDisplayState(displaySource);

  // UNCHANGED — original evaluation-status badge lookup, now also
  // covers 'evaluating' via the STATUS_MAP addition above.
  const sm = STATUS_MAP[sub.status] || STATUS_MAP.pending;

  const isOwner = sub.userId?._id === user?._id ||
                  sub.userId?._id?.toString() === user?._id?.toString() ||
                  sub.userId?.username === user?.username;

  const canChat         = (isOwner && userIsPremium) || userIsAdmin;
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

      {/* 🔹 NEW — Repository indexing status card. Placed ABOVE the
          existing main card so the user sees "is my repo even readable
          yet" before anything else — this did not exist in the original
          file at all; indexing state had zero UI representation before. */}
      {(ragState.key === "submitted" || ragState.key === "indexing" || ragState.key === "failed" || ragState.key === "indexed") && (
        <div className="ix-card" style={{ padding: "18px 20px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <RepoStatusBadge submission={displaySource} size="md" />
            {ragState.key === "failed" && (
              <button
                onClick={handleRetryIndexing}
                disabled={retrying}
                className="btn-primary"
                style={{ fontSize: 12, padding: "6px 14px", opacity: retrying ? 0.6 : 1 }}
              >
                {retrying ? "Retrying…" : "Retry Indexing"}
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--text2)", margin: 0, lineHeight: 1.6 }}>
            {ragState.key === "submitted" && "Your submission has been received and is queued for repository indexing."}
            {ragState.key === "indexing" && "We're reading your repository so the AI evaluators can review your actual code, not just the description."}
            {ragState.key === "failed" && "We couldn't process your repository — it may be private, deleted, or temporarily unreachable. You can retry, or contact support if this keeps happening."}
            {ragState.key === "indexed" && "Your repository is indexed and ready. An admin will run the AI evaluation shortly."}
          </p>
        </div>
      )}

      {/* ── Main card — UNCHANGED from the original file ─────────────────────── */}
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

      {/* ── Score Breakdown — UNCHANGED ───────────────────────────────────────── */}
      {sub.status !== "pending" && sub.status !== "evaluating" && (
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
      {/* 🔹 NEW — note on the condition change above: original was just
          `sub.status !== "pending"`. Since 'evaluating' is a real status
          a submission can now have (it didn't exist before), showing an
          all-"—" score breakdown card while evaluation is actively
          running was misleading (looks like a rejected/empty result,
          not "in progress"). Excluding 'evaluating' here means this
          card simply doesn't render until real scores exist —
          consistent with how it never rendered for 'pending' either. */}

      {/* ── AI Feedback — UNCHANGED ───────────────────────────────────────────── */}
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

      {/* AI Evaluation Breakdown — UNCHANGED (premium users only, since
          backend strips aiEvaluations from the response for free users) */}
      {sub.aiEvaluations?.length > 0 && (
        <Section title="AI Evaluation Breakdown">
          <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            ✦ Premium — {sub.aiEvaluations.length} AI providers evaluated this submission
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {sub.aiEvaluations.map((ev) => (
              <div key={ev.provider} style={{ background: "var(--bg3)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", textTransform: "capitalize" }}>
                    {ev.provider}
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.5px" }}>
                    {ev.score}
                  </span>
                </div>

                {ev.strengths?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--emerald)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>✓ Strengths</p>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {ev.strengths.map((s, i) => (
                        <li key={i} style={{ fontSize: 12, color: "var(--text2)", paddingLeft: 10, borderLeft: "2px solid rgba(74,222,128,0.3)", marginBottom: 5 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {ev.weaknesses?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--red)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>✗ Weaknesses</p>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {ev.weaknesses.map((s, i) => (
                        <li key={i} style={{ fontSize: 12, color: "var(--text2)", paddingLeft: 10, borderLeft: "2px solid rgba(248,113,113,0.3)", marginBottom: 5 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {ev.improvements?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--blue)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>→ What Could Be Better</p>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {ev.improvements.map((s, i) => (
                        <li key={i} style={{ fontSize: 12, color: "var(--text2)", paddingLeft: 10, borderLeft: "2px solid rgba(96,165,250,0.3)", marginBottom: 5 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {ev.issues?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--amber)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>⚠ Issues Found</p>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {ev.issues.map((s, i) => (
                        <li key={i} style={{ fontSize: 12, color: "var(--text2)", paddingLeft: 10, borderLeft: "2px solid rgba(251,191,36,0.3)", marginBottom: 5 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Admin Notes — UNCHANGED ───────────────────────────────────────────── */}
      {sub.adminNotes && (
        <Section title="Admin Notes">
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>{sub.adminNotes}</p>
        </Section>
      )}

      {/* ── Submission Chat — UNCHANGED, fully preserved ──────────────────────── */}

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

      {canChat && (
        <div className="ix-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", margin: 0 }}>
              Submission Chat
            </h3>
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