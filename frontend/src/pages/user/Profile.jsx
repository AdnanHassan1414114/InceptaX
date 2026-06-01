import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";

/* ── Helpers ─────────────────────────────────────────────────────── */
function sanitiseUrl(raw = "") {
  const val = raw.trim();
  if (!val) return "";
  return /^https?:\/\//i.test(val) ? val : `https://${val}`;
}

/* ── Constants ───────────────────────────────────────────────────── */
const STATUS_MAP = {
  pending:        { label: "Pending"   },
  ai_evaluated:   { label: "AI Done"   },
  admin_reviewed: { label: "In Review" },
  published:      { label: "Published" },
  rejected:       { label: "Rejected"  },
};

const PLAN_LABEL = {
  free:    "Free",
  ten_day: "Sprint",
  monthly: "Pro ✦",
};

/* ── Styles ──────────────────────────────────────────────────────── */
const css = `
  @keyframes pf-pulse {
    0%, 100% { opacity: 0.06; }
    50%       { opacity: 0.14; }
  }

  .pf-root {
    --bg: #ffffff;
    --fg: #000000;
    --border: #000000;
    --text1: #000000;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .dark .pf-root,
  [data-theme="dark"] .pf-root {
    --bg: #000000;
    --fg: #ffffff;
    --border: #ffffff;
    --text1: #ffffff;
  }
  .pf-root * { box-sizing: border-box; }

  /* Card */
  .pf-card {
    background: var(--bg);
    border: 1.5px solid var(--border);
    margin-bottom: 12px;
  }

  /* Badge */
  .pf-badge {
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

  /* Skill tag (view mode) */
  .pf-skill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
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
    opacity: 0.7;
  }

  /* Buttons */
  .pf-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0 16px;
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
  .pf-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .pf-btn-ghost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0 16px;
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
  .pf-btn-ghost:hover { background: var(--fg); color: var(--bg); }

  /* Form inputs */
  .pf-input {
    width: 100%;
    height: 38px;
    padding: 0 12px;
    font-family: inherit;
    font-size: 13px;
    background: var(--bg);
    color: var(--fg);
    border: 1.5px solid var(--border);
    outline: none;
  }
  .pf-input:focus { outline: 2px solid var(--fg); outline-offset: 1px; }
  .pf-textarea {
    width: 100%;
    padding: 10px 12px;
    font-family: inherit;
    font-size: 13px;
    background: var(--bg);
    color: var(--fg);
    border: 1.5px solid var(--border);
    outline: none;
    resize: none;
  }
  .pf-textarea:focus { outline: 2px solid var(--fg); outline-offset: 1px; }
  .pf-label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text1);
    opacity: 0.45;
    margin-bottom: 6px;
  }

  /* Row (submissions / teams) */
  .pf-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 20px;
    text-decoration: none;
    border-top: 1.5px solid var(--border);
    transition: background 0.12s;
  }
  .pf-row:first-child { border-top: none; }
  .pf-row:hover { background: var(--fg); }
  .pf-row:hover .pf-row-title,
  .pf-row:hover .pf-row-sub,
  .pf-row:hover .pf-row-score,
  .pf-row:hover .pf-row-rank,
  .pf-row:hover .pf-badge { color: var(--bg); border-color: rgba(255,255,255,0.25); }
  .pf-row:hover .pf-row-arrow { color: var(--bg); }

  .pf-row-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pf-row-sub {
    font-size: 11px;
    color: var(--text1);
    opacity: 0.4;
    margin: 3px 0 0;
  }
  .pf-row-score {
    font-size: 18px;
    font-weight: 700;
    color: var(--text1);
    letter-spacing: -0.03em;
    text-align: right;
  }
  .pf-row-rank {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text1);
    opacity: 0.4;
    text-align: right;
  }
  .pf-row-arrow {
    font-size: 11px;
    color: var(--text1);
    opacity: 0.35;
    flex-shrink: 0;
  }

  /* Stat cell */
  .pf-stat {
    text-align: center;
    padding: 16px 8px;
    border-right: 1.5px solid var(--border);
  }
  .pf-stat:last-child { border-right: none; }

  /* Divider */
  .pf-divider {
    border: none;
    border-top: 1.5px solid var(--border);
    opacity: 0.12;
    margin: 0;
  }

  /* Skeleton */
  .pf-skeleton {
    background: var(--fg);
    border: 1.5px solid var(--border);
    animation: pf-pulse 1.4s ease-in-out infinite;
    margin-bottom: 12px;
  }

  /* Social links */
  .pf-social-link {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--text1);
    text-decoration: none;
    opacity: 0.5;
    border-bottom: 1px solid transparent;
    transition: opacity 0.12s, border-color 0.12s;
  }
  .pf-social-link:hover { opacity: 1; border-bottom-color: var(--fg); }
`;

