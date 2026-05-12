import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export default function Leaderboard() {
  const { user } = useAuth();
  const [board, setBoard] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.get("/leaderboard", { params: { page, limit: 20 } })
      .then((res) => { setBoard(res.data.data.data || []); setPagination(res.data.data.pagination); })
      .catch(() => setBoard([]))
      .finally(() => setLoading(false));
  }, [page]);

  const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const myEntry = board.find((e) => e.user?.username === user?.username);

  return (
    <div className="page-enter" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 26, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.6px", margin: "0 0 8px" }}>Global Rankings</h1>
        <p style={{ fontSize: 13, color: "var(--text2)" }}>Ranked by total score across all published challenges</p>
        {myEntry && (
          <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text2)", border: "0.5px solid var(--border2)", background: "var(--bg2)", borderRadius: 100, padding: "5px 16px", fontFamily: "monospace" }}>
            Your rank: #{myEntry.rank} · Total: {myEntry.totalScore}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array(10).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 14 }} />)}
        </div>
      ) : board.length === 0 ? (
        <div className="ix-card" style={{ padding: "48px", textAlign: "center", color: "var(--text2)" }}>No rankings yet — be the first to publish!</div>
      ) : (
        <>
          {/* Top 3 podium */}
          {page === 1 && board.length >= 3 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 24 }}>
              {board.slice(0, 3).map((e) => {
                const avatar = e.user?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${e.user?.name}&backgroundColor=111111&textColor=ffffff`;
                return (
                  <div key={e.userId} className="ix-card" style={{ padding: "20px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{MEDALS[e.rank]}</div>
                    <img src={avatar} style={{ width: 36, height: 36, borderRadius: 9, margin: "0 auto 8px" }} alt="" />
                    <Link to={`/u/${e.user?.username}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.user?.name}
                    </Link>
                    <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.5px", marginTop: 4 }}>{e.totalScore}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{e.submissions} submission{e.submissions !== 1 ? "s" : ""}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full table */}
          <div className="ix-card" style={{ overflow: "hidden" }}>
            {board.map((entry, i) => {
              const isMe = entry.user?.username === user?.username;
              const avatar = entry.user?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${entry.user?.name}&backgroundColor=111111&textColor=ffffff`;
              return (
                <div
                  key={entry.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderTop: i > 0 ? "0.5px solid var(--border)" : "none",
                    background: isMe ? "var(--bg3)" : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text3)", width: 28, flexShrink: 0 }}>
                    {MEDALS[entry.rank] || `#${entry.rank}`}
                  </span>
                  <img src={avatar} style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0 }} alt="" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/u/${entry.user?.username}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.user?.name}
                    </Link>
                    <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)", margin: 0 }}>
                      @{entry.user?.username} · {entry.submissions} submission{entry.submissions !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text1)" }}>{entry.totalScore}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>Best: {entry.bestScore}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {pagination.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 24 }}>
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost" style={{ fontSize: 12, opacity: page === 1 ? 0.3 : 1 }}>← Prev</button>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)" }}>{page} / {pagination.totalPages}</span>
              <button disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="btn-ghost" style={{ fontSize: 12, opacity: page === pagination.totalPages ? 0.3 : 1 }}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}