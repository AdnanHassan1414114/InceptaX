import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow, isPast } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";

// ─── Shared status styles (identical to TeamPage.jsx) ────────────────────────
const STATUS_STYLE = {
  Planning:  { color: "var(--blue)",    border: "rgba(96,165,250,0.3)",   bg: "rgba(96,165,250,0.06)"   },
  Building:  { color: "var(--emerald)", border: "rgba(74,222,128,0.3)",   bg: "rgba(74,222,128,0.06)"   },
  Completed: { color: "var(--text3)",   border: "var(--border)",          bg: "var(--bg3)"              },
};

const Avatar = ({ name, profileImage, size = 24, radius = 6 }) => (
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
    <span style={{ fontSize: 10, fontFamily: "monospace", color: s.color, border: `0.5px solid ${s.border}`, background: s.bg, padding: "2px 8px", borderRadius: 100 }}>
      {status}
    </span>
  );
};

// ─── Create Team Modal ────────────────────────────────────────────────────────
function CreateTeamModal({ challengeId, onClose, onCreated }) {
  const [form, setForm] = useState({ teamName: "", maxMembers: 3 });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.teamName.trim()) { toast.error("Team name is required"); return; }
    setLoading(true);
    try {
      const res = await api.post("/teams", {
        teamName:   form.teamName.trim(),
        challengeId,
        maxMembers: Number(form.maxMembers),
      });
      toast.success("Team created! 🎉");
      onCreated(res.data.data.team);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      {/* Modal card — stop propagation so clicking inside doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="ix-card"
        style={{ width: "100%", maxWidth: 420, padding: "28px 24px" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: "var(--text1)", margin: 0 }}>
            Create a Team
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontSize: 20, lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="ix-label">Team Name *</label>
            <input
              className="ix-input"
              placeholder="e.g. ByteBuilders"
              value={form.teamName}
              onChange={(e) => setForm({ ...form, teamName: e.target.value })}
              maxLength={60}
              required
            />
          </div>

          <div>
            <label className="ix-label">Max Members (2–10)</label>
            <input
              className="ix-input"
              type="number"
              min={2}
              max={10}
              value={form.maxMembers}
              onChange={(e) => setForm({ ...form, maxMembers: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ flex: 1, padding: "10px", fontSize: 13, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Creating…" : "Create Team →"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
              style={{ padding: "10px 16px", fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TeamsByChallenge() {
  const { id: challengeId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [challenge, setChallenge]   = useState(null);
  const [teams, setTeams]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [pagination, setPagination] = useState({ totalPages: 1 });
  const [page, setPage]             = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal]   = useState(false);

  // Per-card join request loading state: { [teamId]: bool }
  const [joiningId, setJoiningId]   = useState(null);

  // ── Premium check (same formula as every other page) ──────────────────────
  const isPremiumActive = user &&
    user.plan !== "free" &&
    user.planExpiresAt &&
    new Date() < new Date(user.planExpiresAt);

  // ── Fetch challenge + teams ───────────────────────────────────────────────
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

  // ── Join request ──────────────────────────────────────────────────────────
  const handleRequestJoin = async (team) => {
    if (!user) { navigate("/login"); return; }
    setJoiningId(team._id);
    try {
      await api.post(`/teams/${team._id}/request`);
      toast.success("Join request sent!");
      // Optimistically mark hasRequested
      setTeams((prev) =>
        prev.map((t) => t._id === team._id ? { ...t, hasRequested: true } : t)
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send request");
    } finally {
      setJoiningId(null);
    }
  };

  // ── On team created via modal ─────────────────────────────────────────────
  const handleCreated = (newTeam) => {
    setShowModal(false);
    navigate(`/team/${newTeam._id}`);
  };

  // ── Filter buttons ────────────────────────────────────────────────────────
  const FilterBtn = ({ value, label }) => (
    <button
      onClick={() => { setStatusFilter(value); setPage(1); }}
      style={{
        padding: "6px 14px",
        borderRadius: 8,
        fontSize: 12,
        border: `0.5px solid ${statusFilter === value ? "var(--border2)" : "var(--border)"}`,
        background: statusFilter === value ? "var(--bg3)" : "var(--bg2)",
        color: statusFilter === value ? "var(--text1)" : "var(--text2)",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px" }}>
        <div className="skeleton" style={{ height: 56, borderRadius: 14, marginBottom: 20 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    );

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error)
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
        <div className="ix-card" style={{ padding: 40 }}>
          <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
          <Link to={`/challenges/${challengeId}`} className="btn-ghost">← Back to Challenge</Link>
        </div>
      </div>
    );

  const expired = challenge ? isPast(new Date(challenge.deadline)) : false;

  return (
    <div className="page-enter" style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px" }}>

      {/* ── Back link ────────────────────────────────────────────────────────── */}
      <Link
        to={`/challenges/${challengeId}`}
        style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}
      >
        ← {challenge?.title || "Challenge"}
      </Link>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--text1)", margin: "0 0 4px", letterSpacing: "-0.4px" }}>
            Teams
          </h1>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>
            {pagination.total ?? teams.length} team{(pagination.total ?? teams.length) !== 1 ? "s" : ""} for{" "}
            <span style={{ color: "var(--text1)" }}>{challenge?.title}</span>
          </p>
        </div>

        {/* Create Team button — premium only, challenge not expired */}
        {user && !expired && (
          isPremiumActive ? (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary"
              style={{ fontSize: 13 }}
            >
              + Create Team
            </button>
          ) : (
            <Link to="/pricing" className="btn-ghost" style={{ fontSize: 13 }}>
              ✦ Upgrade to Create Team
            </Link>
          )
        )}
        {!user && (
          <Link to="/login" className="btn-primary" style={{ fontSize: 13 }}>
            Sign in →
          </Link>
        )}
      </div>

      {/* ── Status filter bar ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        <FilterBtn value="all"       label="All"       />
        <FilterBtn value="Planning"  label="Planning"  />
        <FilterBtn value="Building"  label="Building"  />
        <FilterBtn value="Completed" label="Completed" />
      </div>

      {/* ── Teams grid ───────────────────────────────────────────────────────── */}
      {teams.length === 0 ? (
        <div className="ix-card" style={{ padding: "56px 24px", textAlign: "center" }}>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 16 }}>
            No teams yet for this challenge.
          </p>
          {user && isPremiumActive && !expired && (
            <button onClick={() => setShowModal(true)} className="btn-primary" style={{ fontSize: 13 }}>
              + Create the first team
            </button>
          )}
          {user && !isPremiumActive && !expired && (
            <Link to="/pricing" className="btn-ghost" style={{ fontSize: 13 }}>
              ✦ Upgrade to create a team
            </Link>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(265px,1fr))", gap: 10 }}>
            {teams.map((team) => {
              const isFull       = team.openSpots <= 0;
              const isJoining    = joiningId === team._id;
              const canRequest   = user && !team.isMember && !team.isCreator &&
                                   !team.hasRequested && !isFull &&
                                   team.status !== "Completed" && !expired;

              return (
                <div
                  key={team._id}
                  className="ix-card"
                  style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {/* Card top: status + full badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <StatusBadge status={team.status} />
                    {isFull && (
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text3)", border: "0.5px solid var(--border)", padding: "2px 8px", borderRadius: 100 }}>
                        Full
                      </span>
                    )}
                    {team.isCreator && (
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--amber)", border: "0.5px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)", padding: "2px 8px", borderRadius: 100 }}>
                        Your Team
                      </span>
                    )}
                    {team.isMember && !team.isCreator && (
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--emerald)", border: "0.5px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.06)", padding: "2px 8px", borderRadius: 100 }}>
                        Member
                      </span>
                    )}
                  </div>

                  {/* Team name */}
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", margin: "0 0 4px" }}>
                      {team.teamName}
                    </h3>
                    <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)", margin: 0 }}>
                      Led by @{team.createdBy?.username}
                    </p>
                  </div>

                  {/* Members row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Stacked avatars */}
                    <div style={{ display: "flex" }}>
                      {team.members?.slice(0, 4).map((m, i) => (
                        <Avatar
                          key={m._id}
                          name={m.name}
                          profileImage={m.profileImage}
                          size={24}
                          radius={6}
                          style={{ marginLeft: i > 0 ? -6 : 0 }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)" }}>
                      {team.members?.length} / {team.maxMembers}
                    </span>
                    {!isFull && (
                      <span style={{ fontSize: 11, color: "var(--emerald)" }}>
                        · {team.openSpots} open
                      </span>
                    )}
                  </div>

                  {/* Required roles */}
                  {team.requiredRoles?.length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {team.requiredRoles.map((role) => (
                        <span
                          key={role}
                          style={{ fontSize: 10, fontFamily: "monospace", color: "var(--violet)", border: "0.5px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.06)", padding: "2px 7px", borderRadius: 100 }}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                    <Link
                      to={`/team/${team._id}`}
                      className="btn-ghost"
                      style={{ fontSize: 12, flex: 1, textAlign: "center" }}
                    >
                      View Team
                    </Link>

                    {/* Request to Join */}
                    {canRequest && (
                      <button
                        onClick={() => handleRequestJoin(team)}
                        disabled={isJoining}
                        className="btn-primary"
                        style={{ fontSize: 12, flex: 1, opacity: isJoining ? 0.6 : 1 }}
                      >
                        {isJoining ? "Sending…" : "Request to Join"}
                      </button>
                    )}

                    {/* Already requested */}
                    {user && team.hasRequested && !team.isMember && !team.isCreator && (
                      <span
                        style={{ fontSize: 12, flex: 1, textAlign: "center", padding: "8px 0", fontFamily: "monospace", color: "var(--text3)" }}
                      >
                        Requested ✓
                      </span>
                    )}

                    {/* Full message */}
                    {user && isFull && !team.isMember && !team.isCreator && (
                      <span
                        style={{ fontSize: 12, flex: 1, textAlign: "center", padding: "8px 0", fontFamily: "monospace", color: "var(--text3)" }}
                      >
                        Team Full
                      </span>
                    )}

                    {/* Not logged in */}
                    {!user && (
                      <Link
                        to="/login"
                        className="btn-primary"
                        style={{ fontSize: 12, flex: 1, textAlign: "center" }}
                      >
                        Sign in
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Pagination ─────────────────────────────────────────────────── */}
          {pagination.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 28 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-ghost"
                style={{ fontSize: 12, opacity: page === 1 ? 0.3 : 1 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)" }}>
                {page} / {pagination.totalPages}
              </span>
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-ghost"
                style={{ fontSize: 12, opacity: page === pagination.totalPages ? 0.3 : 1 }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Create Team Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <CreateTeamModal
          challengeId={challengeId}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}