/* ── Component ───────────────────────────────────────────────────── */
export default function Profile() {
  const { username } = useParams();
  const { user: me, updateUserProfile } = useAuth();

  const [profile, setProfile]     = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats]         = useState(null);
  const [teams, setTeams]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [editForm, setEditForm]   = useState({
    name: "", bio: "", githubUsername: "",
    socialLinks: { twitter: "", linkedin: "", website: "" },
  });
  const [skillInput, setSkillInput] = useState("");

  const isOwn = me?.username === username;

  useEffect(() => {
    setLoading(true);
    setStats(null);
    setTeams([]);
    Promise.all([
      api.get(`/users/${username}`),
      api.get(`/users/${username}/submissions`, { params: { limit: 20 } }),
      api.get(`/users/${username}/stats`),
    ])
      .then(([uRes, sRes, stRes]) => {
        const u = uRes.data.data.user;
        setProfile(u);
        setEditForm({
          name: u.name || "", bio: u.bio || "", githubUsername: u.githubUsername || "",
          socialLinks: { twitter: u.socialLinks?.twitter || "", linkedin: u.socialLinks?.linkedin || "", website: u.socialLinks?.website || "" },
        });
        setSubmissions(sRes.data.data.data || []);
        setStats(stRes.data.data);
      })
      .catch((err) => setError(err.response?.data?.message || "User not found"))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (!profile || submissions.length === 0) return;
    const challengeIds = [...new Set(submissions.map((s) => s.assignmentId?._id).filter(Boolean))];
    if (challengeIds.length === 0) return;
    Promise.allSettled(
      challengeIds.slice(0, 5).map((cid) => api.get(`/teams/challenge/${cid}`, { params: { limit: 10 } }))
    ).then((results) => {
      const myTeams = [];
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        (r.value.data.data.data || []).forEach((t) => {
          const isMember = t.members?.some((m) => m._id?.toString() === profile._id?.toString());
          if (isMember && !myTeams.find((x) => x._id === t._id)) myTeams.push(t);
        });
      });
      setTeams(myTeams);
    });
  }, [profile, submissions]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateUserProfile({
        name: editForm.name, bio: editForm.bio, githubUsername: editForm.githubUsername,
        skills: profile.skills || [],
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
    } finally { setSaving(false); }
  };

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

  /* ── Loading ── */
  if (loading) return (
    <>
      <style>{css}</style>
      <div className="pf-root" style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px" }}>
        <div className="pf-skeleton" style={{ height: 220 }} />
        <div className="pf-skeleton" style={{ height: 80 }} />
        <div className="pf-skeleton" style={{ height: 280 }} />
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{css}</style>
      <div className="pf-root" style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px", textAlign: "center" }}>
        <div className="pf-card" style={{ padding: 48 }}>
          <p style={{ color: "var(--text1)", opacity: 0.6, marginBottom: 20 }}>{error}</p>
          <Link to="/" className="pf-btn-ghost">← Home</Link>
        </div>
      </div>
    </>
  );

  if (!profile) return null;

  const avatar    = profile.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.name}&backgroundColor=111111&textColor=ffffff`;
  const published = submissions.filter((s) => s.status === "published");
  const planLabel = PLAN_LABEL[profile.plan] || "Free";

  const statCells = [
    { label: "Global Rank", value: stats?.globalRank ? `#${stats.globalRank}` : "—" },
    { label: "Total Score", value: stats?.totalScore  ?? "—" },
    { label: "Best Score",  value: stats?.bestScore   || "—" },
    { label: "Published",   value: published.length },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="pf-root" style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px" }}>

        {/* ── Header card ── */}
        <div className="pf-card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

            {/* Avatar */}
            <img
              src={avatar}
              style={{ width: 64, height: 64, borderRadius: 0, border: "1.5px solid var(--border)", flexShrink: 0 }}
              alt={profile.name}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
                <div>
                  {editing ? (
                    <input className="pf-input" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  ) : (
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text1)", margin: "0 0 3px", letterSpacing: "-0.03em" }}>{profile.name}</h1>
                  )}
                  <p style={{ fontSize: 12, color: "var(--text1)", opacity: 0.4, margin: 0 }}>@{profile.username}</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="pf-badge">{planLabel}</span>
                  {isOwn && (
                    editing ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={handleSave} disabled={saving} className="pf-btn-primary">{saving ? "Saving…" : "Save"}</button>
                        <button onClick={() => setEditing(false)} className="pf-btn-ghost">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditing(true)} className="pf-btn-ghost">Edit Profile</button>
                    )
                  )}
                </div>
              </div>

              {/* Edit mode */}
              {editing ? (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label className="pf-label">Bio</label>
                    <textarea className="pf-textarea" rows={2} maxLength={300} value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} placeholder="Tell us about yourself…" />
                    <p style={{ fontSize: 10, color: "var(--text1)", opacity: 0.35, marginTop: 3, textAlign: "right" }}>{editForm.bio.length}/300</p>
                  </div>
                  <div>
                    <label className="pf-label">GitHub Username</label>
                    <input className="pf-input" value={editForm.githubUsername} onChange={(e) => setEditForm({ ...editForm, githubUsername: e.target.value })} placeholder="yourusername" />
                  </div>
                  {[
                    { key: "twitter",  label: "Twitter / X",        placeholder: "https://twitter.com/yourhandle"      },
                    { key: "linkedin", label: "LinkedIn",            placeholder: "https://linkedin.com/in/yourprofile" },
                    { key: "website",  label: "Website / Portfolio", placeholder: "https://yourwebsite.com"            },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="pf-label">{label}</label>
                      <input className="pf-input" value={editForm.socialLinks[key]} onChange={(e) => setEditForm({ ...editForm, socialLinks: { ...editForm.socialLinks, [key]: e.target.value } })} placeholder={placeholder} />
                    </div>
                  ))}
                  <div>
                    <label className="pf-label">Skills (max 15)</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input className="pf-input" placeholder="e.g. React, Node.js…" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSkill(); } }} />
                      <button type="button" onClick={handleAddSkill} className="pf-btn-ghost" style={{ flexShrink: 0 }}>Add</button>
                    </div>
                    {(profile.skills || []).length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {profile.skills.map((skill) => (
                          <span key={skill} className="pf-skill">
                            {skill}
                            <button onClick={() => handleRemoveSkill(skill)} style={{ background: "none", border: "none", color: "var(--text1)", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1, opacity: 0.5 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              ) : (
                /* View mode */
                <div style={{ marginTop: 10 }}>
                  {profile.bio && (
                    <p style={{ fontSize: 13, color: "var(--text1)", opacity: 0.65, margin: "0 0 10px", lineHeight: 1.65 }}>{profile.bio}</p>
                  )}
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: (profile.skills || []).length > 0 ? 10 : 0 }}>
                    {profile.githubUsername && (
                      <a href={`https://github.com/${profile.githubUsername}`} target="_blank" rel="noreferrer" className="pf-social-link">GitHub: @{profile.githubUsername}</a>
                    )}
                    {profile.socialLinks?.twitter && (
                      <a href={sanitiseUrl(profile.socialLinks.twitter)} target="_blank" rel="noreferrer" className="pf-social-link">Twitter →</a>
                    )}
                    {profile.socialLinks?.linkedin && (
                      <a href={sanitiseUrl(profile.socialLinks.linkedin)} target="_blank" rel="noreferrer" className="pf-social-link">LinkedIn →</a>
                    )}
                    {profile.socialLinks?.website && (
                      <a href={sanitiseUrl(profile.socialLinks.website)} target="_blank" rel="noreferrer" className="pf-social-link">Website →</a>
                    )}
                    <span style={{ fontSize: 12, color: "var(--text1)", opacity: 0.35 }}>
                      Joined {format(new Date(profile.createdAt), "MMM yyyy")}
                    </span>
                  </div>
                  {(profile.skills || []).length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {profile.skills.map((skill) => (
                        <span key={skill} className="pf-skill">{skill}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <hr className="pf-divider" style={{ marginTop: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${statCells.length}, 1fr)` }}>
            {statCells.map((s) => (
              <div key={s.label} className="pf-stat">
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text1)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text1)", opacity: 0.4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Teams ── */}
        {teams.length > 0 && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text1)", margin: "0 0 12px", letterSpacing: "-0.02em" }}>Teams</h2>
            <div className="pf-card" style={{ overflow: "hidden" }}>
              {teams.map((t) => (
                <Link key={t._id} to={`/team/${t._id}`} className="pf-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span className="pf-row-title">{t.teamName}</span>
                      <span className="pf-badge">{t.status}</span>
                    </div>
                    <p className="pf-row-sub">{t.challengeId?.title || "Challenge"} · {t.members?.length}/{t.maxMembers} members</p>
                  </div>
                  <span className="pf-row-arrow">View →</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* ── Submissions ── */}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text1)", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
          {isOwn ? "My Projects" : `${profile.name}'s Projects`}
        </h2>

        {submissions.length === 0 ? (
          <div className="pf-card" style={{ padding: "56px 24px", textAlign: "center" }}>
            {isOwn ? (
              <>
                <p style={{ fontSize: 13, color: "var(--text1)", opacity: 0.45, marginBottom: 20 }}>No submissions yet</p>
                <Link to="/challenges" className="pf-btn-primary">Browse Challenges →</Link>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text1)", opacity: 0.45, margin: 0 }}>No published projects yet</p>
            )}
          </div>
        ) : (
          <div className="pf-card" style={{ overflow: "hidden" }}>
            {submissions.map((s) => {
              const sm = STATUS_MAP[s.status] || STATUS_MAP.pending;
              return (
                <Link key={s._id} to={`/submissions/${s._id}`} className="pf-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span className="pf-row-title">{s.assignmentId?.title}</span>
                      <span className="pf-badge">{sm.label}</span>
                      <span className="pf-badge">{s.assignmentId?.difficulty}</span>
                    </div>
                    {s.assignmentId?.tags?.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {s.assignmentId.tags.slice(0, 2).map((tag) => (
                          <span key={tag} style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text1)", opacity: 0.4 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {s.status === "published" && s.finalScore !== null && (
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <div className="pf-row-score">{s.finalScore}</div>
                      {s.rank && <div className="pf-row-rank">Rank #{s.rank}</div>}
                    </div>
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