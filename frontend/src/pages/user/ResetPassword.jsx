import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function ResetPassword() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get("token");

  const [form, setForm]       = useState({ password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [showPw, setShowPw]   = useState(false);

  // No token in URL → redirect to forgot-password
  useEffect(() => {
    if (!token) {
      toast.error("Invalid or missing reset token.");
      navigate("/forgot-password", { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        password: form.password,
      });
      setDone(true);
      toast.success("Password reset successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div
      className="page-enter"
      style={{
        minHeight: "calc(100vh - 56px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 16px", background: "var(--bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--logo-bg)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <span style={{ color: "var(--logo-fg)", fontSize: 11, fontWeight: 600 }}>IX</span>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--text1)", margin: 0 }}>InceptaX</h1>
        </div>

        <div className="ix-card" style={{ padding: "28px 24px" }}>
          {done ? (
            /* ── Success state ── */
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: "var(--text1)", margin: "0 0 10px" }}>
                Password updated!
              </h2>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, margin: "0 0 22px" }}>
                Your password has been reset successfully. Sign in with your new password.
              </p>
              <Link to="/login" className="btn-primary" style={{ fontSize: 13, display: "inline-flex" }}>
                Sign in →
              </Link>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: "var(--text1)", margin: "0 0 6px" }}>
                Set a new password
              </h2>
              <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 22px", lineHeight: 1.6 }}>
                Choose a strong password — at least 8 characters.
              </p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* New password */}
                <div>
                  <label className="ix-label">New Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="ix-input"
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      autoFocus
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      style={{
                        position: "absolute", right: 10, top: "50%",
                        transform: "translateY(-50%)",
                        background: "none", border: "none",
                        cursor: "pointer", color: "var(--text3)",
                        fontSize: 11, fontFamily: "monospace",
                        padding: 0,
                      }}
                    >
                      {showPw ? "hide" : "show"}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {form.password.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      {[1, 2, 3, 4].map((i) => {
                        const len    = form.password.length;
                        const filled = len >= i * 2;
                        const color  = len < 6 ? "var(--red)"
                          : len < 10 ? "var(--amber)"
                          : "var(--emerald)";
                        return (
                          <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 2,
                            background: filled ? color : "var(--border2)",
                            transition: "background 0.2s",
                          }} />
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="ix-label">Confirm Password</label>
                  <input
                    className="ix-input"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                    required
                  />
                  {form.confirm.length > 0 && form.password !== form.confirm && (
                    <p style={{ fontSize: 11, color: "var(--red)", margin: "4px 0 0", fontFamily: "monospace" }}>
                      Passwords do not match
                    </p>
                  )}
                  {form.confirm.length > 0 && form.password === form.confirm && form.password.length >= 8 && (
                    <p style={{ fontSize: 11, color: "var(--emerald)", margin: "4px 0 0", fontFamily: "monospace" }}>
                      ✓ Passwords match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || form.password !== form.confirm || form.password.length < 8}
                  className="btn-primary"
                  style={{
                    width: "100%", padding: "10px",
                    opacity: loading || form.password !== form.confirm || form.password.length < 8 ? 0.5 : 1,
                  }}
                >
                  {loading ? "Resetting…" : "Reset Password →"}
                </button>
              </form>

              <div style={{ textAlign: "center", marginTop: 18 }}>
                <Link to="/login" style={{ fontSize: 12, color: "var(--text3)", textDecoration: "none" }}>
                  ← Back to Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}