import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  Planning:  { color: "var(--blue)",    border: "rgba(96,165,250,0.3)",   bg: "rgba(96,165,250,0.06)"   },
  Building:  { color: "var(--emerald)", border: "rgba(74,222,128,0.3)",   bg: "rgba(74,222,128,0.06)"   },
  Completed: { color: "var(--text3)",   border: "var(--border)",          bg: "var(--bg3)"              },
};

// Forward-only status transitions
const STATUS_NEXT = {
  Planning:  "Building",
  Building:  "Completed",
  Completed: null,
};

// ─── Small reusable pieces ────────────────────────────────────────────────────

const Avatar = ({ name, profileImage, size = 28, radius = 8 }) => (
  <img
    src={
      profileImage ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${name || "U"}&backgroundColor=111111&textColor=ffffff`
    }
    style={{ width: size, height: size, borderRadius: radius, flexShrink: 0 }}
    alt={name || ""}
  />
);

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Planning;
  return (
    <span style={{ fontSize: 10, fontFamily: "monospace", color: s.color, border: `0.5px solid ${s.border}`, background: s.bg, padding: "2px 10px", borderRadius: 100 }}>
      {status}
    </span>
  );
};

// Section wrapper — same pattern as SubmissionDetail.jsx
const Section = ({ title, children, action }) => (
  <div className="ix-card" style={{ padding: "20px", marginBottom: 12 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", margin: 0 }}>{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Team() {
  const { teamId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  // Per-action loading states
  const [requesting, setRequesting]     = useState(false);
  const [leaving, setLeaving]           = useState(false);
  const [removingId, setRemovingId]     = useState(null);
  const [respondingId, setRespondingId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false); // 🔹 NEW

  // Chat state
  const [messages, setMessages]       = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgText, setMsgText]         = useState("");
  const [sendingMsg, setSendingMsg]   = useState(false);
  const chatBottomRef                 = useRef(null);

  // ── Fetch team ──────────────────────────────────────────────────────────────
  const fetchTeam = useCallback(() => {
    setLoading(true);
    api
      .get(`/teams/${teamId}`)
      .then((res) => setTeam(res.data.data.team))
      .catch((err) => setError(err.response?.data?.message || "Failed to load team"))
      .finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  // ── Fetch chat messages (members only) ──────────────────────────────────────
  useEffect(() => {
    if (!team || !user) return;
    if (!team.isMember && !team.isCreator) return;

    setLoadingMsgs(true);
    api
      .get(`/teams/${teamId}/chat`, { params: { limit: 50 } })
      .then((res) => setMessages(res.data.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  }, [team?.isMember, team?.isCreator, teamId, user]);

  // ── Auto-scroll chat ────────────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleRequestJoin = async () => {
    setRequesting(true);
    try {
      await api.post(`/teams/${teamId}/request`);
      toast.success("Join request sent!");
      setTeam((prev) => ({ ...prev, hasRequested: true }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send request");
    } finally {
      setRequesting(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Are you sure you want to leave this team?")) return;
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
    if (!window.confirm(`Remove ${memberName} from the team?`)) return;
    setRemovingId(memberId);
    try {
      const res = await api.delete(`/teams/${teamId}/members/${memberId}`);
      toast.success("Member removed");
      setTeam((prev) => ({ ...prev, ...res.data.data.team }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  const handleRespond = async (requestUserId, action) => {
    setRespondingId(requestUserId);
    try {
      const res = await api.patch(`/teams/${teamId}/requests/${requestUserId}`, { action });
      toast.success(action === "accept" ? "Member accepted!" : "Request rejected");

      if (action === "accept" && res.data.data?.team) {
        setTeam((prev) => ({
          ...prev,
          members:  res.data.data.team.members,
          status:   res.data.data.team.status,
          openSpots: res.data.data.team.maxMembers - res.data.data.team.members.length,
          joinRequests: (prev.joinRequests || []).filter((r) => r.userId?._id !== requestUserId),
        }));
      } else {
        setTeam((prev) => ({
          ...prev,
          joinRequests: (prev.joinRequests || []).filter((r) => r.userId?._id !== requestUserId),
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    } finally {
      setRespondingId(null);
    }
  };

  // 🔹 NEW — advance team status (Planning → Building → Completed)
  const handleStatusAdvance = async () => {
    const nextStatus = STATUS_NEXT[team.status];
    if (!nextStatus) return;
    if (!window.confirm(`Move team status to "${nextStatus}"? This cannot be undone.`)) return;

    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/teams/${teamId}/status`, { status: nextStatus });
      toast.success(`Status updated to ${nextStatus}`);
      setTeam((prev) => ({ ...prev, status: res.data.data.team.status }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
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
    } finally {
      setSendingMsg(false);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading)
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px" }}>
        <div className="skeleton" style={{ height: 200, borderRadius: 14, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 14, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 140, borderRadius: 14 }} />
      </div>
    );

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error)
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
        <div className="ix-card" style={{ padding: 40 }}>
          <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
          <Link to="/challenges" className="btn-ghost">← Back to Challenges</Link>
        </div>
      </div>
    );

  if (!team) return null;

  const { isCreator, isMember, hasRequested, openSpots } = team;
  const isFull      = openSpots <= 0;
  const canChat     = isMember || isCreator;
  const challengeId = team.challengeId?._id;
  const nextStatus  = STATUS_NEXT[team.status]; // 🔹 null when Completed

  return (
    <div className="page-enter" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px" }}>

      {/* ── Breadcrumb ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <Link
          to={`/challenges/${challengeId}`}
          style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none" }}
        >
          ← {team.challengeId?.title || "Challenge"}
        </Link>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>/</span>
        <Link
          to={`/challenges/${challengeId}/teams`}
          style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none" }}
        >
          Teams
        </Link>
      </div>

      {/* ── Header card ──────────────────────────────────────────────────────── */}
      <div className="ix-card" style={{ padding: "24px", marginBottom: 12 }}>

        {/* Top row: badges + action buttons */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge status={team.status} />
            {isFull && (
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text3)", border: "0.5px solid var(--border)", padding: "2px 8px", borderRadius: 100 }}>
                Full
              </span>
            )}
            {team.status === "Completed" && (
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--emerald)", border: "0.5px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.06)", padding: "2px 8px", borderRadius: 100 }}>
                ✓ Completed
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            {/* 🔹 NEW — Status advance button (creator only, not yet Completed) */}
            {isCreator && nextStatus && (
              <button
                onClick={handleStatusAdvance}
                disabled={updatingStatus}
                className="btn-ghost"
                style={{ fontSize: 12, opacity: updatingStatus ? 0.6 : 1 }}
              >
                {updatingStatus ? "Updating…" : `Mark as ${nextStatus} →`}
              </button>
            )}

            {/* Request to Join (non-member, open, not completed) */}
            {!isMember && !isCreator && team.status !== "Completed" && !isFull && (
              <button
                onClick={handleRequestJoin}
                disabled={requesting || hasRequested}
                className={hasRequested ? "btn-ghost" : "btn-primary"}
                style={{ fontSize: 12, opacity: requesting ? 0.6 : 1 }}
              >
                {requesting ? "Sending…" : hasRequested ? "Request Sent ✓" : "Request to Join →"}
              </button>
            )}

            {/* Leave Team (member, not creator) */}
            {isMember && !isCreator && (
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="btn-ghost"
                style={{ fontSize: 12, color: "var(--red)", borderColor: "rgba(248,113,113,0.3)", opacity: leaving ? 0.6 : 1 }}
              >
                {leaving ? "Leaving…" : "Leave Team"}
              </button>
            )}
          </div>
        </div>

        {/* Team name */}
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--text1)", margin: "0 0 6px", letterSpacing: "-0.4px" }}>
          {team.teamName}
        </h1>

        <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 20px" }}>
          For{" "}
          <Link to={`/challenges/${challengeId}`} style={{ color: "var(--text1)", textDecoration: "underline" }}>
            {team.challengeId?.title}
          </Link>
        </p>

        {/* Meta grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 16, paddingTop: 18, borderTop: "0.5px solid var(--border)" }}>
          {/* Members count */}
          <div>
            <p style={{ fontSize: 11, color: "var(--text3)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Members</p>
            <p style={{ fontSize: 13, color: "var(--text1)", margin: 0 }}>
              {team.members?.length} / {team.maxMembers}
              {!isFull && (
                <span style={{ color: "var(--emerald)", marginLeft: 6, fontSize: 11 }}>{openSpots} open</span>
              )}
            </p>
          </div>

          {/* Challenge deadline */}
          {team.challengeId?.deadline && (
            <div>
              <p style={{ fontSize: 11, color: "var(--text3)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Challenge Deadline</p>
              <p style={{ fontSize: 13, color: "var(--text1)", margin: 0 }}>
                {formatDistanceToNow(new Date(team.challengeId.deadline), { addSuffix: true })}
              </p>
            </div>
          )}

          {/* Required roles */}
          {team.requiredRoles?.length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: "var(--text3)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Looking for</p>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {team.requiredRoles.map((role) => (
                  <span key={role} style={{ fontSize: 11, fontFamily: "monospace", color: "var(--violet)", border: "0.5px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.06)", padding: "2px 8px", borderRadius: 100 }}>
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Members card ─────────────────────────────────────────────────────── */}
      <Section
        title={`Members (${team.members?.length})`}
        action={
          isCreator ? (
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)" }}>
              You are the leader
            </span>
          ) : null
        }
      >
        {team.members?.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text2)" }}>No members yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {team.members.map((member, i) => {
              const isLeader   = member._id?.toString() === team.createdBy?._id?.toString();
              const isRemoving = removingId === member._id;
              const isSelf     = member._id?.toString() === user?._id?.toString();

              return (
                <div
                  key={member._id}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i > 0 ? "0.5px solid var(--border)" : "none" }}
                >
                  <Avatar name={member.name} profileImage={member.profileImage} size={32} radius={9} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      to={`/u/${member.username}`}
                      style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {member.name}
                    </Link>
                    <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)", margin: 0 }}>
                      @{member.username}
                      {isLeader && <span style={{ color: "var(--amber)", marginLeft: 6 }}>· Leader</span>}
                    </p>
                  </div>

                  {/* Creator removes non-leader members */}
                  {isCreator && !isLeader && (
                    <button
                      onClick={() => handleRemoveMember(member._id, member.name)}
                      disabled={isRemoving}
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "4px 10px", color: "var(--red)", borderColor: "rgba(248,113,113,0.25)", opacity: isRemoving ? 0.5 : 1, flexShrink: 0 }}
                    >
                      {isRemoving ? "…" : "Remove"}
                    </button>
                  )}

                  {/* Self-leave from member row */}
                  {!isCreator && isMember && isSelf && (
                    <button
                      onClick={handleLeave}
                      disabled={leaving}
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "4px 10px", color: "var(--red)", borderColor: "rgba(248,113,113,0.25)", opacity: leaving ? 0.5 : 1, flexShrink: 0 }}
                    >
                      {leaving ? "…" : "Leave"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Join Requests (creator only) ─────────────────────────────────────── */}
      {isCreator && (
        <Section title={`Join Requests${team.joinRequests?.length ? ` (${team.joinRequests.length})` : ""}`}>
          {!team.joinRequests || team.joinRequests.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text2)" }}>No pending requests.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {team.joinRequests.map((req, i) => {
                const u = req.userId;
                const isResponding = respondingId === u?._id;

                return (
                  <div
                    key={req._id || u?._id}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i > 0 ? "0.5px solid var(--border)" : "none" }}
                  >
                    <Avatar name={u?.name} profileImage={u?.profileImage} size={32} radius={9} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        to={`/u/${u?.username}`}
                        style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {u?.name}
                      </Link>
                      <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)", margin: 0 }}>
                        @{u?.username} ·{" "}
                        {req.requestedAt
                          ? formatDistanceToNow(new Date(req.requestedAt), { addSuffix: true })
                          : ""}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0, opacity: isResponding ? 0.5 : 1 }}>
                      <button
                        onClick={() => handleRespond(u?._id, "accept")}
                        disabled={isResponding || isFull}
                        className="btn-primary"
                        style={{ fontSize: 11, padding: "5px 12px", opacity: isFull ? 0.4 : 1 }}
                        title={isFull ? "Team is full" : "Accept"}
                      >
                        {isResponding ? "…" : "Accept"}
                      </button>
                      <button
                        onClick={() => handleRespond(u?._id, "reject")}
                        disabled={isResponding}
                        className="btn-ghost"
                        style={{ fontSize: 11, padding: "5px 12px", color: "var(--red)", borderColor: "rgba(248,113,113,0.25)" }}
                      >
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

      {/* ── Sign in prompt (unauthenticated) ─────────────────────────────────── */}
      {!user && (
        <div className="ix-card" style={{ padding: "24px", textAlign: "center", borderColor: "var(--border2)", marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>
            Sign in to request joining this team
          </p>
          <Link to="/login" className="btn-primary" style={{ fontSize: 13 }}>
            Sign in →
          </Link>
        </div>
      )}

      {/* ── Team Chat (members only) ──────────────────────────────────────────── */}
      {canChat && (
        <div className="ix-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", margin: 0 }}>
              Team Chat
            </h3>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)" }}>
              {team.members?.length} member{team.members?.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Messages */}
          <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10, padding: "12px", background: "var(--bg3)", borderRadius: 10, border: "0.5px solid var(--border)" }}>
            {loadingMsgs ? (
              <p style={{ textAlign: "center", color: "var(--text2)", fontSize: 13, margin: "20px 0" }}>Loading messages…</p>
            ) : messages.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text2)", fontSize: 13, margin: "20px 0" }}>No messages yet — say hi! 👋</p>
            ) : (
              messages.map((m) => {
                const isMine =
                  m.senderId?._id === user?._id ||
                  m.senderId?._id?.toString() === user?._id?.toString() ||
                  m.senderId?.username === user?.username;

                return (
                  <div key={m._id} style={{ display: "flex", gap: 8, flexDirection: isMine ? "row-reverse" : "row", alignItems: "flex-end" }}>
                    <Avatar name={m.senderId?.name} profileImage={m.senderId?.profileImage} size={26} radius={7} />
                    <div style={{ maxWidth: "70%" }}>
                      {!isMine && (
                        <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text3)", margin: "0 0 3px", paddingLeft: 4 }}>
                          {m.senderId?.name}
                        </p>
                      )}
                      <div style={{ padding: "8px 12px", borderRadius: 10, background: isMine ? "var(--btn-primary-bg)" : "var(--bg2)", color: isMine ? "var(--btn-primary-fg)" : "var(--text1)", border: isMine ? "none" : "0.5px solid var(--border2)", fontSize: 13, lineHeight: 1.5, wordBreak: "break-word" }}>
                        {m.message}
                      </div>
                      <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text3)", margin: "3px 0 0", textAlign: isMine ? "right" : "left", paddingLeft: isMine ? 0 : 4, paddingRight: isMine ? 4 : 0 }}>
                        {m.createdAt ? formatDistanceToNow(new Date(m.createdAt), { addSuffix: true }) : ""}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 8 }}>
            <input
              className="ix-input"
              style={{ flex: 1 }}
              placeholder="Message your team…"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={sendingMsg || !msgText.trim()}
              className="btn-primary"
              style={{ padding: "9px 16px", fontSize: 13, opacity: sendingMsg || !msgText.trim() ? 0.5 : 1, flexShrink: 0 }}
            >
              {sendingMsg ? "…" : "Send"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}