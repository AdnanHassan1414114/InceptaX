import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function ProjectLeaderboard() {
  const { id } = useParams();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [board, setBoard] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/assignments/${id}`),
      api.get(`/leaderboard/assignment/${id}`, { params: { page, limit: 20 } }),
    ])
      .then(([aRes, lRes]) => {
        setAssignment(aRes.data.data.assignment);
        setBoard(lRes.data.data.data || []);
        setPagination(lRes.data.data.pagination);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, page]);

  const myEntry = board.find((e) => e.submission?.userId?.username === user?.username);

  if (loading) return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px" }}>
      <div className="skeleton" style={{ height: 56, borderRadius: 14, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
    </div>
  );

  return (
    <div className="page-enter" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px" }}>
      <Link to={`/challenges/${id}`} style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text2)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}>
        ← {assignment?.title || "Challenge"}
      </Link>

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.4px", margin: "0 0 6px" }}>{assignment?.title}</h1>
        <p style={{ fontSize: 13, color: "var(--text2)" }}>Challenge Leaderboard · {pagination.total} submissions</p>
        {myEntry && (
          <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text2)", border: "0.5px solid var(--border2)", background: "var(--bg2)", borderRadius: 100, padding: "5px 16px", fontFamily: "monospace" }}>
            Your rank: #{myEntry.rank} · Score: {myEntry.submission?.finalScore}
          </div>
        )}
      </div>

      {board.length === 0 ? (
        <div className="ix-card" style={{ padding: "48px", textAlign: "center", color: "var(--text2)" }}>No published submissions yet</div>
      ) : (
        <>
          {/* Top 3 */}
          {page === 1 && board.length >= 3 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
              {board.slice(0, 3).map((e) => {
                const u = e.submission?.userId;
                const avatar = u?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${u?.name}&backgroundColor=111111&textColor=ffffff`;
                return (
                  <div key={e.submission?._id} className="ix-card" style={{ padding: "18px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, marginBottom: 8 }}>{MEDALS[e.rank]}</div>
                    <img src={avatar} style={{ width: 32, height: 32, borderRadius: 8, margin: "0 auto 8px" }} alt="" />
                    <Link to={`/u/${u?.username}`} style={{ fontSize: 12, fontWeight: 500, color: "var(--text1)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.name}</Link>
                    <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text1)", marginTop: 4 }}>{e.submission?.finalScore}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table */}
          <div className="ix-card" style={{ overflow: "hidden" }}>
            {board.map((entry, i) => {
              const u = entry.submission?.userId;
              const isMe = u?.username === user?.username;
              const avatar = u?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${u?.name}&backgroundColor=111111&textColor=ffffff`;
              return (
                <div
                  key={entry.submission?._id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderTop: i > 0 ? "0.5px solid var(--border)" : "none",
                    background: isMe ? "var(--bg3)" : "transparent",
                  }}
                >
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text3)", width: 28, flexShrink: 0 }}>
                    {MEDALS[entry.rank] || `#${entry.rank}`}
                  </span>
                  <img src={avatar} style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0 }} alt="" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link to={`/u/${u?.username}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.name}</Link>
                    <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)", margin: 0 }}>@{u?.username}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text1)" }}>{entry.submission?.finalScore}</div>
                    <Link to={`/submissions/${entry.submission?._id}`} style={{ fontSize: 10, color: "var(--text2)", textDecoration: "none" }}>View →</Link>
                  </div>
                </div>
              );
            })}
          </div>

          {pagination.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 20 }}>
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