import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, isPast } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

/* ── Styles ─────────────────────────────────────────────────────── */
const css = `
  .ch-root {
    --bg: #ffffff;
    --fg: #000000;
    --border: #000000;
    --text1: #000000;
    --text2: #000000;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .dark .ch-root,
  [data-theme="dark"] .ch-root {
    --bg: #000000;
    --fg: #ffffff;
    --border: #ffffff;
    --text1: #ffffff;
    --text2: #ffffff;
  }

  .ch-root * { box-sizing: border-box; }

  /* ── Search ── */
  .ch-search {
    height: 38px;
    width: 260px;
    padding: 0 14px;
    font-family: inherit;
    font-size: 13px;
    background: var(--bg);
    color: var(--fg);
    border: 1.5px solid var(--border);
    border-radius: 0;
    outline: none;
  }
  .ch-search::placeholder { color: var(--fg); opacity: 0.4; }
  .ch-search:focus { outline: 2px solid var(--fg); outline-offset: 1px; }

  /* ── Filter buttons ── */
  .ch-filter-btn {
    height: 38px;
    padding: 0 18px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    border: 1.5px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    white-space: nowrap;
  }
  .ch-filter-btn.active {
    background: var(--fg);
    color: var(--bg);
  }

  /* ── Grid: 4 columns, fixed row height, gaps ── */
  .ch-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: 210px;
    gap: 16px;
  }

  @media (max-width: 960px) {
    .ch-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 480px) {
    .ch-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 480px) {
    .ch-grid { grid-template-columns: 1fr; }
  }

  /* ── Card ── */
  .ch-card {
    width: 100%;
    height: 210px;
    padding: 14px;
    background: var(--bg);
    border: 1.5px solid var(--border);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }

  /* ── Badge (rectangular, black/white only) ── */
  .ch-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
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

  /* ── Tag ── */
  .ch-tag {
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

  /* ── Card typography ── */
  .ch-card-title {
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    color: var(--text1);
    margin: 0 0 6px;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }
  .ch-card-desc {
    font-family: inherit;
    font-size: 13px;
    font-weight: 400;
    color: var(--text2);
    margin: 0;
    line-height: 1.55;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    opacity: 0.6;
  }
  .ch-card-time {
    font-family: inherit;
    font-size: 11px;
    font-weight: 500;
    color: var(--text1);
    text-align: right;
    opacity: 0.5;
    letter-spacing: 0.03em;
  }

  /* ── Skeleton ── */
  .ch-skeleton {
    height: 210px;
    border: 1.5px solid var(--border);
    opacity: 0.15;
    animation: ch-pulse 1.4s ease-in-out infinite;
    background: var(--fg);
  }
  @keyframes ch-pulse {
    0%, 100% { opacity: 0.08; }
    50% { opacity: 0.18; }
  }

  /* ── Empty state ── */
  .ch-empty {
    grid-column: 1 / -1;
    padding: 80px 0;
    text-align: center;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--text1);
    border: 1.5px solid var(--border);
    opacity: 0.5;
  }

  /* ── Pagination ── */
  .ch-page-btn {
    height: 38px;
    padding: 0 20px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: var(--bg);
    color: var(--fg);
    border: 1.5px solid var(--border);
    cursor: pointer;
  }
  .ch-page-btn:hover:not(:disabled) {
    background: var(--fg);
    color: var(--bg);
  }
  .ch-page-btn:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }
`;

const DiffBadge = ({ d }) => <span className="ch-badge">{d}</span>;

export default function Challenges() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [diff, setDiff] = useState("all");
  const [showPremium, setShowPremium] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 9;

  const isPremiumActive =
    user &&
    user.plan !== "free" &&
    user.planExpiresAt &&
    new Date() < new Date(user.planExpiresAt);

  const fetchAssignments = useCallback(() => {
    setLoading(true);
    const params = { page, limit };
    if (search) params.search = search;
    if (diff !== "all") params.difficulty = diff;
    if (showPremium === "premium") params.isPremium = true;
    api
      .get("/assignments", { params })
      .then((res) => {
        setAssignments(res.data.data.data || []);
        setPagination(res.data.data.pagination);
      })
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, [page, search, diff, showPremium]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  return (
    <>
      <style>{css}</style>

      <div className="ch-root" style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: "inherit",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text1)",
            margin: "0 0 6px",
            letterSpacing: "-0.03em",
          }}>
            Challenges
          </h1>
          <p style={{
            fontFamily: "inherit",
            fontSize: 13,
            color: "var(--text1)",
            margin: 0,
            opacity: 0.5,
          }}>
            Pick a challenge, build something great, get ranked.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28, alignItems: "center" }}>
          <input
            className="ch-search"
            placeholder="Search challenges…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all", "easy", "medium", "hard"].map((d) => (
              <button
                key={d}
                className={`ch-filter-btn${diff === d ? " active" : ""}`}
                onClick={() => { setDiff(d); setPage(1); }}
              >
                {d}
              </button>
            ))}
            <button
              className={`ch-filter-btn${showPremium === "premium" ? " active" : ""}`}
              onClick={() => { setShowPremium(showPremium === "premium" ? "all" : "premium"); setPage(1); }}
            >
              ✦ Premium
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="ch-grid">
            {Array(9).fill(0).map((_, i) => <div key={i} className="ch-skeleton" />)}
          </div>
        ) : assignments.length === 0 ? (
          <div className="ch-grid">
            <div className="ch-empty">No challenges found</div>
          </div>
        ) : (
          <>
            <div className="ch-grid">
              {assignments.map((a) => {
                const expired = isPast(new Date(a.deadline));
                const locked = a.isPremium && !isPremiumActive;

                return (
                  <Link
                    key={a._id}
                    to={`/challenges/${a._id}`}
                    style={{ textDecoration: "none", display: "block", opacity: !a.accessible ? 0.4 : 1 }}
                  >
                    <div className="ch-card">
                      {/* Top: badges */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <DiffBadge d={a.difficulty} />
                        <div style={{ display: "flex", gap: 5 }}>
                          {locked && <span className="ch-badge">🔒 Premium</span>}
                        </div>
                      </div>

                      {/* Middle: title + desc */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", padding: "10px 0 0" }}>
                        <h3 className="ch-card-title">{a.title}</h3>
                        <p className="ch-card-desc">{a.description}</p>
                      </div>

                      {/* Bottom: tags + time */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {(a.tags || []).slice(0, 2).map((t) => (
                            <span key={t} className="ch-tag">{t}</span>
                          ))}
                        </div>
                        <span className="ch-card-time">
                          {expired
                            ? "Ended"
                            : formatDistanceToNow(new Date(a.deadline), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 40 }}>
                <button
                  className="ch-page-btn"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Prev
                </button>
                <span style={{
                  height: 38,
                  padding: "0 20px",
                  display: "inline-flex",
                  alignItems: "center",
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text1)",
                  border: "1.5px solid var(--border)",
                  opacity: 0.6,
                }}>
                  {page} / {pagination.totalPages}
                </span>
                <button
                  className="ch-page-btn"
                  disabled={page === pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}