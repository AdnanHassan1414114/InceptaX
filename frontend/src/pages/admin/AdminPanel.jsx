import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";

// ─── Difficulty options — matches Assignment model enum ───────────────────────
const DIFFICULTIES = ["easy", "medium", "hard"];

const DIFF_STYLE = {
  easy:   { color: "var(--emerald)", border: "rgba(74,222,128,0.25)",  bg: "rgba(74,222,128,0.06)"  },
  medium: { color: "var(--amber)",   border: "rgba(251,191,36,0.25)",  bg: "rgba(251,191,36,0.06)"  },
  hard:   { color: "var(--red)",     border: "rgba(248,113,113,0.25)", bg: "rgba(248,113,113,0.06)" },
};

const EMPTY_FORM = {
  title:       "",
  description: "",
  difficulty:  "medium",
  deadline:    "",
};

export default function AdminPanel() {
  const { user } = useAuth();

  const [form, setForm]       = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.description.trim()) { toast.error("Description is required"); return; }
    if (!form.deadline) { toast.error("Deadline is required"); return; }
    if (new Date(form.deadline) <= new Date()) {
      toast.error("Deadline must be a future date");
      return;
    }

    setLoading(true);
    try {
      // Authorization header already attached globally by api.js
      await api.post("/admin/assignments", {
        title:       form.title.trim(),
        description: form.description.trim(),
        difficulty:  form.difficulty,
        deadline:    new Date(form.deadline).toISOString(),
      });

      toast.success("Challenge created successfully! 🚀");
      setForm(EMPTY_FORM);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to create challenge";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div
      className="page-enter"
      style={{ maxWidth: 680, margin: "0 auto", padding: "40px 16px" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 32,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "var(--text1)",
              margin: "0 0 4px",
              letterSpacing: "-0.4px",
            }}
          >
            Admin Panel
          </h1>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>
            Signed in as{" "}
            <span style={{ fontFamily: "monospace", color: "var(--text1)" }}>
              {user?.email}
            </span>
          </p>
        </div>

        <span
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            color: "var(--violet)",
            border: "0.5px solid rgba(167,139,250,0.3)",
            background: "rgba(167,139,250,0.06)",
            padding: "3px 12px",
            borderRadius: 100,
          }}
        >
          ⬡ Admin
        </span>
      </div>

      {/* ── Create Challenge form ───────────────────────────────────────────── */}
      <div className="ix-card" style={{ padding: "28px 24px" }}>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "var(--text1)",
            margin: "0 0 24px",
            letterSpacing: "-0.2px",
          }}
        >
          Create Challenge
        </h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {/* Title */}
          <div>
            <label className="ix-label">Title *</label>
            <input
              className="ix-input"
              type="text"
              placeholder="e.g. Build a REST API with Authentication"
              value={form.title}
              onChange={set("title")}
              maxLength={200}
              required
            />
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4, textAlign: "right" }}>
              {form.title.length}/200
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="ix-label">Description *</label>
            <textarea
              className="ix-input"
              style={{ resize: "vertical", minHeight: 110 }}
              placeholder="Describe the challenge requirements, expected deliverables, and evaluation criteria…"
              value={form.description}
              onChange={set("description")}
              required
            />
          </div>

          {/* Difficulty — visual button selector */}
          <div>
            <label className="ix-label">Difficulty *</label>
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              {DIFFICULTIES.map((d) => {
                const active = form.difficulty === d;
                const s = DIFF_STYLE[d];
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, difficulty: d }))}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "monospace",
                      fontWeight: active ? 600 : 400,
                      border: `0.5px solid ${active ? s.border : "var(--border)"}`,
                      background: active ? s.bg : "var(--bg2)",
                      color: active ? s.color : "var(--text2)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="ix-label">Deadline *</label>
            <input
              className="ix-input"
              type="date"
              min={todayStr}
              value={form.deadline}
              onChange={set("deadline")}
              required
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              width: "100%",
              padding: "11px",
              marginTop: 4,
              fontSize: 14,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Creating…" : "Create Challenge →"}
          </button>
        </form>
      </div>

      {/* ── Quick links ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        {[
          { label: "View Challenges", href: "/challenges" },
          { label: "Leaderboard",     href: "/leaderboard" },
          { label: "My Profile",      href: `/u/${user?.username}` },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            className="btn-ghost"
            style={{ fontSize: 12, textAlign: "center" }}
          >
            {l.label} →
          </a>
        ))}
      </div>
    </div>
  );
}