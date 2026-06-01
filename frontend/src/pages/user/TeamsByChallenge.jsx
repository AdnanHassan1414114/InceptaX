import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow, isPast } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";

/* ── Styles ──────────────────────────────────────────────────────── */
const css = `
  .tbc-root {
    --bg: #ffffff;
    --fg: #000000;
    --border: #000000;
    --text1: #000000;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .dark .tbc-root,
  [data-theme="dark"] .tbc-root {
    --bg: #000000;
    --fg: #ffffff;
    --border: #ffffff;
    --text1: #ffffff;
  }
  .tbc-root * { box-sizing: border-box; }

  /* Back link */
  .tbc-back {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--fg);
    text-decoration: none;
    opacity: 0.45;
    display: inline-block;
    margin-bottom: 24px;
  }
  .tbc-back:hover { opacity: 1; }

  /* Filter buttons */
  .tbc-filter-btn {
    height: 36px;
    padding: 0 16px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    border: 1.5px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    white-space: nowrap;
  }
  .tbc-filter-btn.active {
    background: var(--fg);
    color: var(--bg);
  }

  /* Badge */
  .tbc-badge {
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
  }

  /* Tag (roles) */
  .tbc-tag {
    display: inline-flex;
    align-items: center;
    height: 18px;
    padding: 0 7px;
    font-family: inherit;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text1);
    border: 1.5px solid var(--border);
    background: var(--bg);
    border-radius: 0;
    opacity: 0.55;
  }

  /* Card */
  .tbc-card {
    background: var(--bg);
    border: 1.5px solid var(--border);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Buttons */
  .tbc-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0 14px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-decoration: none;
    background: var(--fg);
    color: var(--bg);
    border: 1.5px solid var(--border);
    cursor: pointer;
    flex: 1;
    white-space: nowrap;
    transition: opacity 0.12s;
  }
  .tbc-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .tbc-btn-ghost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0 14px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-decoration: none;
    background: var(--bg);
    color: var(--fg);
    border: 1.5px solid var(--border);
    cursor: pointer;
    flex: 1;
    white-space: nowrap;
    transition: background 0.12s, color 0.12s;
  }
  .tbc-btn-ghost:hover:not(:disabled) { background: var(--fg); color: var(--bg); }
  .tbc-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Header action buttons (larger) */
  .tbc-hdr-btn-primary {
    display: inline-flex;
    align-items: center;
    height: 38px;
    padding: 0 20px;
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
  .tbc-hdr-btn-ghost {
    display: inline-flex;
    align-items: center;
    height: 38px;
    padding: 0 20px;
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
  .tbc-hdr-btn-ghost:hover { background: var(--fg); color: var(--bg); }

  /* Pagination */
  .tbc-page-btn {
    height: 36px;
    padding: 0 18px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: var(--bg);
    color: var(--fg);
    border: 1.5px solid var(--border);
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .tbc-page-btn:hover:not(:disabled) { background: var(--fg); color: var(--bg); }
  .tbc-page-btn:disabled { opacity: 0.2; cursor: not-allowed; }

  /* Skeleton */
  .tbc-skeleton {
    border: 1.5px solid var(--border);
    background: var(--fg);
    animation: tbc-pulse 1.4s ease-in-out infinite;
  }
  @keyframes tbc-pulse {
    0%, 100% { opacity: 0.06; }
    50% { opacity: 0.14; }
  }

  /* Modal backdrop */
  .tbc-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .tbc-modal {
    width: 100%;
    max-width: 420px;
    background: var(--bg);
    border: 1.5px solid var(--border);
    padding: 28px 24px;
  }
  .tbc-modal-input {
    width: 100%;
    height: 40px;
    padding: 0 14px;
    font-family: inherit;
    font-size: 13px;
    background: var(--bg);
    color: var(--fg);
    border: 1.5px solid var(--border);
    outline: none;
    margin-top: 6px;
  }
  .tbc-modal-input:focus { outline: 2px solid var(--fg); outline-offset: 1px; }
  .tbc-modal-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text1);
    opacity: 0.5;
  }
`;

