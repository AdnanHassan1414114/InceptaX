import { useState, useEffect } from "react";
import adminApi from "../../services/adminApi";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get("/admin/stats")
      .then((res) => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = stats
    ? [
        { label: "Total Users", value: stats.totalUsers, icon: "◉", color: "#4f46e5" },
        { label: "Active Challenges", value: stats.totalAssignments, icon: "◈", color: "#06b6d4" },
        { label: "Total Submissions", value: stats.totalSubmissions, icon: "◎", color: "#10b981" },
        {
          label: "Pending Review",
          value: stats.submissionStatusBreakdown?.find((s) => s._id === "ai_evaluated")?.count ?? 0,
          icon: "◌",
          color: "#f59e0b",
        },
        {
          label: "Premium Users",
          value: (stats.planBreakdown?.find((p) => p._id === "ten_day")?.count ?? 0) +
                 (stats.planBreakdown?.find((p) => p._id === "monthly")?.count ?? 0),
          icon: "✦",
          color: "#a78bfa",
        },
      ]
    : [];

  return (
    <div className="page-enter">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-ix-white mb-1">Overview</h1>
        <p className="text-ix-muted text-sm">InceptaX platform at a glance</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array(5).fill(0).map((_, i) => <div key={i} className="ix-card h-24 skeleton" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
            {cards.map((c) => (
              <div key={c.label} className="ix-card p-5">
                <div className="text-lg mb-3 font-mono" style={{ color: c.color }}>{c.icon}</div>
                <div className="font-display font-bold text-2xl text-ix-white mb-1">{c.value}</div>
                <div className="text-xs text-ix-muted">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Plan breakdown */}
          {stats?.planBreakdown && (
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <div className="ix-card p-6">
                <h3 className="font-display font-semibold text-ix-white mb-4">Plan Distribution</h3>
                <div className="space-y-2">
                  {stats.planBreakdown.map((p) => (
                    <div key={p._id} className="flex items-center justify-between text-sm">
                      <span className="text-ix-muted capitalize">{p._id}</span>
                      <span className="font-mono text-ix-white">{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ix-card p-6">
                <h3 className="font-display font-semibold text-ix-white mb-4">Submission Status</h3>
                <div className="space-y-2">
                  {stats.submissionStatusBreakdown?.map((s) => (
                    <div key={s._id} className="flex items-center justify-between text-sm">
                      <span className="text-ix-muted capitalize">{s._id?.replace("_", " ")}</span>
                      <span className="font-mono text-ix-white">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick actions */}
      <div className="ix-card p-6">
        <h2 className="font-display font-semibold text-ix-white mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { label: "Review Pending Submissions", href: "/admin-portal/submissions", color: "#f59e0b" },
            { label: "Create New Challenge", href: "/admin-portal/challenges", color: "#4f46e5" },
            { label: "Send Email Blast", href: "/admin-portal/email", color: "#06b6d4" },
          ].map((a) => (
            <a key={a.label} href={a.href} className="ix-card p-4 block hover:border-ix-primary/40 transition-all">
              <div className="text-sm text-ix-white">{a.label}</div>
              <div className="mt-2 h-0.5 w-8 rounded-full" style={{ background: a.color }} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
