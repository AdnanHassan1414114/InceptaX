import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, isPast, differenceInHours } from "date-fns";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const TECH_FILTERS = [
  { id: "frontend",  label: "Frontend" },
  { id: "backend",   label: "Backend" },
  { id: "fullstack", label: "Fullstack" },
  { id: "aiml",      label: "AI / ML" },
  { id: "database",  label: "Database" },
  { id: "devops",    label: "DevOps" },
];

const SPECIAL_FILTERS = [
  { id: "new",       label: "New Arrival" },
  { id: "trending",  label: "Trending" },
  { id: "countdown", label: "Final Countdown" },
];

const DIFF_STYLES = {
  easy:   { color: "var(--emerald)", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.2)"  },
  medium: { color: "var(--amber)",   bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.2)"  },
  hard:   { color: "var(--red)",     bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)" },
};

export default function Challenges() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [pagination, setPagination]   = useState({ total: 0, totalPages: 1 });
  const [search, setSearch]           = useState("");
  const [diff, setDiff]               = useState(null);
  const [techFilter, setTechFilter]   = useState(null);
  const [special, setSpecial]         = useState(null);
  const [page, setPage]               = useState(1);
  const [isDark, setIsDark]           = useState(true);
  const limit = 9;

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.getAttribute("data-theme") !== "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const isPremiumActive =
    user?.plan !== "free" &&
    user?.planExpiresAt &&
    new Date() < new Date(user.planExpiresAt);

  const fetchAssignments = useCallback(() => {
    setLoading(true);
    const params = { page, limit };
    if (search)     params.search     = search;
    if (diff)       params.difficulty = diff;
    if (techFilter) params.tag        = techFilter;
    if (special === "new")       params.isNew     = true;
    if (special === "trending")  params.trending  = true;
    if (special === "countdown") params.countdown = true;
    api.get("/assignments", { params })
      .then((res) => {
        setAssignments(res.data.data.data || []);
        setPagination(res.data.data.pagination);
      })
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, [page, search, diff, techFilter, special]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const resetPage = () => setPage(1);

  const bdr  = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const bdr2 = isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.13)";

  const isNewCard       = (a) => a.createdAt && (Date.now() - new Date(a.createdAt)) < 1000 * 60 * 60 * 24 * 7;
  const isFinalCountdown = (a) => !isPast(new Date(a.deadline)) && differenceInHours(new Date(a.deadline), new Date()) < 48;

  const DiffPill = ({ d }) => {
    const s = DIFF_STYLES[d?.toLowerCase()] || { color: "var(--text3)", bg: "transparent", border: bdr };
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        color: s.color, background: s.bg, border: `0.5px solid ${s.border}`,
        borderRadius: 100, padding: "2px 8px",
      }}>
        <span style={{ width: 4, height: 4, borderRadius: "50%", background: s.color }} />
        {d}
      </span>
    );
  };

  const SidebarSection = ({ title, children }) => (
    <div style={{ marginBottom: 28 }}>
      <p style={{
        fontSize: 9, fontWeight: 700, color: "var(--text3)",
        textTransform: "uppercase", letterSpacing: "1.8px",
        margin: "0 0 10px", padding: "0 16px",
      }}>{title}</p>
      {children}
    </div>
  );

  const SidebarBtn = ({ active, onClick, children }) => (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left",
      padding: "7px 16px", fontSize: 12.5, fontWeight: active ? 600 : 400,
      color: active ? "var(--text1)" : "var(--text2)",
      background: active ? (isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)") : "transparent",
      border: "none", borderRadius: 8, cursor: "pointer",
      transition: "background 0.15s, color 0.15s",
      borderLeft: active ? "2px solid var(--text1)" : "2px solid transparent",
    }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >{children}</button>
  );

  /* card glass surface */
  const cardGlass = {
    background:     isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border:         "none",
    borderRadius:   14,
    padding:        "16px",
    textDecoration: "none",
    color:          "inherit",
    display:        "flex",
    flexDirection:  "column",
    aspectRatio:    "4 / 3",          /* shorter square — 4:3 ratio */
    position:       "relative",
    overflow:       "hidden",
    transition:     "background 0.15s, transform 0.15s, box-shadow 0.15s",
    boxShadow:      isDark
      ? "0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 20px rgba(0,0,0,0.3)"
      : "0 1px 0 rgba(255,255,255,0.9) inset, 0 4px 20px rgba(0,0,0,0.08)",
  };

  return (
    <div className="page-enter" style={{
      display: "flex", minHeight: "100vh",
      background: isDark
        ? "radial-gradient(ellipse at 15% 10%, rgba(139,92,246,0.08) 0%, transparent 45%), radial-gradient(ellipse at 85% 80%, rgba(34,211,238,0.05) 0%, transparent 45%), var(--bg)"
        : "radial-gradient(ellipse at 15% 10%, rgba(139,92,246,0.04) 0%, transparent 45%), var(--bg)",
    }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 210, flexShrink: 0,
        background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: `0.5px solid ${bdr}`,
        padding: "40px 0",
        position: "sticky", top: 0, height: "100vh", overflowY: "auto",
      }}>
        <div style={{ padding: "0 16px", marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text1)", margin: 0, letterSpacing: "-0.2px" }}>
            Filters
          </p>
        </div>

        <SidebarSection title="Difficulty">
          <SidebarBtn active={!diff} onClick={() => { setDiff(null); resetPage(); }}>All levels</SidebarBtn>
          {["easy", "medium", "hard"].map((d) => {
            const s = DIFF_STYLES[d];
            return (
              <button key={d} onClick={() => { setDiff(diff === d ? null : d); resetPage(); }} style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", textAlign: "left", padding: "7px 16px", fontSize: 12.5,
                fontWeight: diff === d ? 600 : 400,
                color: diff === d ? s.color : "var(--text2)",
                background: diff === d ? s.bg : "transparent",
                border: "none", borderRadius: 8, cursor: "pointer",
                borderLeft: diff === d ? `2px solid ${s.color}` : "2px solid transparent",
                transition: "all 0.15s",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            );
          })}
        </SidebarSection>

        <div style={{ height: "0.5px", background: bdr, margin: "0 16px 24px" }} />

        <SidebarSection title="Tech Stack">
          {TECH_FILTERS.map((t) => (
            <SidebarBtn key={t.id} active={techFilter === t.id}
              onClick={() => { setTechFilter(techFilter === t.id ? null : t.id); resetPage(); }}>
              {t.label}
            </SidebarBtn>
          ))}
        </SidebarSection>

        <div style={{ height: "0.5px", background: bdr, margin: "0 16px 24px" }} />

        <SidebarSection title="Discover">
          {SPECIAL_FILTERS.map((s) => (
            <SidebarBtn key={s.id} active={special === s.id}
              onClick={() => { setSpecial(special === s.id ? null : s.id); resetPage(); }}>
              {s.label}
            </SidebarBtn>
          ))}
        </SidebarSection>

        {(diff || techFilter || special) && (
          <div style={{ padding: "0 16px" }}>
            <button onClick={() => { setDiff(null); setTechFilter(null); setSpecial(null); setSearch(""); resetPage(); }}
              style={{
                width: "100%", padding: "7px", fontSize: 11.5, color: "var(--text3)",
                background: "transparent", border: `0.5px solid ${bdr}`, borderRadius: 8, cursor: "pointer",
              }}>
              Clear filters
            </button>
          </div>
        )}
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: "40px 32px", minWidth: 0 }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text1)", margin: "0 0 5px", letterSpacing: "-0.5px" }}>
            Challenges
          </h1>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>
            Build real-world projects, get AI feedback, climb the leaderboard.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <input className="ix-input" style={{ width: 300, height: 36 }}
            placeholder="Search challenges, tags, tech stack…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          />
          {!loading && (
            <span style={{ fontSize: 12, color: "var(--text3)" }}>
              {pagination.total || assignments.length} results
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {Array(9).fill(0).map((_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: "4/3", borderRadius: 14 }} />
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div style={{
            ...cardGlass, aspectRatio: "unset",
            padding: "60px 0", textAlign: "center", color: "var(--text3)", fontSize: 13,
          }}>
            No challenges match your filters
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {assignments.map((a) => {
                const expired   = isPast(new Date(a.deadline));
                const locked    = a.isPremium && !isPremiumActive;
                const newCard   = isNewCard(a);
                const countdown = isFinalCountdown(a);

                return (
                  <Link
                    key={a._id}
                    to={`/challenges/${a._id}`}
                    style={{ ...cardGlass, opacity: !a.accessible ? 0.4 : 1 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background  = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.85)";
                      e.currentTarget.style.transform   = "translateY(-2px)";
                      e.currentTarget.style.boxShadow   = isDark
                        ? "0 1px 0 rgba(255,255,255,0.08) inset, 0 12px 32px rgba(0,0,0,0.4)"
                        : "0 1px 0 rgba(255,255,255,0.95) inset, 0 12px 32px rgba(0,0,0,0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background  = isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)";
                      e.currentTarget.style.transform   = "translateY(0)";
                      e.currentTarget.style.boxShadow   = isDark
                        ? "0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 20px rgba(0,0,0,0.3)"
                        : "0 1px 0 rgba(255,255,255,0.9) inset, 0 4px 20px rgba(0,0,0,0.08)";
                    }}
                  >
                    {/* Premium left accent */}
                    {a.isPremium && (
                      <div style={{
                        position: "absolute", left: 0, top: 0, bottom: 0, width: 2.5,
                        background: "linear-gradient(to bottom, #fbbf24, rgba(251,191,36,0.1))",
                        borderRadius: "14px 0 0 14px",
                      }} />
                    )}

                    {/* Row 1: diff + badges */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                        <DiffPill d={a.difficulty} />
                        {newCard && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                            color: "var(--cyan)", background: "rgba(34,211,238,0.1)",
                            border: "0.5px solid rgba(34,211,238,0.2)", borderRadius: 100, padding: "2px 7px",
                          }}>New</span>
                        )}
                        {countdown && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                            color: "var(--red)", background: "rgba(248,113,113,0.1)",
                            border: "0.5px solid rgba(248,113,113,0.2)", borderRadius: 100, padding: "2px 7px",
                          }}>Ending soon</span>
                        )}
                        {locked && <span className="premium-badge">Premium</span>}
                      </div>
                      <span style={{
                        fontSize: 10.5,
                        color: expired ? "var(--red)" : "var(--text3)",
                        opacity: expired ? 0.8 : 1,
                        whiteSpace: "nowrap",
                      }}>
                        {expired ? "Ended" : formatDistanceToNow(new Date(a.deadline), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Row 2: title */}
                    <h3 style={{
                      fontSize: 13.5, fontWeight: 700, color: "var(--text1)",
                      margin: "0 0 6px", letterSpacing: "-0.3px", lineHeight: 1.3,
                    }}>
                      {a.title}
                    </h3>

                    {/* Row 3: description */}
                    <p style={{
                      fontSize: 12, color: "var(--text2)", margin: 0,
                      lineHeight: 1.65, flex: 1,
                      display: "-webkit-box", WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {a.description}
                    </p>

                    {/* Row 4: tags pinned to bottom */}
                    {(a.tags || []).length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "auto", paddingTop: 12 }}>
                        {(a.tags || []).slice(0, 3).map((t) => (
                          <span key={t} style={{
                            fontSize: 10, color: "var(--text3)",
                            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                            borderRadius: 6, padding: "2px 7px",
                            whiteSpace: "nowrap", fontFamily: "monospace",
                          }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            {pagination.totalPages > 1 && (
              <>
                <div className="glow-line" style={{ marginTop: 32, marginBottom: 16, maxWidth: "100%" }} />
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  <button className="btn-ghost" style={{ fontSize: 12, padding: "6px 16px" }}
                    disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    ← Prev
                  </button>
                  <span style={{
                    fontSize: 12, color: "var(--text3)", padding: "6px 14px",
                    border: `0.5px solid ${bdr}`, borderRadius: 9,
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                  }}>
                    {page} / {pagination.totalPages}
                  </span>
                  <button className="btn-ghost" style={{ fontSize: 12, padding: "6px 16px" }}
                    disabled={page === pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}>
                    Next →
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}