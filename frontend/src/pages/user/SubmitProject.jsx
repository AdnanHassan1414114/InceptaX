import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function SubmitProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [form, setForm] = useState({ repoLink: "", liveLink: "", description: "", teamMemberUsernames: "" });
  const [loading, setLoading] = useState(false);
  const [fetchingAssignment, setFetchingAssignment] = useState(true);

  const isPremiumActive = user?.plan !== "free" && user?.planExpiresAt && new Date() < new Date(user?.planExpiresAt);

  useEffect(() => {
    api.get(`/assignments/${id}`)
      .then((res) => setAssignment(res.data.data.assignment))
      .catch(() => toast.error("Could not load challenge"))
      .finally(() => setFetchingAssignment(false));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.repoLink.includes("github.com")) return toast.error("Enter a valid GitHub URL");
    if (form.description.length < 20) return toast.error("Description must be at least 20 characters");
    setLoading(true);
    try {
      const teamMembers = isPremiumActive && form.teamMemberUsernames
        ? form.teamMemberUsernames.split(",").map((u) => u.trim()).filter(Boolean)
        : [];
      const res = await api.post("/submissions", {
        assignmentId: id,
        repoLink: form.repoLink,
        liveLink: form.liveLink,
        description: form.description,
        teamMembers,
      });
      const submissionId = res.data.data.submission._id;
      toast.success("Submission received! 🚀");
      navigate(`/submissions/${submissionId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  if (fetchingAssignment) return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px" }}>
      <div className="skeleton" style={{ height: 280, borderRadius: 14 }} />
    </div>
  );

  if (!assignment) return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
      <p style={{ color: "var(--text2)" }}>Challenge not found.</p>
      <Link to="/challenges" className="btn-ghost" style={{ marginTop: 16, display: "inline-flex" }}>← Challenges</Link>
    </div>
  );

  return (
    <div className="page-enter" style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px" }}>
      <Link to={`/challenges/${id}`} style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}>
        ← {assignment.title}
      </Link>

      <div className="ix-card" style={{ padding: "24px" }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--text1)", margin: "0 0 4px", letterSpacing: "-0.3px" }}>Submit Project</h1>
        <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 24px" }}>{assignment.title}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="ix-label">GitHub Repository URL *</label>
            <input className="ix-input" type="url" placeholder="https://github.com/username/repo" value={form.repoLink} onChange={(e) => setForm({ ...form, repoLink: e.target.value })} required />
          </div>
          <div>
            <label className="ix-label">Live Demo URL (optional)</label>
            <input className="ix-input" type="url" placeholder="https://yourproject.vercel.app" value={form.liveLink} onChange={(e) => setForm({ ...form, liveLink: e.target.value })} />
          </div>
          <div>
            <label className="ix-label">Project Description *</label>
            <textarea className="ix-input" style={{ resize: "none" }} rows={5} placeholder="Describe your project, tech stack, challenges faced, and key features (min 20 chars)..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, textAlign: "right" }}>{form.description.length} chars</p>
          </div>
          {isPremiumActive && (
            <div>
              <label className="ix-label">Team Members (Premium)</label>
              <input className="ix-input" placeholder="username1, username2" value={form.teamMemberUsernames} onChange={(e) => setForm({ ...form, teamMemberUsernames: e.target.value })} />
              <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Comma-separated usernames</p>
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", padding: "11px", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Submitting..." : "Submit Project →"}
          </button>
        </form>
      </div>
    </div>
  );
}