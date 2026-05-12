import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_BADGE = {
  free:    { label: "Free",   color: "var(--text3)",  border: "var(--border)" },
  ten_day: { label: "Sprint", color: "var(--cyan)",   border: "rgba(34,211,238,0.3)" },
  monthly: { label: "Pro ✦",  color: "var(--amber)",  border: "rgba(251,191,36,0.3)" },
};

const STATUS_MAP = {
  pending:        { label: "Pending",   color: "var(--text3)"   },
  ai_evaluated:   { label: "AI Done",   color: "var(--amber)"   },
  admin_reviewed: { label: "In Review", color: "var(--blue)"    },
  published:      { label: "Published", color: "var(--emerald)" },
  rejected:       { label: "Rejected",  color: "var(--red)"     },
};

// 🔹 NEW — team status colours (matches TeamPage.jsx)
const TEAM_STATUS_STYLE = {
  Planning:  { color: "var(--blue)",    border: "rgba(96,165,250,0.3)"  },
  Building:  { color: "var(--emerald)", border: "rgba(74,222,128,0.3)"  },
  Completed: { color: "var(--text3)",   border: "var(--border)"         },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// 🔹 NEW — ensure URL has a protocol before opening in a new tab
function sanitiseUrl(raw = "") {
  const val = raw.trim();
  if (!val) return "";
  return /^https?:\/\//i.test(val) ? val : `https://${val}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Profile() {
  const { username } = useParams();
  const { user: me, updateUserProfile } = useAuth();

  const [profile, setProfile]         = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats]             = useState(null);   // 🔹 NEW
  const [teams, setTeams]             = useState([]);     // 🔹 NEW
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // Edit state
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", bio: "", githubUsername: "",
    socialLinks: { twitter: "", linkedin: "", website: "" }, // 🔹 NEW
  });
  const [skillInput, setSkillInput] = useState(""); // 🔹 NEW

  const isOwn = me?.username === username;

  // ── Initial fetch: profile + submissions + stats in parallel ─────────────────
  useEffect(() => {
    setLoading(true);
    setStats(null);
    setTeams([]);

    Promise.all([
      api.get(`/users/${username}`),
      api.get(`/users/${username}/submissions`, { params: { limit: 20 } }),
      api.get(`/users/${username}/stats`), // 🔹 NEW
    ])
      .then(([uRes, sRes, stRes]) => {
        const u = uRes.data.data.user;
        setProfile(u);
        setEditForm({
          name:           u.name           || "",
          bio:            u.bio            || "",
          githubUsername: u.githubUsername || "",
          socialLinks: {
            twitter:  u.socialLinks?.twitter  || "",
            linkedin: u.socialLinks?.linkedin || "",
            website:  u.socialLinks?.website  || "",
          },
        });
        setSubmissions(sRes.data.data.data || []);
        setStats(stRes.data.data);
      })
      .catch((err) => setError(err.response?.data?.message || "User not found"))
      .finally(() => setLoading(false));
  }, [username]);

  // 🔹 NEW — fetch teams this user belongs to across their submission challenges
  useEffect(() => {
    if (!profile || submissions.length === 0) return;

    const challengeIds = [
      ...new Set(submissions.map((s) => s.assignmentId?._id).filter(Boolean)),
    ];
    if (challengeIds.length === 0) return;

    Promise.allSettled(
      challengeIds.slice(0, 5).map((cid) =>
        api.get(`/teams/challenge/${cid}`, { params: { limit: 10 } })
      )
    ).then((results) => {
      const myTeams = [];
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        const list = r.value.data.data.data || [];
        list.forEach((t) => {
          const isMember = t.members?.some(
            (m) => m._id?.toString() === profile._id?.toString()
          );
          if (isMember && !myTeams.find((x) => x._id === t._id)) {
            myTeams.push(t);
          }
        });
      });
      setTeams(myTeams);
    });
  }, [profile, submissions]);

  // ── Save handler ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateUserProfile({
        name:           editForm.name,
        bio:            editForm.bio,
        githubUsername: editForm.githubUsername,
        skills:         profile.skills || [], // already updated via tag actions
        socialLinks: {
          twitter:  sanitiseUrl(editForm.socialLinks.twitter),
          linkedin: sanitiseUrl(editForm.socialLinks.linkedin),
          website:  sanitiseUrl(editForm.socialLinks.website),
        },
      });
      setProfile(updated);
      setEditing(false);
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  // 🔹 NEW — skill tag actions
  const handleAddSkill = () => {
    const val = skillInput.trim();
    if (!val) return;
    if ((profile.skills || []).length >= 15) { toast.error("Max 15 skills"); return; }
    if ((profile.skills || []).includes(val)) { setSkillInput(""); return; }
    setProfile((p) => ({ ...p, skills: [...(p.skills || []), val] }));
    setSkillInput("");
  };

  const handleRemoveSkill = (skill) =>
    setProfile((p) => ({ ...p, skills: (p.skills || []).filter((s) => s !== skill) }));

  // ── Skeleton ──────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px" }}>
        <div className="skeleton" style={{ height: 210, borderRadius: 14, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 80,  borderRadius: 14, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
      </div>
    );

  if (error)
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
        <div className="ix-card" style={{ padding: 40 }}>
          <p style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>
          <Link to="/" className="btn-ghost">← Home</Link>
        </div>
      </div>
    );

  if (!profile) return null;

  const avatar    = profile.profileImage ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${profile.name}&backgroundColor=111111&textColor=ffffff`;
  const planBadge = PLAN_BADGE[profile.plan] || PLAN_BADGE.free;
  const published = submissions.filter((s) => s.status === "published");

  return (
    <div className="page-enter" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px" }}>

      {/* ── Header card ──────────────────────────────────────────────────────── */}
      <div className="ix-card" style={{ padding: "22px", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          <img
            src={avatar}
            style={{ width: 60, height: 60, borderRadius: 16, flexShrink: 0, border: "0.5px solid var(--border2)" }}
            alt={profile.name}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name + plan badge + edit button */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                {editing ? (
                  <input
                    className="ix-input"
                    style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                ) : (
                  <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--text1)", margin: "0 0 3px", letterSpacing: "-0.3px" }}>
                    {profile.name}
                  </h1>
                )}
                <p style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", margin: 0 }}>
                  @{profile.username}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: planBadge.color, border: `0.5px solid ${planBadge.border}`, padding: "2px 10px", borderRadius: 100 }}>
                  {planBadge.label}
                </span>
                {isOwn && (
                  editing ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 12, padding: "6px 14px" }}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditing(false)} className="btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEditing(true)} className="btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>
                      Edit Profile
                    </button>
                  )
                )}
              </div>
            </div>

            {/* ── Edit mode ── */}
            {editing ? (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>

                <div>
                  <label className="ix-label">Bio</label>
                  <textarea
                    className="ix-input"
                    style={{ resize: "none" }}
                    rows={2}
                    maxLength={300}
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    placeholder="Tell us about yourself…"
                  />
                  <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, textAlign: "right" }}>
                    {editForm.bio.length}/300
                  </p>
                </div>

                <div>
                  <label className="ix-label">GitHub Username</label>
                  <input
                    className="ix-input"
                    value={editForm.githubUsername}
                    onChange={(e) => setEditForm({ ...editForm, githubUsername: e.target.value })}
                    placeholder="yourusername"
                  />
                </div>

                {/* 🔹 NEW — Social links */}
                {[
                  { key: "twitter",  label: "Twitter / X",       placeholder: "https://twitter.com/yourhandle"      },
                  { key: "linkedin", label: "LinkedIn",           placeholder: "https://linkedin.com/in/yourprofile" },
                  { key: "website",  label: "Website / Portfolio",placeholder: "https://yourwebsite.com"            },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="ix-label">{label}</label>
                    <input
                      className="ix-input"
                      value={editForm.socialLinks[key]}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          socialLinks: { ...editForm.socialLinks, [key]: e.target.value },
                        })
                      }
                      placeholder={placeholder}
                    />
                  </div>
                ))}

                {/* 🔹 NEW — Skills editor */}
                <div>
                  <label className="ix-label">Skills (max 15)</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="ix-input"
                      placeholder="e.g. React, Node.js…"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSkill(); } }}
                    />
                    <button type="button" onClick={handleAddSkill} className="btn-ghost" style={{ fontSize: 12, flexShrink: 0 }}>
                      Add
                    </button>
                  </div>
                  {(profile.skills || []).length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {profile.skills.map((skill) => (
                        <span
                          key={skill}
                          style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text2)", border: "0.5px solid var(--border2)", background: "var(--bg3)", padding: "3px 10px", borderRadius: 100, display: "flex", alignItems: "center", gap: 6 }}
                        >
                          {skill}
                          <button
                            onClick={() => handleRemoveSkill(skill)}
                            style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            ) : (
              /* ── View mode ── */
              <div style={{ marginTop: 10 }}>
                {profile.bio && (
                  <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 10px", lineHeight: 1.6 }}>
                    {profile.bio}
                  </p>
                )}

                {/* Social links row */}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: (profile.skills || []).length > 0 ? 10 : 0 }}>
                  {profile.githubUsername && (
                    <a href={`https://github.com/${profile.githubUsername}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none" }}>
                      GitHub: @{profile.githubUsername}
                    </a>
                  )}
                  {/* 🔹 NEW */}
                  {profile.socialLinks?.twitter && (
                    <a href={sanitiseUrl(profile.socialLinks.twitter)} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none" }}>
                      Twitter →
                    </a>
                  )}
                  {profile.socialLinks?.linkedin && (
                    <a href={sanitiseUrl(profile.socialLinks.linkedin)} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none" }}>
                      LinkedIn →
                    </a>
                  )}
                  {profile.socialLinks?.website && (
                    <a href={sanitiseUrl(profile.socialLinks.website)} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none" }}>
                      Website →
                    </a>
                  )}
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text3)" }}>
                    Joined {format(new Date(profile.createdAt), "MMM yyyy")}
                  </span>
                </div>

                {/* 🔹 NEW — Skills tags */}
                {(profile.skills || []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {profile.skills.map((skill) => (
                      <span
                        key={skill}
                        style={{ fontSize: 11, fontFamily: "monospace", color: "var(--cyan)", border: "0.5px solid rgba(34,211,238,0.25)", background: "rgba(34,211,238,0.06)", padding: "2px 10px", borderRadius: 100 }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Stats row — 🔹 UPDATED with Global Rank + Total Score ────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(80px,1fr))",
            gap: 0,
            marginTop: 20,
            paddingTop: 20,
            borderTop: "0.5px solid var(--border)",
          }}
        >
          {[
            { label: "Global Rank",  value: stats?.globalRank ? `#${stats.globalRank}` : "—" },
            { label: "Total Score",  value: stats?.totalScore  ?? "—" },
            { label: "Best Score",   value: stats?.bestScore   || "—" },
            { label: "Published",    value: published.length },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.5px" }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 🔹 NEW — Teams section ──────────────────────────────────────────────── */}
      {teams.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", margin: "0 0 12px", letterSpacing: "-0.2px" }}>
            Teams
          </h2>
          <div className="ix-card" style={{ overflow: "hidden", marginBottom: 12 }}>
            {teams.map((t, i) => {
              const ts = TEAM_STATUS_STYLE[t.status] || TEAM_STATUS_STYLE.Planning;
              return (
                <Link
                  key={t._id}
                  to={`/team/${t._id}`}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderTop: i > 0 ? "0.5px solid var(--border)" : "none", textDecoration: "none", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.teamName}
                      </span>
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: ts.color, border: `0.5px solid ${ts.border}`, padding: "1px 7px", borderRadius: 100, flexShrink: 0 }}>
                        {t.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)", margin: 0 }}>
                      {t.challengeId?.title || "Challenge"} · {t.members?.length}/{t.maxMembers} members
                    </p>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text2)", flexShrink: 0 }}>View →</span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ── Submissions (unchanged logic) ────────────────────────────────────── */}
      <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text1)", margin: "0 0 14px", letterSpacing: "-0.2px" }}>
        {isOwn ? "My Projects" : `${profile.name}'s Projects`}
      </h2>

      {submissions.length === 0 ? (
        <div className="ix-card" style={{ padding: "48px", textAlign: "center", color: "var(--text2)" }}>
          {isOwn ? (
            <>
              <p style={{ marginBottom: 16 }}>No submissions yet</p>
              <Link to="/challenges" className="btn-primary">Browse Challenges →</Link>
            </>
          ) : (
            <p>No published projects yet</p>
          )}
        </div>
      ) : (
        <div className="ix-card" style={{ overflow: "hidden" }}>
          {submissions.map((s, i) => {
            const sm = STATUS_MAP[s.status] || STATUS_MAP.pending;
            return (
              <Link
                key={s._id}
                to={`/submissions/${s._id}`}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderTop: i > 0 ? "0.5px solid var(--border)" : "none", textDecoration: "none", transition: "background 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.assignmentId?.title}
                    </span>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: sm.color }}>{sm.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className={`badge-${s.assignmentId?.difficulty}`}>{s.assignmentId?.difficulty}</span>
                    {s.assignmentId?.tags?.slice(0, 2).map((tag) => (
                      <span key={tag} style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text3)", border: "0.5px solid var(--border)", padding: "1px 7px", borderRadius: 4 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {s.status === "published" && s.finalScore !== null && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text1)" }}>{s.finalScore}</div>
                    {s.rank && (
                      <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text3)" }}>Rank #{s.rank}</div>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}