import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";

/* ── Constants ───────────────────────────────────────────────────── */
const STATUS_NEXT = {
  Planning:  "Building",
  Building:  "Completed",
  Completed: null,
};

/* ── Styles ──────────────────────────────────────────────────────── */
const css = `
  .tm-root {
    --bg: #ffffff;
    --fg: #000000;
    --border: #000000;
    --text1: #000000;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .dark .tm-root,
  [data-theme="dark"] .tm-root {
    --bg: #000000;
    --fg: #ffffff;
    --border: #ffffff;
    --text1: #ffffff;
  }
  .tm-root * { box-sizing: border-box; }

  /* Card */
  .tm-card {
    background: var(--bg);
    border: 1.5px solid var(--border);
    padding: 24px;
    margin-bottom: 12px;
  }

  /* Badge */
  .tm-badge {
    display: inline-flex;
    align-items: center;
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

  /* Role / skill tag */
  .tm-tag {
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
  .tm-btn-primary {
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
    transition: opacity 0.12s;
  }
  .tm-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .tm-btn-ghost {
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
  .tm-btn-ghost:hover:not(:disabled) { background: var(--fg); color: var(--bg); }
  .tm-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

  .tm-btn-danger {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: var(--bg);
    color: var(--fg);
    border: 1.5px solid var(--border);
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.12s, background 0.12s, color 0.12s;
  }
  .tm-btn-danger:hover:not(:disabled) { opacity: 1; background: var(--fg); color: var(--bg); }
  .tm-btn-danger:disabled { opacity: 0.2; cursor: not-allowed; }

  /* Divider */
  .tm-divider {
    border: none;
    border-top: 1.5px solid var(--border);
    margin: 20px 0;
    opacity: 0.15;
  }

  /* Meta label */
  .tm-meta-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text1);
    opacity: 0.4;
    margin: 0 0 4px;
  }
  .tm-meta-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text1);
    margin: 0;
  }

  /* Member / request row */
  .tm-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-top: 1.5px solid var(--border);
  }
  .tm-row:first-child { border-top: none; }

  /* Back link */
  .tm-back {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fg);
    text-decoration: none;
    opacity: 0.45;
  }
  .tm-back:hover { opacity: 1; }

  /* Section title */
  .tm-section-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text1);
    margin: 0;
    letter-spacing: -0.01em;
  }

  /* Chat */
  .tm-chat-box {
    max-height: 320px;
    overflow-y: auto;
    margin-bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    border: 1.5px solid var(--border);
  }
  .tm-chat-input {
    flex: 1;
    height: 40px;
    padding: 0 14px;
    font-family: inherit;
    font-size: 13px;
    background: var(--bg);
    color: var(--fg);
    border: 1.5px solid var(--border);
    outline: none;
  }
  .tm-chat-input:focus { outline: 2px solid var(--fg); outline-offset: 1px; }

  /* Skeleton */
  .tm-skeleton {
    border: 1.5px solid var(--border);
    background: var(--fg);
    animation: tm-pulse 1.4s ease-in-out infinite;
    margin-bottom: 12px;
  }
  @keyframes tm-pulse {
    0%, 100% { opacity: 0.06; }
    50% { opacity: 0.14; }
  }
`;

