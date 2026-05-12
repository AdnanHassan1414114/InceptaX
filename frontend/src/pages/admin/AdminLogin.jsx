import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import toast from "react-hot-toast";

export default function AdminLogin() {
  const { loginAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginAdmin(form.email, form.password);
      toast.success("Welcome, Admin");
      navigate("/admin-portal");
    } catch (err) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#02020a" }}>
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg,#1e1e4e,#2d2d6e)", border: "1px solid #2d2d6e" }}
          >
            <svg className="w-6 h-6 text-ix-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="font-display font-bold text-xl text-ix-white mb-1">Admin Portal</h1>
          <p className="text-xs text-ix-muted font-mono">InceptaX · Restricted Access</p>
        </div>

        <div className="ix-card p-7" style={{ borderColor: "#1e1e4e" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="ix-label">Admin Email</label>
              <input
                className="ix-input"
                type="email"
                placeholder="admin@inceptax.io"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="ix-label">Password</label>
              <input
                className="ix-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-display font-semibold text-sm text-white transition-all"
              style={{
                background: "linear-gradient(135deg,#2d2d6e,#4f46e5)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Authenticating..." : "Enter Portal →"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ix-muted mt-4">
          Not an admin?{" "}
          <a href="/" className="text-ix-primary hover:underline">
            Return to InceptaX
          </a>
        </p>
      </div>
    </div>
  );
}