/* ── Avatar ──────────────────────────────────────────────────────── */
const Avatar = ({ name, profileImage, size = 24 }) => (
  <img
    src={profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${name || "U"}&backgroundColor=111111&textColor=ffffff`}
    style={{ width: size, height: size, borderRadius: 0, border: "1.5px solid var(--border)", flexShrink: 0 }}
    alt={name || ""}
  />
);

/* ── Create Team Modal ───────────────────────────────────────────── */
function CreateTeamModal({ challengeId, onClose, onCreated }) {
  const [form, setForm] = useState({ teamName: "", maxMembers: 3 });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.teamName.trim()) { toast.error("Team name is required"); return; }
    setLoading(true);
    try {
      const res = await api.post("/teams", { teamName: form.teamName.trim(), challengeId, maxMembers: Number(form.maxMembers) });
      toast.success("Team created! 🎉");
      onCreated(res.data.data.team);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create team");
    } finally { setLoading(false); }
  };

  return (
    <div className="tbc-modal-backdrop" onClick={onClose}>
      <div className="tbc-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text1)", margin: 0, letterSpacing: "-0.02em" }}>Create a Team</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text1)", fontSize: 22, lineHeight: 1, padding: 0, opacity: 0.5 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="tbc-modal-label">Team Name *</label>
            <input className="tbc-modal-input" placeholder="e.g. ByteBuilders" value={form.teamName} onChange={(e) => setForm({ ...form, teamName: e.target.value })} maxLength={60} required />
          </div>
          <div>
            <label className="tbc-modal-label">Max Members (2–10)</label>
            <input className="tbc-modal-input" type="number" min={2} max={10} value={form.maxMembers} onChange={(e) => setForm({ ...form, maxMembers: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="submit" disabled={loading} className="tbc-hdr-btn-primary" style={{ flex: 1, justifyContent: "center", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Creating…" : "Create Team →"}
            </button>
            <button type="button" onClick={onClose} className="tbc-hdr-btn-ghost" style={{ flex: 0 }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────── */
export default function TeamsByChallenge() {
  const { id: challengeId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [challenge, setChallenge]       = useState(null);
  const [teams, setTeams]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [pagination, setPagination]     = useState({ totalPages: 1 });
  const [page, setPage]                 = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal]       = useState(false);
  const [joiningId, setJoiningId]       = useState(null);

  const isPremiumActive = user && user.plan !== "free" && user.planExpiresAt && new Date() < new Date(user.planExpiresAt);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 9 };
    if (statusFilter !== "all") params.status = statusFilter;
    Promise.all([
      api.get(`/assignments/${challengeId}`),
      api.get(`/teams/challenge/${challengeId}`, { params }),
    ])
      .then(([aRes, tRes]) => {
        setChallenge(aRes.data.data.assignment);
        setTeams(tRes.data.data.data || []);
        setPagination(tRes.data.data.pagination || { totalPages: 1 });
      })
      .catch((err) => setError(err.response?.data?.message || "Failed to load teams"))
      .finally(() => setLoading(false));
  }, [challengeId, page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRequestJoin = async (team) => {
    if (!user) { navigate("/login"); return; }
    setJoiningId(team._id);
    try {
      await api.post(`/teams/${team._id}/request`);
      toast.success("Join request sent!");
      setTeams((prev) => prev.map((t) => t._id === team._id ? { ...t, hasRequested: true } : t));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send request");
    } finally { setJoiningId(null); }
  };

  const handleCreated = (newTeam) => { setShowModal(false); navigate(`/team/${newTeam._id}`); };

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="tbc-root" style={{ maxWidth: 960, margin: "0 auto", padding: "48px 20px" }}>
        <div className="tbc-skeleton" style={{ height: 60, marginBottom: 20 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {Array(6).fill(0).map((_, i) => <div key={i} className="tbc-skeleton" style={{ height: 180 }} />)}
        </div>
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{css}</style>
      <div className="tbc-root" style={{ maxWidth: 960, margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <div style={{ border: "1.5px solid var(--border)", padding: 48 }}>
          <p style={{ color: "var(--text1)", opacity: 0.6, marginBottom: 20 }}>{error}</p>
          <Link to={`/challenges/${challengeId}`} className="tbc-hdr-btn-ghost">← Back to Challenge</Link>
        </div>
      </div>
    </>
  );

  const expired = challenge ? isPast(new Date(challenge.deadline)) : false;

  return (
    <>
      <style>{css}</style>
      <div className="tbc-root" style={{ maxWidth: 960, margin: "0 auto", padding: "48px 20px" }}>

        {/* Back */}
        <Link to={`/challenges/${challengeId}`} className="tbc-back">
          ← {challenge?.title || "Challenge"}
        </Link>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text1)", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Teams</h1>
            <p style={{ fontSize: 13, color: "var(--text1)", margin: 0, opacity: 0.5 }}>
              {pagination.total ?? teams.length} team{(pagination.total ?? teams.length) !== 1 ? "s" : ""} for{" "}
              <span style={{ opacity: 1, fontWeight: 600 }}>{challenge?.title}</span>
            </p>
          </div>
          <div>
            {user && !expired && (isPremiumActive ? (
              <button onClick={() => setShowModal(true)} className="tbc-hdr-btn-primary">+ Create Team</button>
            ) : (
              <Link to="/pricing" className="tbc-hdr-btn-ghost">✦ Upgrade to Create</Link>
            ))}
            {!user && <Link to="/login" className="tbc-hdr-btn-primary">Sign in →</Link>}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {["all", "Planning", "Building", "Completed"].map((val) => (
            <button
              key={val}
              className={`tbc-filter-btn${statusFilter === val ? " active" : ""}`}
              onClick={() => { setStatusFilter(val); setPage(1); }}
            >
              {val === "all" ? "All" : val}
            </button>
          ))}
        </div>

        {/* Grid */}
        {teams.length === 0 ? (
          <div style={{ border: "1.5px solid var(--border)", padding: "56px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text1)", opacity: 0.45, marginBottom: 20 }}>No teams yet for this challenge.</p>
            {user && isPremiumActive && !expired && (
              <button onClick={() => setShowModal(true)} className="tbc-hdr-btn-primary">+ Create the first team</button>
            )}
            {user && !isPremiumActive && !expired && (
              <Link to="/pricing" className="tbc-hdr-btn-ghost">✦ Upgrade to create a team</Link>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {teams.map((team) => {
                const isFull     = team.openSpots <= 0;
                const isJoining  = joiningId === team._id;
                const canRequest = user && !team.isMember && !team.isCreator && !team.hasRequested && !isFull && team.status !== "Completed" && !expired;

                return (
                  <div key={team._id} className="tbc-card">
                    {/* Badges */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
                      <span className="tbc-badge">{team.status}</span>
                      <div style={{ display: "flex", gap: 5 }}>
                        {isFull && <span className="tbc-badge">Full</span>}
                        {team.isCreator && <span className="tbc-badge">Your Team</span>}
                        {team.isMember && !team.isCreator && <span className="tbc-badge">Member</span>}
                      </div>
                    </div>

                    {/* Name + leader */}
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text1)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                        {team.teamName}
                      </h3>
                      <p style={{ fontSize: 11, color: "var(--text1)", opacity: 0.4, margin: 0 }}>
                        Led by @{team.createdBy?.username}
                      </p>
                    </div>

                    {/* Members */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {team.members?.slice(0, 4).map((m) => (
                          <Avatar key={m._id} name={m.name} profileImage={m.profileImage} size={22} />
                        ))}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text1)" }}>
                        {team.members?.length} / {team.maxMembers}
                      </span>
                      {!isFull && (
                        <span style={{ fontSize: 11, color: "var(--text1)", opacity: 0.4 }}>
                          · {team.openSpots} open
                        </span>
                      )}
                    </div>

                    {/* Required roles */}
                    {team.requiredRoles?.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {team.requiredRoles.map((role) => (
                          <span key={role} className="tbc-tag">{role}</span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                      <Link to={`/team/${team._id}`} className="tbc-btn-ghost">View Team</Link>
                      {canRequest && (
                        <button onClick={() => handleRequestJoin(team)} disabled={isJoining} className="tbc-btn-primary">
                          {isJoining ? "Sending…" : "Request →"}
                        </button>
                      )}
                      {user && team.hasRequested && !team.isMember && !team.isCreator && (
                        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "center", padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text1)", opacity: 0.4 }}>
                          Requested ✓
                        </span>
                      )}
                      {user && isFull && !team.isMember && !team.isCreator && !team.hasRequested && (
                        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "center", padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text1)", opacity: 0.4 }}>
                          Team Full
                        </span>
                      )}
                      {!user && <Link to="/login" className="tbc-btn-primary">Sign in</Link>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 32 }}>
                <button className="tbc-page-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
                <span style={{ height: 36, padding: "0 16px", display: "inline-flex", alignItems: "center", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: "var(--text1)", border: "1.5px solid var(--border)", opacity: 0.5 }}>
                  {page} / {pagination.totalPages}
                </span>
                <button className="tbc-page-btn" disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}

        {showModal && (
          <CreateTeamModal challengeId={challengeId} onClose={() => setShowModal(false)} onCreated={handleCreated} />
        )}
      </div>
    </>
  );
}