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
  pending:        { label: "Pending",    dot: "#fbbf24" },
  ai_evaluated:   { label: "AI Done",    dot: "#38bdf8" },
  admin_reviewed: { label: "In Review",  dot: "#38bdf8" },
  published:      { label: "Published",  dot: "#2ea44f" },
  rejected:       { label: "Rejected",   dot: "#f87171" },
};

const PLAN_LABEL = {
  free:    "Free",
  ten_day: "Sprint",
  monthly: "Pro",
};

const ACCENT = "#2ea44f"; /* GitHub-green — the one accent used across the page */

/* ── Styles ──────────────────────────────────────────────────────── */
const css = `
  .pf-root {
    --bg: #050505;
    --card: #0e0e10;
    --card-hover: #16171a;
    --border: #232428;
    --fg: #e6edf3;
    --text1: #e6edf3;
    --muted: #8b949e;
    --mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  }
  .light .pf-root,
  [data-theme="light"] .pf-root {
    --bg: #ffffff;
    --card: #ffffff;
    --card-hover: #f6f8fa;
    --border: #d0d7de;
    --fg: #1f2328;
    --text1: #1f2328;
    --muted: #59636e;
  }
  .pf-root * { box-sizing: border-box; }

  .pf-grid {
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 32px;
    align-items: start;
  }
  @media (max-width: 700px) {
    .pf-grid { grid-template-columns: 1fr; }
  }

  /* Card */
  .pf-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  /* Sidebar */
  .pf-avatar {
    width: 132px;
    height: 132px;
    border-radius: 50%;
    border: 1px solid var(--border);
    object-fit: cover;
    display: block;
  }
  .pf-avatar-fallback {
    width: 132px;
    height: 132px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--card-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    font-weight: 600;
    color: var(--muted);
  }
  .pf-empty-chip {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: var(--card-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 18px;
  }
  .pf-empty-icon {
    width: 22px;
    height: 22px;
    color: var(--muted);
  }
  .pf-name { font-size: 20px; font-weight: 700; color: var(--text1); margin: 14px 0 0; letter-spacing: -0.01em; }
  .pf-username { font-family: var(--mono); font-size: 15px; font-weight: 400; color: var(--muted); margin: 2px 0 0; }
  .pf-bio { font-size: 13px; color: var(--text1); line-height: 1.5; margin: 14px 0 0; }

  .pf-sidebar-btn {
    width: 100%;
    height: 30px;
    margin-top: 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text1);
    background: var(--card-hover);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.12s;
  }
  .pf-sidebar-btn:hover { background: var(--border); }

  .pf-meta-row {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: var(--muted);
    margin-top: 9px;
  }
  .pf-meta-row a { color: var(--muted); text-decoration: none; }
  .pf-meta-row a:hover { color: var(--text1); text-decoration: underline; }
  .pf-meta-icon { width: 15px; height: 15px; flex-shrink: 0; opacity: 0.85; }

  .pf-sidebar-divider { border: none; border-top: 1px solid var(--border); margin: 16px 0; }

  .pf-skill-pill {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 9px;
    margin: 0 6px 6px 0;
    font-size: 11px;
    font-weight: 600;
    color: var(--text1);
    background: var(--card-hover);
    border: 1px solid var(--border);
    border-radius: 999px;
  }

  .pf-plan-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: ${ACCENT};
    background: rgba(46,160,67,0.15);
    border: 1px solid rgba(46,160,67,0.4);
    border-radius: 999px;
  }

  /* Form inputs (edit mode) */
  .pf-input {
    width: 100%;
    height: 32px;
    padding: 0 10px;
    font-size: 13px;
    font-family: inherit;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 6px;
    outline: none;
  }
  .pf-input:focus { border-color: ${ACCENT}; box-shadow: 0 0 0 3px rgba(46,160,67,0.2); }
  .pf-textarea {
    width: 100%;
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 6px;
    outline: none;
    resize: none;
  }
  .pf-textarea:focus { border-color: ${ACCENT}; box-shadow: 0 0 0 3px rgba(46,160,67,0.2); }
  .pf-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .pf-btn-primary {
    height: 30px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: ${ACCENT};
    border: 1px solid rgba(0,0,0,0.15);
    border-radius: 6px;
    cursor: pointer;
  }
  .pf-btn-primary:hover { filter: brightness(1.08); }
  .pf-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .pf-btn-ghost {
    height: 30px;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text1);
    background: var(--card-hover);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
  }
  .pf-btn-ghost:hover { background: var(--border); }
  .pf-btn-lg {
    height: 36px;
    padding: 0 18px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }

  /* Stats grid — individual boxed cards w/ colored icon chips */
  .pf-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }
  @media (max-width: 700px) {
    .pf-stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
  .pf-stat-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    position: relative;
    overflow: hidden;
  }
  .pf-stat-chip {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }
  .pf-stat-chip svg { width: 16px; height: 16px; }
  .pf-stat-val { font-family: var(--mono); font-size: 24px; font-weight: 700; color: var(--text1); line-height: 1; }
  .pf-stat-label { font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); margin-top: 6px; }

  /* Section heading */
  .pf-section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text1);
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .pf-section-count {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    background: var(--card-hover);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 1px 8px;
  }

  /* Repo-style rows */
  .pf-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    text-decoration: none;
    border-top: 1px solid var(--border);
    transition: background 0.1s;
  }
  .pf-row:first-child { border-top: none; }
  .pf-row:hover { background: var(--card-hover); }
  .pf-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .pf-row-title { font-size: 13px; font-weight: 600; color: ${ACCENT}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pf-row-meta { font-size: 11px; color: var(--muted); margin-top: 4px; display: flex; gap: 10px; flex-wrap: wrap; }
  .pf-row-tag { font-family: var(--mono); }
  .pf-row-score { font-family: var(--mono); font-size: 16px; font-weight: 700; color: var(--text1); text-align: right; }
  .pf-row-rank { font-size: 10px; color: var(--muted); text-align: right; margin-top: 2px; }

  .pf-skeleton {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    animation: pf-pulse 1.4s ease-in-out infinite;
  }
  @keyframes pf-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.9; } }
`;

