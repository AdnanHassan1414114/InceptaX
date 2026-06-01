import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

// ─── OAuth provider config ────────────────────────────────────────────────────
const OAUTH_PROVIDERS = [
  {
    id:    "google",
    label: "Continue with Google",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id:    "github",
    label: "Continue with GitHub",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
];

// ─── OTP Input — 6 individual boxes ──────────────────────────────────────────
function OTPInput({ value, onChange, disabled }) {
  const inputs = useRef([]);

  const handleChange = (i, val) => {
    const cleaned = val.replace(/\D/g, "").slice(-1); // digits only, last char
    const arr     = value.split("");
    arr[i]        = cleaned;
    const next    = arr.join("");
    onChange(next);
    // Auto-advance
    if (cleaned && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (!value[i] && i > 0) {
        // Jump back if current is already empty
        const arr = value.split("");
        arr[i - 1] = "";
        onChange(arr.join(""));
        inputs.current[i - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft"  && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, "").slice(0, 6));
    // Focus last filled box
    const focusIdx = Math.min(pasted.length, 5);
    inputs.current[focusIdx]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "8px 0" }}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          style={{
            width:       42,
            height:      50,
            borderRadius: 10,
            border:      `1.5px solid ${value[i] ? "var(--border2)" : "var(--border)"}`,
            background:  value[i] ? "var(--bg3)" : "var(--bg2)",
            color:       "var(--text1)",
            fontSize:    22,
            fontWeight:  700,
            fontFamily:  "monospace",
            textAlign:   "center",
            outline:     "none",
            transition:  "border-color 0.15s, background 0.15s",
            caretColor:  "transparent",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--text1)";
            e.target.style.background  = "var(--bg3)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = value[i] ? "var(--border2)" : "var(--border)";
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Login component ─────────────────────────────────────────────────────
export default function Login() {
  const { registerWithEmail, verifyEmail, resendOTP, loginWithEmail } = useAuth();
  const navigate   = useNavigate();
  const [params]   = useSearchParams();
  const planParam  = params.get("plan");
  const errorParam = params.get("error");

  // "login" | "register" | "otp"
  const [mode, setMode] = useState("login");

  // Registration form fields
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "" });

  // OTP state
  const [otp, setOtp]             = useState("");
  const [pendingUserId, setPendingUserId] = useState(null);
  const [pendingEmail, setPendingEmail]   = useState("");

  // Resend cooldown (60s)
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const [loading, setLoading] = useState(false);

  // Show OAuth error toast
  useEffect(() => {
    if (errorParam) {
      const messages = {
        google_failed: "Google sign-in failed. Please try again.",
        github_failed: "GitHub sign-in failed. Ensure your GitHub email is public.",
        oauth_failed:  "OAuth sign-in failed. Please try again.",
      };
      toast.error(messages[errorParam] || "Sign-in failed.");
    }
  }, [errorParam]);

  // Clean up cooldown timer on unmount
  useEffect(() => () => clearInterval(cooldownRef.current), []);

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const redirect = (user) => {
    if (user?.role === "admin") return navigate("/admin");
    if (planParam) return navigate("/pricing");
    navigate("/dashboard");
  };

  // ── OAuth ──────────────────────────────────────────────────────────────────
  const handleOAuth = (provider) => {
    const apiBase    = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const serverBase = apiBase.replace(/\/api\/?$/, "");
    window.location.href = `${serverBase}/api/auth/${provider}`;
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (!form.username.trim())    { toast.error("Username is required"); return; }

    setLoading(true);
    try {
      const data = await registerWithEmail(form.email, form.password, form.name, form.username);
      setPendingUserId(data.userId);
      setPendingEmail(form.email);
      setOtp("");
      setMode("otp");
      startCooldown();
      toast.success("OTP sent to your email!");
    } catch (err) {
      const msg = err?.message || "Registration failed";
      // If unverified account exists, backend still returns userId
      if (err?.data?.userId) {
        setPendingUserId(err.data.userId);
        setPendingEmail(form.email);
        setOtp("");
        setMode("otp");
        startCooldown();
        toast.success("A new OTP has been sent to your email.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await loginWithEmail(form.email, form.password);
      toast.success("Welcome back!");
      redirect(user);
    } catch (err) {
      // EMAIL_NOT_VERIFIED — backend resent OTP, route to OTP step
      if (err?.message === "EMAIL_NOT_VERIFIED") {
        const userId = err?.errors?.[0]?.userId;
        setPendingUserId(userId);
        setPendingEmail(form.email);
        setOtp("");
        setMode("otp");
        startCooldown();
        toast("Please verify your email first — a new OTP has been sent.", { icon: "📬" });
      } else {
        toast.error(err?.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error("Please enter all 6 digits"); return; }

    setLoading(true);
    try {
      const user = await verifyEmail(pendingUserId, otp);
      toast.success("Email verified! Welcome to InceptaX 🚀");
      redirect(user);
    } catch (err) {
      const msg = err?.message || "Verification failed";
      toast.error(msg);
      // If too many attempts, clear OTP input
      if (msg.toLowerCase().includes("too many")) setOtp("");
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!pendingUserId || resendCooldown > 0) return;
    try {
      await resendOTP(pendingUserId);
      setOtp("");
      startCooldown();
      toast.success("New OTP sent!");
    } catch (err) {
      toast.error(err?.message || "Failed to resend OTP");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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

          {/* ── OTP Step ──────────────────────────────────────────────────── */}
          {mode === "otp" ? (
            <>
              {/* Back button */}
              <button
                onClick={() => { setMode("register"); setOtp(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 12, fontFamily: "monospace", padding: 0, marginBottom: 18, display: "flex", alignItems: "center", gap: 4 }}
              >
                ← Back
              </button>

              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text1)", margin: "0 0 6px", letterSpacing: "-0.3px" }}>
                Verify your email
              </h2>
              <p style={{ fontSize: 13, color: "var(--text2)", margin: "0 0 6px", lineHeight: 1.6 }}>
                We sent a 6-digit code to
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", fontFamily: "monospace", margin: "0 0 24px" }}>
                {pendingEmail}
              </p>

              <form onSubmit={handleVerifyOTP}>
                <OTPInput value={otp} onChange={setOtp} disabled={loading} />

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="btn-primary"
                  style={{ width: "100%", padding: "10px", marginTop: 20, opacity: loading || otp.length !== 6 ? 0.5 : 1 }}
                >
                  {loading ? "Verifying…" : "Verify Email →"}
                </button>
              </form>

              {/* Resend */}
              <div style={{ textAlign: "center", marginTop: 18 }}>
                <p style={{ fontSize: 12, color: "var(--text3)", margin: "0 0 6px" }}>
                  Didn't receive the code?
                </p>
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  style={{
                    background: "none", border: "none", cursor: resendCooldown > 0 ? "default" : "pointer",
                    fontSize: 12, fontFamily: "monospace",
                    color: resendCooldown > 0 ? "var(--text3)" : "var(--text1)",
                    padding: 0, textDecoration: resendCooldown > 0 ? "none" : "underline",
                  }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </button>
              </div>

              {/* OTP expiry notice */}
              <p style={{ fontSize: 11, color: "var(--text3)", textAlign: "center", margin: "14px 0 0", fontFamily: "monospace" }}>
                Code expires in 10 minutes
              </p>
            </>
          ) : (
            /* ── Login / Register Step ──────────────────────────────────── */
            <>
              {/* Tabs */}
              <div style={{ display: "flex", background: "var(--bg3)", border: "0.5px solid var(--border)", borderRadius: 9, padding: 3, marginBottom: 22 }}>
                {["login", "register"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 13, fontWeight: 500,
                      border: "none", cursor: "pointer", transition: "background 0.2s, color 0.2s",
                      background: mode === m ? "var(--btn-primary-bg)" : "transparent",
                      color:      mode === m ? "var(--btn-primary-fg)" : "var(--text2)",
                    }}
                  >
                    {m === "login" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              {/* OAuth buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {OAUTH_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleOAuth(p.id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 10, padding: "9px 14px", borderRadius: 9,
                      border: "0.5px solid var(--border2)", background: "var(--bg2)",
                      color: "var(--text1)", fontSize: 13, fontWeight: 500,
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg3)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg2)"}
                  >
                    {p.icon}
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
                <span style={{ fontSize: 11, color: "var(--text3)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  or with email
                </span>
                <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
              </div>

              {/* Email form */}
              <form
                onSubmit={mode === "register" ? handleRegister : handleLogin}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {mode === "register" && (
                  <>
                    <div>
                      <label className="ix-label">Full Name</label>
                      <input className="ix-input" type="text" placeholder="Alex Johnson" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div>
                      <label className="ix-label">Username</label>
                      <input className="ix-input" type="text" placeholder="alexjohnson" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} required />
                    </div>
                  </>
                )}

                <div>
                  <label className="ix-label">Email</label>
                  <input className="ix-input" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <label className="ix-label" style={{ margin: 0 }}>Password</label>
                    {mode === "login" && (
                      <Link
                        to="/forgot-password"
                        style={{ fontSize: 11, color: "var(--text3)", textDecoration: "none", fontFamily: "monospace" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "var(--text2)"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text3)"}
                      >
                        Forgot password?
                      </Link>
                    )}
                  </div>
                  <input className="ix-input" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: "100%", padding: "10px", opacity: loading ? 0.6 : 1 }}
                >
                  {loading
                    ? "Processing..."
                    : mode === "login"
                    ? "Sign in →"
                    : "Create account →"}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text3)", marginTop: 16 }}>
          Are you an admin?{" "}
          <Link to="/admin-portal/login" style={{ color: "var(--text2)" }}>Admin portal →</Link>
        </p>
      </div>
    </div>
  );
}