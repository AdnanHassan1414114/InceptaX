import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import adminApi from "../../services/adminApi";

const PLAN_COLORS = {
  free: "text-ix-muted border-ix-border",
  ten_day: "text-cyan-400 border-cyan-500/30 bg-cyan-500/5",
  monthly: "text-amber-400 border-amber-500/30 bg-amber-500/5",
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  const [planModal, setPlanModal] = useState(null); // { user }
  const [newPlan, setNewPlan] = useState("free");
  const [updatingPlan, setUpdatingPlan] = useState(false);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 15 };
    if (search) params.search = search;
    if (planFilter) params.plan = planFilter;

    adminApi.get("/admin/users", { params })
      .then((res) => {
        setUsers(res.data.data.data || []);
        setPagination(res.data.data.pagination || { totalPages: 1, total: 0 });
      })
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, [page, search, planFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openPlanModal = (user) => {
    setPlanModal(user);
    setNewPlan(user.plan);
  };

  const grantPlan = async () => {
    if (!planModal) return;
    setUpdatingPlan(true);
    try {
      const res = await adminApi.patch(`/admin/users/${planModal._id}/plan`, { plan: newPlan });
      toast.success(`Plan updated to ${newPlan}`);
      setUsers((prev) => prev.map((u) =>
        u._id === planModal._id ? { ...u, ...res.data.data.user } : u
      ));
      setPlanModal(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setUpdatingPlan(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-ix-white">Users</h1>
          <p className="text-ix-muted text-sm">{pagination.total} registered users</p>
        </div>

        <div className="flex gap-2">
          <input
            className="ix-input w-56"
            placeholder="Search name, email, username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="ix-input w-36"
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          >
            <option value="">All plans</option>
            <option value="free">Free</option>
            <option value="ten_day">Sprint</option>
            <option value="monthly">Pro</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array(8).fill(0).map((_, i) => <div key={i} className="ix-card h-14 skeleton" />)}</div>
      ) : (
        <>
          <div className="ix-card overflow-hidden mb-4">
            {/* Header */}
            <div className="grid grid-cols-12 px-5 py-2 border-b border-ix-border bg-ix-surface text-[11px] font-mono text-ix-muted uppercase tracking-wider">
              <div className="col-span-4">User</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Plan</div>
              <div className="col-span-2">Joined</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            <div className="divide-y divide-ix-border">
              {users.map((u) => {
                const isPremiumActive = u.plan !== "free" && u.planExpiresAt && new Date() < new Date(u.planExpiresAt);
                return (
                  <div key={u._id} className="grid grid-cols-12 px-5 py-3 hover:bg-ix-card-hover transition-colors items-center">
                    <div className="col-span-4">
                      <p className="text-sm text-ix-white font-semibold">{u.name}</p>
                      <p className="text-xs text-ix-muted font-mono">@{u.username}</p>
                    </div>
                    <div className="col-span-3 text-xs text-ix-text truncate">{u.email}</div>
                    <div className="col-span-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${PLAN_COLORS[u.plan]}`}>
                        {u.plan === "free" ? "Free" : u.plan === "ten_day" ? "Sprint" : "Pro"}
                      </span>
                      {isPremiumActive && u.planExpiresAt && (
                        <p className="text-[10px] text-ix-muted mt-0.5">
                          until {format(new Date(u.planExpiresAt), "MMM d")}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 text-xs text-ix-muted font-mono">
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => openPlanModal(u)}
                        className="text-xs text-ix-primary hover:underline font-mono"
                      >
                        Plan ↑
                      </button>
                    </div>
                  </div>
                );
              })}
              {users.length === 0 && (
                <div className="p-10 text-center text-ix-muted">No users found</div>
              )}
            </div>
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

      {/* Plan modal */}
      {planModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="ix-card p-7 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-ix-white">Update Plan</h2>
              <button onClick={() => setPlanModal(null)} className="text-ix-muted hover:text-ix-text">✕</button>
            </div>

            <p className="text-sm text-ix-text mb-4">
              {planModal.name} <span className="text-ix-muted">(@{planModal.username})</span>
            </p>

            <div className="space-y-2 mb-5">
              {["free", "ten_day", "monthly"].map((p) => (
                <button
                  key={p}
                  onClick={() => setNewPlan(p)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all border ${newPlan === p ? "bg-ix-primary/15 border-ix-primary text-ix-white" : "border-ix-border text-ix-muted hover:text-ix-text"}`}
                >
                  <span className="font-semibold capitalize">{p === "ten_day" ? "10-Day Sprint" : p === "monthly" ? "Monthly Pro" : "Free"}</span>
                  {p === "ten_day" && <span className="text-xs text-ix-muted ml-2">(10 days)</span>}
                  {p === "monthly" && <span className="text-xs text-ix-muted ml-2">(30 days)</span>}
                </button>
              ))}
            </div>

            <button
              onClick={grantPlan}
              disabled={updatingPlan}
              className="btn-primary w-full py-3"
            >
              {updatingPlan ? "Updating…" : "Grant Plan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