const Icon = ({ d, className = "pf-meta-icon" }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor"><path d={d} /></svg>
);
const ICONS = {
  github:   "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z",
  link:     "M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.001 1.001 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287Zm6.563 3.336L12.657 8.5a3 3 0 1 0-4.243-4.243L6.586 6.086A3 3 0 0 0 7.414 11l.586-.586a1 1 0 0 0 .154-.199 2 2 0 0 1-.861-3.337l1.827-1.828a2 2 0 1 1 2.83 2.83l-.793.792c.08.42.12.85.12 1.287Z",
  calendar: "M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.5A1.75 1.75 0 0 1 15.25 3.75v9.5A1.75 1.75 0 0 1 13.5 15h-11A1.75 1.75 0 0 1 .75 13.25v-9.5A1.75 1.75 0 0 1 2.5 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 3.5a.25.25 0 0 0-.25.25V6h11.5V3.75a.25.25 0 0 0-.25-.25h-11ZM13.75 7.5H2.25v5.75c0 .138.112.25.25.25h11a.25.25 0 0 0 .25-.25V7.5Z",
  trophy:   "M2.5 2h11a.5.5 0 0 1 .5.5v1.25c0 1.93-1.21 3.59-2.92 4.24A4.502 4.502 0 0 1 8.5 11.93V13h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-1.07a4.502 4.502 0 0 1-2.58-3.94C2.71 7.34 1.5 5.68 1.5 3.75V2.5a.5.5 0 0 1 .5-.5Zm.5 1.75c0 1.24.74 2.32 1.81 2.8A4.49 4.49 0 0 1 4.5 5V3H3v.75ZM12 3v2c0 .58.13 1.14.37 1.64a3.01 3.01 0 0 0 1.63-2.64V3h-2Z",
  bolt:     "M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09Z",
  flame:    "M8.5.5a.5.5 0 0 0-.864-.345C5.563 2.295 4.5 4.55 4.5 6.5a4.5 4.5 0 0 0 .157 1.18A3.5 3.5 0 0 1 3 5c0-.483.176-1.054.485-1.658a.5.5 0 0 0-.74-.642C1.45 3.967.5 5.86.5 7.5a5.5 5.5 0 1 0 11 0c0-2.6-1.34-4.917-3-7Z",
  check:    "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z",
  box:      "M7.752.066a.5.5 0 0 1 .496 0l6.25 3.5a.5.5 0 0 1 .252.434v7a.5.5 0 0 1-.252.434l-6.25 3.5a.5.5 0 0 1-.496 0l-6.25-3.5A.5.5 0 0 1 1 11V4a.5.5 0 0 1 .252-.434ZM2 4.957v5.59l5.25 2.94V7.898Zm6.25 8.531 5.25-2.94v-5.59L8.25 7.898ZM7.75 1.07 2.929 3.785 7.75 6.5l4.821-2.715Z",
};

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
  const [avatarError, setAvatarError] = useState(false);

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
      <div className="pf-root" style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
        <div className="pf-grid">
          <div className="pf-skeleton" style={{ height: 360 }} />
          <div>
            <div className="pf-skeleton" style={{ height: 90, marginBottom: 20 }} />
            <div className="pf-skeleton" style={{ height: 280 }} />
          </div>
        </div>
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{css}</style>
      <div className="pf-root" style={{ maxWidth: 600, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <div className="pf-card" style={{ padding: 48 }}>
          <p style={{ color: "var(--muted)", marginBottom: 20, fontSize: 13 }}>{error}</p>
          <Link to="/" className="pf-btn-ghost pf-btn-lg">← Home</Link>
        </div>
      </div>
    </>
  );

  if (!profile) return null;

  const initials = (profile.name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  const published = submissions.filter((s) => s.status === "published");
  const planLabel = PLAN_LABEL[profile.plan] || "Free";

  const statCells = [
    { label: "Global Rank", value: stats?.globalRank ? `#${stats.globalRank}` : "—", icon: ICONS.trophy, bg: "rgba(245,158,11,0.15)", fg: "#f59e0b" },
    { label: "Total Score", value: stats?.totalScore  ?? "—", icon: ICONS.bolt,   bg: "rgba(167,139,250,0.15)", fg: "#a78bfa" },
    { label: "Best Score",  value: stats?.bestScore   || "—", icon: ICONS.flame,  bg: "rgba(251,146,60,0.15)",  fg: "#fb923c" },
    { label: "Published",   value: published.length,         icon: ICONS.check,  bg: "rgba(46,160,67,0.15)",   fg: ACCENT },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="pf-root" style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
        <div className="pf-grid">

          {/* ══════════ Sidebar ══════════ */}
          <div>
            {profile.profileImage && !avatarError ? (
              <img src={profile.profileImage} onError={() => setAvatarError(true)} className="pf-avatar" alt={profile.name} />
            ) : (
              <div className="pf-avatar-fallback" style={{ fontSize: 42 }}>{initials}</div>
            )}

            {editing ? (
              <input className="pf-input" style={{ marginTop: 14, fontWeight: 700 }} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            ) : (
              <h1 className="pf-name">{profile.name}</h1>
            )}
            <p className="pf-username">@{profile.username}</p>

            {isOwn && !editing && (
              <button onClick={() => setEditing(true)} className="pf-sidebar-btn">Edit profile</button>
            )}
            {isOwn && editing && (
              <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                <button onClick={handleSave} disabled={saving} className="pf-btn-primary" style={{ flex: 1 }}>{saving ? "Saving…" : "Save"}</button>
                <button onClick={() => setEditing(false)} className="pf-btn-ghost" style={{ flex: 1 }}>Cancel</button>
              </div>
            )}

            {editing ? (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="pf-label">Bio</label>
                  <textarea className="pf-textarea" rows={3} maxLength={300} value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} placeholder="Tell us about yourself…" />
                </div>
                <div>
                  <label className="pf-label">GitHub username</label>
                  <input className="pf-input" value={editForm.githubUsername} onChange={(e) => setEditForm({ ...editForm, githubUsername: e.target.value })} placeholder="yourusername" />
                </div>
                {[
                  { key: "twitter",  label: "Twitter / X",        placeholder: "https://twitter.com/yourhandle"      },
                  { key: "linkedin", label: "LinkedIn",            placeholder: "https://linkedin.com/in/yourprofile" },
                  { key: "website",  label: "Website",             placeholder: "https://yourwebsite.com"            },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="pf-label">{label}</label>
                    <input className="pf-input" value={editForm.socialLinks[key]} onChange={(e) => setEditForm({ ...editForm, socialLinks: { ...editForm.socialLinks, [key]: e.target.value } })} placeholder={placeholder} />
                  </div>
                ))}
                <div>
                  <label className="pf-label">Skills (max 15)</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input className="pf-input" placeholder="e.g. React" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSkill(); } }} />
                    <button type="button" onClick={handleAddSkill} className="pf-btn-ghost" style={{ flexShrink: 0 }}>Add</button>
                  </div>
                  {(profile.skills || []).length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {profile.skills.map((skill) => (
                        <span key={skill} className="pf-skill-pill">
                          {skill}
                          <button onClick={() => handleRemoveSkill(skill)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0, marginLeft: 5, fontSize: 13, lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {profile.bio && <p className="pf-bio">{profile.bio}</p>}

                <div style={{ marginTop: 14 }}>
                  <span className="pf-plan-pill">
                    <Icon d={ICONS.box} /> {planLabel} plan
                  </span>
                </div>

                {profile.githubUsername && (
                  <div className="pf-meta-row">
                    <Icon d={ICONS.github} />
                    <a href={`https://github.com/${profile.githubUsername}`} target="_blank" rel="noreferrer">{profile.githubUsername}</a>
                  </div>
                )}
                {profile.socialLinks?.twitter && (
                  <div className="pf-meta-row"><Icon d={ICONS.link} /><a href={sanitiseUrl(profile.socialLinks.twitter)} target="_blank" rel="noreferrer">Twitter</a></div>
                )}
                {profile.socialLinks?.linkedin && (
                  <div className="pf-meta-row"><Icon d={ICONS.link} /><a href={sanitiseUrl(profile.socialLinks.linkedin)} target="_blank" rel="noreferrer">LinkedIn</a></div>
                )}
                {profile.socialLinks?.website && (
                  <div className="pf-meta-row"><Icon d={ICONS.link} /><a href={sanitiseUrl(profile.socialLinks.website)} target="_blank" rel="noreferrer">Website</a></div>
                )}
                <div className="pf-meta-row">
                  <Icon d={ICONS.calendar} /> Joined {format(new Date(profile.createdAt), "MMM yyyy")}
                </div>

                {(profile.skills || []).length > 0 && (
                  <>
                    <hr className="pf-sidebar-divider" />
                    <div>
                      {profile.skills.map((skill) => (
                        <span key={skill} className="pf-skill-pill">{skill}</span>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* ══════════ Main ══════════ */}
          <div>
            {/* Stats grid */}
            <div className="pf-stats-grid" style={{ marginBottom: 24 }}>
              {statCells.map((s) => (
                <div
                  key={s.label}
                  className="pf-stat-card"
                  style={{ background: `radial-gradient(160px 100px at 18% 0%, ${s.bg}, transparent 70%), var(--card)` }}
                >
                  <div className="pf-stat-chip" style={{ background: s.bg, color: s.fg }}>
                    <Icon d={s.icon} className="" />
                  </div>
                  <div className="pf-stat-val">{s.value}</div>
                  <div className="pf-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Teams */}
            {teams.length > 0 && (
              <>
                <h2 className="pf-section-title">Teams <span className="pf-section-count">{teams.length}</span></h2>
                <div className="pf-card" style={{ overflow: "hidden", marginBottom: 24 }}>
                  {teams.map((t) => (
                    <Link key={t._id} to={`/team/${t._id}`} className="pf-row">
                      <span className="pf-status-dot" style={{ background: ACCENT }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pf-row-title">{t.teamName}</div>
                        <div className="pf-row-meta">
                          <span>{t.challengeId?.title || "Challenge"}</span>
                          <span className="pf-row-tag">{t.members?.length}/{t.maxMembers} members</span>
                          <span className="pf-row-tag">{t.status}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* Submissions */}
            <h2 className="pf-section-title">
              {isOwn ? "My Projects" : `${profile.name}'s Projects`} <span className="pf-section-count">{submissions.length}</span>
            </h2>

            {submissions.length === 0 ? (
              <div className="pf-card" style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <div className="pf-empty-chip">
                  <Icon d={ICONS.box} className="pf-empty-icon" />
                </div>
                {isOwn ? (
                  <>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "12px 0 20px" }}>No submissions yet</p>
                    <Link to="/challenges" className="pf-btn-primary pf-btn-lg">Browse Challenges →</Link>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "12px 0 0" }}>No published projects yet</p>
                )}
              </div>
            ) : (
              <div className="pf-card" style={{ overflow: "hidden" }}>
                {submissions.map((s) => {
                  const sm = STATUS_MAP[s.status] || STATUS_MAP.pending;
                  return (
                    <Link key={s._id} to={`/submissions/${s._id}`} className="pf-row">
                      <span className="pf-status-dot" style={{ background: sm.dot }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pf-row-title">{s.assignmentId?.title}</div>
                        <div className="pf-row-meta">
                          <span>{sm.label}</span>
                          <span className="pf-row-tag">{s.assignmentId?.difficulty}</span>
                          {s.assignmentId?.tags?.slice(0, 2).map((tag) => (
                            <span key={tag} className="pf-row-tag">{tag}</span>
                          ))}
                        </div>
                      </div>
                      {s.status === "published" && s.finalScore !== null && (
                        <div style={{ flexShrink: 0 }}>
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
        </div>
      </div>
    </>
  );
}