/* ── Avatar ──────────────────────────────────────────────────────── */
const Avatar = ({ name, profileImage, size = 28 }) => (
  <img
    src={profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${name || "U"}&backgroundColor=111111&textColor=ffffff`}
    style={{ width: size, height: size, borderRadius: 0, border: "1.5px solid var(--border)", flexShrink: 0 }}
    alt={name || ""}
  />
);

/* ── Section wrapper ─────────────────────────────────────────────── */
const Section = ({ title, children, action }) => (
  <div className="tm-card">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <h3 className="tm-section-title">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

/* ── Main ────────────────────────────────────────────────────────── */
export default function Team() {
  const { teamId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [requesting, setRequesting]       = useState(false);
  const [leaving, setLeaving]             = useState(false);
  const [removingId, setRemovingId]       = useState(null);
  const [respondingId, setRespondingId]   = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [messages, setMessages]           = useState([]);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [msgText, setMsgText]             = useState("");
  const [sendingMsg, setSendingMsg]       = useState(false);
  const chatBottomRef                     = useRef(null);

  const fetchTeam = useCallback(() => {
    setLoading(true);
    api.get(`/teams/${teamId}`)
      .then((res) => setTeam(res.data.data.team))
      .catch((err) => setError(err.response?.data?.message || "Failed to load team"))
      .finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  useEffect(() => {
    if (!team || !user || (!team.isMember && !team.isCreator)) return;
    setLoadingMsgs(true);
    api.get(`/teams/${teamId}/chat`, { params: { limit: 50 } })
      .then((res) => setMessages(res.data.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  }, [team?.isMember, team?.isCreator, teamId, user]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleRequestJoin = async () => {
    setRequesting(true);
    try {
      await api.post(`/teams/${teamId}/request`);
      toast.success("Join request sent!");
      setTeam((prev) => ({ ...prev, hasRequested: true }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send request");
    } finally { setRequesting(false); }
  };

  const handleLeave = async () => {
    if (!window.confirm("Leave this team?")) return;
    setLeaving(true);
    try {
      await api.delete(`/teams/${teamId}/members/${user._id}`);
      toast.success("You have left the team");
      navigate(`/challenges/${team.challengeId?._id}/teams`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to leave team");
      setLeaving(false);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Remove ${memberName}?`)) return;
    setRemovingId(memberId);
    try {
      const res = await api.delete(`/teams/${teamId}/members/${memberId}`);
      toast.success("Member removed");
      setTeam((prev) => ({ ...prev, ...res.data.data.team }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member");
    } finally { setRemovingId(null); }
  };

  const handleRespond = async (requestUserId, action) => {
    setRespondingId(requestUserId);
    try {
      const res = await api.patch(`/teams/${teamId}/requests/${requestUserId}`, { action });
      toast.success(action === "accept" ? "Member accepted!" : "Request rejected");
      if (action === "accept" && res.data.data?.team) {
        setTeam((prev) => ({
          ...prev,
          members: res.data.data.team.members,
          status: res.data.data.team.status,
          openSpots: res.data.data.team.maxMembers - res.data.data.team.members.length,
          joinRequests: (prev.joinRequests || []).filter((r) => r.userId?._id !== requestUserId),
        }));
      } else {
        setTeam((prev) => ({ ...prev, joinRequests: (prev.joinRequests || []).filter((r) => r.userId?._id !== requestUserId) }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    } finally { setRespondingId(null); }
  };

  const handleStatusAdvance = async () => {
    const nextStatus = STATUS_NEXT[team.status];
    if (!nextStatus) return;
    if (!window.confirm(`Move team status to "${nextStatus}"?`)) return;
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/teams/${teamId}/status`, { status: nextStatus });
      toast.success(`Status updated to ${nextStatus}`);
      setTeam((prev) => ({ ...prev, status: res.data.data.team.status }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally { setUpdatingStatus(false); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    setSendingMsg(true);
    try {
      const res = await api.post(`/teams/${teamId}/chat`, { message: msgText.trim() });
      setMessages((prev) => [...prev, res.data.data.message]);
      setMsgText("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send message");
    } finally { setSendingMsg(false); }
  };

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="tm-root" style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px" }}>
        <div className="tm-skeleton" style={{ height: 220 }} />
        <div className="tm-skeleton" style={{ height: 180 }} />
        <div className="tm-skeleton" style={{ height: 140 }} />
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{css}</style>
      <div className="tm-root" style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <div className="tm-card" style={{ padding: 48 }}>
          <p style={{ color: "var(--text1)", opacity: 0.6, marginBottom: 20 }}>{error}</p>
          <Link to="/challenges" className="tm-btn-ghost">← Back to Challenges</Link>
        </div>
      </div>
    </>
  );

  if (!team) return null;

  const { isCreator, isMember, hasRequested, openSpots } = team;
  const isFull      = openSpots <= 0;
  const canChat     = isMember || isCreator;
  const challengeId = team.challengeId?._id;
  const nextStatus  = STATUS_NEXT[team.status];

  return (
    <>
      <style>{css}</style>
      <div className="tm-root" style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px" }}>

        {/* Breadcrumb */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
          <Link to={`/challenges/${challengeId}`} className="tm-back">
            ← {team.challengeId?.title || "Challenge"}
          </Link>
          <span style={{ fontSize: 12, color: "var(--text1)", opacity: 0.25 }}>/</span>
          <Link to={`/challenges/${challengeId}/teams`} className="tm-back">Teams</Link>
        </div>

        {/* Header card */}
        <div className="tm-card">
          {/* Badges + actions */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="tm-badge">{team.status}</span>
              {isFull && <span className="tm-badge">Full</span>}
              {team.status === "Completed" && <span className="tm-badge">✓ Completed</span>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isCreator && nextStatus && (
                <button onClick={handleStatusAdvance} disabled={updatingStatus} className="tm-btn-ghost">
                  {updatingStatus ? "Updating…" : `Mark as ${nextStatus} →`}
                </button>
              )}
              {!isMember && !isCreator && team.status !== "Completed" && !isFull && (
                <button onClick={handleRequestJoin} disabled={requesting || hasRequested} className={hasRequested ? "tm-btn-ghost" : "tm-btn-primary"}>
                  {requesting ? "Sending…" : hasRequested ? "Request Sent ✓" : "Request to Join →"}
                </button>
              )}
              {isMember && !isCreator && (
                <button onClick={handleLeave} disabled={leaving} className="tm-btn-ghost">
                  {leaving ? "Leaving…" : "Leave Team"}
                </button>
              )}
            </div>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text1)", margin: "0 0 8px", letterSpacing: "-0.03em", lineHeight: 1.2 }}>
            {team.teamName}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text1)", margin: "0 0 20px", opacity: 0.5 }}>
            For{" "}
            <Link to={`/challenges/${challengeId}`} style={{ color: "var(--text1)", textDecoration: "underline", opacity: 1 }}>
              {team.challengeId?.title}
            </Link>
          </p>

          <hr className="tm-divider" />

          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 20 }}>
            <div>
              <p className="tm-meta-label">Members</p>
              <p className="tm-meta-value">
                {team.members?.length} / {team.maxMembers}
                {!isFull && <span style={{ fontSize: 11, opacity: 0.45, marginLeft: 8 }}>{openSpots} open</span>}
              </p>
            </div>
            {team.challengeId?.deadline && (
              <div>
                <p className="tm-meta-label">Challenge Deadline</p>
                <p className="tm-meta-value">{formatDistanceToNow(new Date(team.challengeId.deadline), { addSuffix: true })}</p>
              </div>
            )}
            {team.requiredRoles?.length > 0 && (
              <div>
                <p className="tm-meta-label">Looking For</p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
                  {team.requiredRoles.map((role) => (
                    <span key={role} className="tm-tag">{role}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Members */}
        <Section
          title={`Members (${team.members?.length})`}
          action={isCreator ? <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text1)", opacity: 0.35 }}>You are the leader</span> : null}
        >
          {team.members?.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text1)", opacity: 0.45, margin: 0 }}>No members yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {team.members.map((member) => {
                const isLeader   = member._id?.toString() === team.createdBy?._id?.toString();
                const isRemoving = removingId === member._id;
                const isSelf     = member._id?.toString() === user?._id?.toString();
                return (
                  <div key={member._id} className="tm-row">
                    <Avatar name={member.name} profileImage={member.profileImage} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link to={`/u/${member.username}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {member.name}
                      </Link>
                      <p style={{ fontSize: 11, color: "var(--text1)", opacity: 0.4, margin: 0 }}>
                        @{member.username}{isLeader && <span style={{ marginLeft: 6, opacity: 1 }}>· Leader</span>}
                      </p>
                    </div>
                    {isCreator && !isLeader && (
                      <button onClick={() => handleRemoveMember(member._id, member.name)} disabled={isRemoving} className="tm-btn-danger">
                        {isRemoving ? "…" : "Remove"}
                      </button>
                    )}
                    {!isCreator && isMember && isSelf && (
                      <button onClick={handleLeave} disabled={leaving} className="tm-btn-danger">
                        {leaving ? "…" : "Leave"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Join Requests (creator only) */}
        {isCreator && (
          <Section title={`Join Requests${team.joinRequests?.length ? ` (${team.joinRequests.length})` : ""}`}>
            {!team.joinRequests || team.joinRequests.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text1)", opacity: 0.45, margin: 0 }}>No pending requests.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {team.joinRequests.map((req, i) => {
                  const u = req.userId;
                  const isResponding = respondingId === u?._id;
                  return (
                    <div key={req._id || u?._id} className="tm-row">
                      <Avatar name={u?.name} profileImage={u?.profileImage} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link to={`/u/${u?.username}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {u?.name}
                        </Link>
                        <p style={{ fontSize: 11, color: "var(--text1)", opacity: 0.4, margin: 0 }}>
                          @{u?.username} · {req.requestedAt ? formatDistanceToNow(new Date(req.requestedAt), { addSuffix: true }) : ""}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, opacity: isResponding ? 0.5 : 1 }}>
                        <button onClick={() => handleRespond(u?._id, "accept")} disabled={isResponding || isFull} className="tm-btn-primary" style={{ height: 30, padding: "0 12px", fontSize: 11 }}>
                          {isResponding ? "…" : "Accept"}
                        </button>
                        <button onClick={() => handleRespond(u?._id, "reject")} disabled={isResponding} className="tm-btn-ghost" style={{ height: 30, padding: "0 12px", fontSize: 11 }}>
                          {isResponding ? "…" : "Reject"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* Sign-in prompt */}
        {!user && (
          <div className="tm-card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 13, color: "var(--text1)", opacity: 0.55, marginBottom: 18 }}>Sign in to request joining this team</p>
            <Link to="/login" className="tm-btn-primary">Sign in →</Link>
          </div>
        )}

        {/* Team Chat */}
        {canChat && (
          <div className="tm-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 className="tm-section-title">Team Chat</h3>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text1)", opacity: 0.35 }}>
                {team.members?.length} member{team.members?.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="tm-chat-box">
              {loadingMsgs ? (
                <p style={{ textAlign: "center", color: "var(--text1)", opacity: 0.4, fontSize: 13, margin: "20px 0" }}>Loading messages…</p>
              ) : messages.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--text1)", opacity: 0.4, fontSize: 13, margin: "20px 0" }}>No messages yet — say hi! 👋</p>
              ) : (
                messages.map((m) => {
                  const isMine = m.senderId?._id === user?._id || m.senderId?._id?.toString() === user?._id?.toString() || m.senderId?.username === user?.username;
                  return (
                    <div key={m._id} style={{ display: "flex", gap: 8, flexDirection: isMine ? "row-reverse" : "row", alignItems: "flex-end" }}>
                      <Avatar name={m.senderId?.name} profileImage={m.senderId?.profileImage} size={24} />
                      <div style={{ maxWidth: "70%" }}>
                        {!isMine && <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text1)", opacity: 0.4, margin: "0 0 3px 4px" }}>{m.senderId?.name}</p>}
                        <div style={{
                          padding: "8px 12px",
                          background: isMine ? "var(--fg)" : "transparent",
                          color: isMine ? "var(--bg)" : "var(--text1)",
                          border: "1.5px solid var(--border)",
                          fontSize: 13,
                          lineHeight: 1.5,
                          wordBreak: "break-word",
                        }}>
                          {m.message}
                        </div>
                        <p style={{ fontSize: 10, color: "var(--text1)", opacity: 0.35, margin: "3px 0 0", textAlign: isMine ? "right" : "left" }}>
                          {m.createdAt ? formatDistanceToNow(new Date(m.createdAt), { addSuffix: true }) : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 8 }}>
              <input
                className="tm-chat-input"
                placeholder="Message your team…"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                maxLength={2000}
              />
              <button type="submit" disabled={sendingMsg || !msgText.trim()} className="tm-btn-primary" style={{ flexShrink: 0 }}>
                {sendingMsg ? "…" : "Send"}
              </button>
            </form>
          </div>
        )}

      </div>
    </>
  );
}