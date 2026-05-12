import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, isPast } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const DiffBadge = ({ d }) => <span className={`badge-${d}`}>{d}</span>;

export default function Challenges() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [diff, setDiff] = useState("all");
  const [showPremium, setShowPremium] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 8;

  const isPremiumActive = user && user.plan !== "free" && user.planExpiresAt && new Date() < new Date(user.planExpiresAt);

  const fetchAssignments = useCallback(() => {
    setLoading(true);
    const params = { page, limit };
    if (search) params.search = search;
    if (diff !== "all") params.difficulty = diff;
    if (showPremium === "premium") params.isPremium = true;
    api.get("/assignments", { params })
      .then((res) => { setAssignments(res.data.data.data || []); setPagination(res.data.data.pagination); })
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, [page, search, diff, showPremium]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const filterBtn = (active, label, onClick) => (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 8,
        fontSize: 12,
        border: `0.5px solid ${active ? "var(--border2)" : "var(--border)"}`,
        background: active ? "var(--bg3)" : "var(--bg2)",
        color: active ? "var(--text1)" : "var(--text2)",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="page-enter" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 16px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--text1)", margin: "0 0 4px", letterSpacing: "-0.4px" }}>Challenges</h1>
        <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>Pick a challenge, build something great, get ranked.</p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
        <input
          className="ix-input"
          style={{ maxWidth: 260 }}
          placeholder="Search challenges…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "easy", "medium", "hard"].map((d) =>
            filterBtn(diff === d, d, () => { setDiff(d); setPage(1); })
          )}
          {filterBtn(showPremium === "premium", "✦ Premium", () => { setShowPremium(showPremium === "premium" ? "all" : "premium"); setPage(1); })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
          {Array(6).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 14 }} />)}
        </div>
      ) : assignments.length === 0 ? (
        <div className="ix-card" style={{ padding: "48px", textAlign: "center", color: "var(--text2)" }}>No challenges found</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
            {assignments.map((a) => {
              const expired = isPast(new Date(a.deadline));
              const locked = a.isPremium && !isPremiumActive;
              return (
                <Link
                  key={a._id}
                  to={`/challenges/${a._id}`}
                  style={{ textDecoration: "none", display: "block", opacity: !a.accessible ? 0.65 : 1 }}
                >
                  <div
                    className="ix-card"
                    style={{ padding: "18px", height: "100%", transition: "border-color 0.2s" }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border2)"}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <DiffBadge d={a.difficulty} />
                      <div style={{ display: "flex", gap: 6 }}>
                        {locked && <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--amber)", border: "0.5px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)", padding: "2px 8px", borderRadius: 100 }}>🔒 Premium</span>}
                        {expired && <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--red)", border: "0.5px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.05)", padding: "2px 8px", borderRadius: 100 }}>Ended</span>}
                      </div>
                    </div>
                    <h3 style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", margin: "0 0 6px" }}>{a.title}</h3>
                    <p style={{ fontSize: 12, color: "var(--text2)", margin: "0 0 14px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.description}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {(a.tags || []).slice(0, 2).map((t) => (
                          <span key={t} style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text3)", border: "0.5px solid var(--border)", padding: "1px 7px", borderRadius: 4 }}>{t}</span>
                        ))}
                      </div>
                      <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)" }}>
                        {expired ? "Ended" : formatDistanceToNow(new Date(a.deadline), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 32 }}>
              <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="btn-ghost" style={{ fontSize: 12, opacity: page === 1 ? 0.3 : 1 }}>← Prev</button>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)" }}>{page} / {pagination.totalPages}</span>
              <button disabled={page === pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} className="btn-ghost" style={{ fontSize: 12, opacity: page === pagination.totalPages ? 0.3 : 1 }}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}