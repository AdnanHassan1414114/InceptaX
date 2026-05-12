import { useState } from "react";
import toast from "react-hot-toast";
import adminApi from "../../services/adminApi";

export default function AdminEmailBlast() {
  const [form, setForm] = useState({ subject: "", htmlBody: "", targetPlan: "" });
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!confirm(`Send to all ${form.targetPlan || "users"}? This cannot be undone.`)) return;

    setSending(true);
    try {
      const res = await adminApi.post("/admin/email/blast", {
        subject: form.subject,
        body: form.htmlBody,
        targetPlan: form.targetPlan || undefined,
      });
      const count = res.data.data.recipientCount;
      setResult({ count });
      toast.success(`Email queued for ${count} users`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Email blast failed");
    } finally {
      setSending(false);
    }
  };

  const templates = [
    {
      label: "New Challenge",
      subject: "New challenge is live 🚀",
      body: "<h2 style='color:#4f46e5'>New Challenge Live 🚀</h2><p>A brand-new challenge has been posted on InceptaX. Check it out and submit your project!</p><a href='https://inceptax.io/challenges' style='display:inline-block;padding:10px 20px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none'>View Challenge →</a>",
    },
    {
      label: "Upgrade Promo",
      subject: "Unlock premium challenges on InceptaX ✦",
      body: "<h2 style='color:#f59e0b'>Unlock Premium ✦</h2><p>Upgrade your plan to access exclusive challenges, team collaboration, and priority AI evaluation.</p><a href='https://inceptax.io/pricing' style='display:inline-block;padding:10px 20px;background:#f59e0b;color:#000;border-radius:8px;text-decoration:none'>Upgrade Now →</a>",
    },
    {
      label: "Results Published",
      subject: "Challenge results are live — check your rank!",
      body: "<h2 style='color:#10b981'>Results Are In 🏆</h2><p>The latest challenge results have been published. See where you stand on the leaderboard!</p><a href='https://inceptax.io/leaderboard' style='display:inline-block;padding:10px 20px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none'>View Leaderboard →</a>",
    },
  ];

  return (
    <div className="page-enter max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-ix-white">Email Blast</h1>
        <p className="text-ix-muted text-sm mt-0.5">Send emails directly to your user base</p>
      </div>

      {result && (
        <div className="ix-card p-4 border-emerald-500/30 bg-emerald-500/5 mb-6">
          <p className="text-emerald-400 font-display font-semibold text-sm">
            ✓ Email queued for {result.count} recipients
          </p>
        </div>
      )}

      <div className="ix-card p-7">
        <form onSubmit={handleSend} className="space-y-5">
          <div>
            <label className="ix-label">Target Audience</label>
            <select
              className="ix-input"
              value={form.targetPlan}
              onChange={(e) => setForm({ ...form, targetPlan: e.target.value })}
            >
              <option value="">All users</option>
              <option value="free">Free plan users only</option>
              <option value="ten_day">10-Day Sprint users</option>
              <option value="monthly">Monthly Pro users</option>
            </select>
          </div>

          <div>
            <label className="ix-label">Subject Line *</label>
            <input
              className="ix-input"
              placeholder="New challenges are live 🚀"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="ix-label mb-0">Email Body (HTML) *</label>
              <button
                type="button"
                onClick={() => setPreview(!preview)}
                className="text-xs text-ix-primary hover:underline"
              >
                {preview ? "Edit HTML" : "Preview"}
              </button>
            </div>

            {preview ? (
              <div
                className="ix-input min-h-[200px] overflow-auto bg-white text-black rounded-xl p-4"
                dangerouslySetInnerHTML={{ __html: form.htmlBody }}
              />
            ) : (
              <textarea
                className="ix-input font-mono text-xs"
                rows={8}
                value={form.htmlBody}
                onChange={(e) => setForm({ ...form, htmlBody: e.target.value })}
                required
              />
            )}
          </div>

          {/* Templates */}
          <div>
            <p className="ix-label">Quick Templates</p>
            <div className="flex gap-2 flex-wrap">
              {templates.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, subject: t.subject, htmlBody: t.body }))}
                  className="text-xs btn-ghost"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={sending} className="btn-primary w-full py-3">
            {sending ? "Sending…" : "Send Email Blast →"}
          </button>
        </form>
      </div>
    </div>
  );
}
