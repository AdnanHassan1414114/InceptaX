import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import adminApi from "../../services/adminApi";

const EMPTY = {
  title: "", description: "", difficulty: "easy", deadline: "",
  tags: "", isPremium: false, requiredPlan: "free", prize: "", coverImage: "",
};

export default function AdminChallenges() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1 });

  const fetchAssignments = useCallback(() => {
    setLoading(true);
    adminApi.get("/assignments", { params: { page, limit: 10 } })
      .then((res) => {
        setAssignments(res.data.data.data || []);
        setPagination(res.data.data.pagination || { totalPages: 1 });
      })
      .catch(() => toast.error("Failed to load challenges"))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const openNew = () => { setForm(EMPTY); setEditId(null); setShowForm(true); };
  const openEdit = (a) => {
    setForm({
      ...a,
      deadline: a.deadline ? a.deadline.slice(0, 10) : "",
      tags: (a.tags || []).join(", "),
    });
    setEditId(a._id);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editId) {
        await adminApi.put(`/admin/assignments/${editId}`, payload);
        toast.success("Challenge updated!");
      } else {
        await adminApi.post("/admin/assignments", payload);
        toast.success("Challenge created!");
      }
      setShowForm(false);
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this challenge?")) return;
    try {
      await adminApi.delete(`/admin/assignments/${id}`);
      toast.success("Challenge deleted");
      fetchAssignments();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ix-white">Challenges</h1>
          <p className="text-ix-muted text-sm">Manage all challenge assignments</p>
        </div>
        <button onClick={openNew} className="btn-primary text-sm">+ New Challenge</button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="ix-card h-16 skeleton" />)}</div>
      ) : (
        <>
          <div className="ix-card divide-y divide-ix-border overflow-hidden mb-4">
            {assignments.length === 0 && (
              <div className="p-10 text-center text-ix-muted">No challenges yet</div>
            )}
            {assignments.map((a) => {
              const expired = new Date() > new Date(a.deadline);
              return (
                <div key={a._id} className="flex items-center gap-4 px-5 py-4 hover:bg-ix-card-hover transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-display font-semibold text-sm text-ix-white">{a.title}</span>
                      <span className={`badge-${a.difficulty}`}>{a.difficulty}</span>
                      {a.isPremium && <span className="text-[10px] font-mono text-amber-400 border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 rounded-full">Premium</span>}
                      {expired && <span className="text-[10px] font-mono text-red-400 border border-red-500/30 bg-red-500/5 px-2 py-0.5 rounded-full">Ended</span>}
                      {!a.isActive && <span className="text-[10px] font-mono text-ix-muted border border-ix-border px-2 py-0.5 rounded-full">Deleted</span>}
                    </div>
                    <p className="text-xs text-ix-muted font-mono">
                      Deadline: {format(new Date(a.deadline), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(a)} className="btn-ghost text-xs px-3 py-1.5">Edit</button>
                    <button onClick={() => handleDelete(a._id)} className="text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors">Delete</button>
                  </div>
                </div>
              );
            })}
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

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="ix-card p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-ix-white">{editId ? "Edit Challenge" : "New Challenge"}</h2>
              <button onClick={() => setShowForm(false)} className="text-ix-muted hover:text-ix-text">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="ix-label">Title *</label>
                <input className="ix-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div>
                <label className="ix-label">Description *</label>
                <textarea className="ix-input resize-none" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ix-label">Difficulty *</label>
                  <select className="ix-input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                    {["easy", "medium", "hard"].map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="ix-label">Required Plan</label>
                  <select className="ix-input" value={form.requiredPlan} onChange={(e) => setForm({ ...form, requiredPlan: e.target.value })}>
                    {["free", "ten_day", "monthly"].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="ix-label">Deadline *</label>
                <input className="ix-input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required />
              </div>
              <div>
                <label className="ix-label">Tags (comma-separated)</label>
                <input className="ix-input" placeholder="react, ui, api" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div>
                <label className="ix-label">Prize</label>
                <input className="ix-input" placeholder="₹5000 cash + certificate" value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} />
              </div>
              <div>
                <label className="ix-label">Cover Image URL</label>
                <input className="ix-input" type="url" placeholder="https://..." value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input id="isPremium" type="checkbox" checked={form.isPremium} onChange={(e) => setForm({ ...form, isPremium: e.target.checked })} className="rounded" />
                <label htmlFor="isPremium" className="text-sm text-ix-text">Premium Challenge</label>
              </div>

              <button type="submit" disabled={saving} className="btn-primary w-full py-3">
                {saving ? "Saving…" : editId ? "Save Changes" : "Create Challenge"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
