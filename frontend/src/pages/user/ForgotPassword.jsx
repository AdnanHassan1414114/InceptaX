import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";

export default function ForgotPassword() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

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
          {submitted ? (
            /* ── Success state ── */
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>📬</div>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: "var(--text1)", margin: "0 0 10px" }}>
                Check your inbox
              </h2>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, margin: "0 0 20px" }}>
                If an account with <strong style={{ color: "var(--text1)" }}>{email}</strong> exists,
                we've sent a password reset link. It expires in 1 hour.
              </p>
              <p style={{ fontSize: 12, color: "var(--text3)", margin: "0 0 20px" }}>
                Didn't receive it? Check your spam folder.
              </p>
              <Link to="/login" className="btn-ghost" style={{ fontSize: 13, display: "inline-flex" }}>
                ← Back to Sign in
              </Link>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: "var(--text1)", margin: "0 0 6px" }}>
                Forgot your password?
              </h2>
              <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 22px", lineHeight: 1.6 }}>
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="ix-label">Email address</label>
                  <input
                    className="ix-input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: "100%", padding: "10px", opacity: loading ? 0.6 : 1 }}
                >
                  {loading ? "Sending…" : "Send Reset Link →"}
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