import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import adminApi from "../../services/adminApi";

const STATUS_COLORS = {
  pending: "text-ix-muted border-ix-border",
  ai_evaluated: "text-amber-400 border-amber-500/30 bg-amber-500/5",
  admin_reviewed: "text-blue-400 border-blue-500/30 bg-blue-500/5",
  published: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
  rejected: "text-red-400 border-red-500/30 bg-red-500/5",
};

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [reviewForm, setReviewForm] = useState({ adminScore: "", adminNotes: "", status: "published" });
  const [actionLoading, setActionLoading] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });

  const fetchSubmissions = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 15 };
    if (filter !== "all") params.status = filter;
    adminApi.get("/admin/submissions", { params })
      .then((res) => {
        setSubmissions(res.data.data.data || []);
        setPagination(res.data.data.pagination || { totalPages: 1, total: 0 });
      })
      .catch(() => toast.error("Failed to load submissions"))
      .finally(() => setLoading(false));
  }, [page, filter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const triggerAI = async (id) => {
    setActionLoading(id + "_ai");
    try {
      const res = await adminApi.post(`/admin/submissions/${id}/ai-evaluate`);
      toast.success("AI evaluation complete!");
      // Update local state
      setSubmissions((prev) => prev.map((s) =>
        s._id === id ? { ...s, ...res.data.data.submission } : s
      ));
    } catch (err) {
      toast.error(err.response?.data?.message || "AI evaluation failed");
    } finally {
      setActionLoading(null);
    }
  };

  const openReview = (sub) => {
    setSelected(sub);
    setReviewForm({ adminScore: sub.adminScore || "", adminNotes: sub.adminNotes || "", status: "published" });
  };

  const submitReview = async () => {
    if (!reviewForm.adminScore || reviewForm.adminScore < 0 || reviewForm.adminScore > 100) {
      return toast.error("Score must be 0–100");
    }
    setActionLoading("review");
    try {
      const res = await adminApi.patch(`/admin/submissions/${selected._id}/review`, {
        adminScore: Number(reviewForm.adminScore),
        adminNotes: reviewForm.adminNotes,
        status: reviewForm.status,
      });
      toast.success(`Submission ${reviewForm.status === "published" ? "published" : "rejected"}!`);
      setSelected(null);
      setSubmissions((prev) => prev.map((s) =>
        s._id === selected._id ? { ...s, ...res.data.data.submission } : s
      ));
    } catch (err) {
      toast.error(err.response?.data?.message || "Review failed");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ix-white">Submissions</h1>
          <p className="text-ix-muted text-sm">{pagination.total} total submissions</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap mb-5">
        {["all", "pending", "ai_evaluated", "admin_reviewed", "published", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs capitalize transition-all ${filter === s ? "bg-ix-primary text-white" : "border border-ix-border text-ix-muted hover:text-ix-text"}`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array(8).fill(0).map((_, i) => <div key={i} className="ix-card h-16 skeleton" />)}</div>
      ) : (
        <>
          <div className="ix-card divide-y divide-ix-border overflow-hidden mb-4">
            {submissions.length === 0 && (
              <div className="p-10 text-center text-ix-muted">No submissions found</div>
            )}
            {submissions.map((sub) => (
              <div key={sub._id} className="flex items-center gap-4 px-5 py-4 hover:bg-ix-card-hover transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-display font-semibold text-sm text-ix-white">
                      {sub.userId?.name}
                    </span>
                    <span className="text-ix-muted text-xs">·</span>
                    <span className="text-xs text-ix-text truncate">{sub.assignmentId?.title}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${STATUS_COLORS[sub.status]}`}>
                      {sub.status?.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[11px] text-ix-muted font-mono flex-wrap">
                    <a href={sub.repoLink} target="_blank" rel="noreferrer" className="hover:text-ix-text">GitHub →</a>
                    <span>{formatDistanceToNow(new Date(sub.createdAt), { addSuffix: true })}</span>
                    {sub.aiScore !== null && <span>AI: {sub.aiScore}</span>}
                    {sub.adminScore !== null && <span>Admin: {sub.adminScore}</span>}
                    {sub.finalScore !== null && <span className="text-ix-white">Final: {sub.finalScore}</span>}
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  {sub.status === "pending" && (
                    <button
                      onClick={() => triggerAI(sub._id)}
                      disabled={actionLoading === sub._id + "_ai"}
                      className="btn-ghost text-xs px-3 py-1.5"
                    >
                      {actionLoading === sub._id + "_ai" ? "Running…" : "Run AI"}
                    </button>
                  )}
                  {sub.status === "ai_evaluated" && (
                    <button onClick={() => openReview(sub)} className="btn-primary text-xs px-3 py-1.5">
                      Review
                    </button>
                  )}
                  {(sub.status === "admin_reviewed" || sub.status === "published") && (
                    <button onClick={() => openReview(sub)} className="btn-ghost text-xs px-3 py-1.5">
                      Edit Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-3">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost text-sm disabled:opacity-30">← Prev</button>
              <span className="text-sm text-ix-muted font-mono self-center">{page} / {pagination.totalPages}</span>
              <button disabled={page === pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="btn-ghost text-sm disabled:opacity-30">Next →</button>
            </div>
          )}
        </>
      )}

      {/* Review Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="ix-card p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-ix-white">Review Submission</h2>
              <button onClick={() => setSelected(null)} className="text-ix-muted hover:text-ix-text">✕</button>
            </div>

            <div className="mb-4 p-3 bg-ix-surface rounded-xl border border-ix-border text-sm">
              <p className="text-ix-white font-semibold">{selected.userId?.name}</p>
              <p className="text-ix-muted">{selected.assignmentId?.title}</p>
              {selected.aiScore !== null && (
                <div className="mt-2">
                  <p className="text-xs text-ix-muted font-mono">AI Score: <span className="text-ix-white">{selected.aiScore}</span></p>
                  {selected.aiFeedback?.strengths?.map((s, i) => (
                    <p key={i} className="text-xs text-emerald-400 mt-0.5">✓ {s}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="ix-label">Admin Score (0–100) *</label>
                <input
                  className="ix-input"
                  type="number"
                  min={0}
                  max={100}
                  value={reviewForm.adminScore}
                  onChange={(e) => setReviewForm({ ...reviewForm, adminScore: e.target.value })}
                />
              </div>
              <div>
                <label className="ix-label">Admin Notes</label>
                <textarea
                  className="ix-input resize-none"
                  rows={3}
                  placeholder="Feedback for the submitter…"
                  value={reviewForm.adminNotes}
                  onChange={(e) => setReviewForm({ ...reviewForm, adminNotes: e.target.value })}
                />
              </div>
              <div>
                <label className="ix-label">Action</label>
                <div className="flex gap-2">
                  {["published", "admin_reviewed", "rejected"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setReviewForm({ ...reviewForm, status: s })}
                      className={`flex-1 py-2 rounded-xl text-xs capitalize transition-all ${reviewForm.status === s ? "bg-ix-primary text-white" : "border border-ix-border text-ix-muted"}`}
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={submitReview}
                disabled={actionLoading === "review"}
                className="btn-primary w-full py-3"
              >
                {actionLoading === "review" ? "Saving…" : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
