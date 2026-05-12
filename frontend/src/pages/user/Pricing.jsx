import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { format } from "date-fns";
import api from "../../services/api";
import toast from "react-hot-toast";

// ─── Plan definitions (matches backend PLAN_CONFIG) ───────────────────────────
const plans = [
  {
    id:       "free",
    name:     "Free",
    price:    0,
    period:   null,
    tag:      null,
    features: [
      "All public challenges",
      "AI evaluation (after admin review)",
      "Public portfolio at /u/username",
      "Global + per-project leaderboard",
    ],
    cta: "Get Started",
  },
  {
    id:       "ten_day",
    name:     "10-Day Sprint",
    price:    99,
    period:   "10 days",
    tag:      "Popular",
    features: [
      "Everything in Free",
      "All premium challenges",
      "Team collaboration (up to 3)",
      "Real-time team chat",
      "Priority evaluation",
    ],
    cta: "Start Sprint",
  },
  {
    id:       "monthly",
    name:     "Monthly Pro",
    price:    199,
    period:   "month",
    tag:      "Best Value",
    features: [
      "Everything in Sprint",
      "Unlimited team members",
      "Exclusive monthly challenges",
      "Pro badge on profile",
      "Early feature access",
    ],
    cta: "Go Pro",
  },
];

// ─── Load Razorpay checkout script ────────────────────────────────────────────
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) { resolve(true); return; }
    const script = document.createElement("script");
    script.id  = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Pricing() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Which plan button is currently processing (prevents double-clicks)
  const [processingPlan, setProcessingPlan] = useState(null);

  // Success state after payment
  const [successPlan, setSuccessPlan] = useState(null);

  const isPremiumActive =
    user?.plan !== "free" &&
    user?.planExpiresAt &&
    new Date() < new Date(user.planExpiresAt);

  // ── Pre-load Razorpay script when component mounts ──────────────────────
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  // ── Handle plan purchase ─────────────────────────────────────────────────
  const handleUpgrade = async (planId) => {
    // Not logged in → redirect to login with plan param
    if (!user) {
      navigate(`/login?plan=${planId}`);
      return;
    }

    if (processingPlan) return; // prevent double clicks
    setProcessingPlan(planId);

    try {
      // 1. Load Razorpay script (idempotent)
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Failed to load payment gateway. Please try again.");
        return;
      }

      // 2. Create order on backend
      const { data } = await api.post("/payment/create-order", { plan: planId });
      const order = data.data;

      // 3. Open Razorpay checkout
      await new Promise((resolve, reject) => {
        const options = {
          key:          order.key,
          amount:       order.amount,       // in paise
          currency:     order.currency,
          name:         "InceptaX",
          description:  `${order.planName} Plan`,
          order_id:     order.orderId,

          // Pre-fill user info
          prefill: {
            name:  order.user.name,
            email: order.user.email,
          },

          // Branding
          theme: {
            color: "#ffffff",
          },

          modal: {
            backdropclose: false,
            escape:        false,
            ondismiss:     () => {
              // User closed the modal without paying
              resolve({ dismissed: true });
            },
          },

          handler: async (response) => {
            // 4. Verify payment on backend
            try {
              const verifyRes = await api.post("/payment/verify", {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                plan:                planId,
              });

              // 5. Sync user in AuthContext
              await refreshUser();

              const planName = verifyRes.data.data.planName;
              const expiresAt = verifyRes.data.data.expiresAt;

              setSuccessPlan({ planId, planName, expiresAt });
              toast.success(`${planName} activated! 🎉`);
              resolve({ success: true });
            } catch (err) {
              const msg = err.response?.data?.message || "Payment verification failed";
              toast.error(msg);
              reject(new Error(msg));
            }
          },
        };

        const rzp = new window.Razorpay(options);

        rzp.on("payment.failed", (response) => {
          toast.error(`Payment failed: ${response.error?.description || "Unknown error"}`);
          reject(new Error(response.error?.description || "Payment failed"));
        });

        rzp.open();
      });

    } catch (err) {
      if (err.message !== "dismissed") {
        const msg = err.response?.data?.message || err.message || "Something went wrong";
        if (msg !== "dismissed") toast.error(msg);
      }
    } finally {
      setProcessingPlan(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-enter" style={{ maxWidth: 860, margin: "0 auto", padding: "48px 16px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <p style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 8 }}>
          Pricing
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.6px", margin: "0 0 8px" }}>
          Simple, honest plans
        </h1>
        <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>
          Start free. Upgrade when you need teams.
        </p>
      </div>

      {/* ── Payment success banner ───────────────────────────────────────── */}
      {successPlan && (
        <div
          className="ix-card"
          style={{
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 24,
            borderColor: "rgba(74,222,128,0.4)",
            background: "rgba(74,222,128,0.04)",
          }}
        >
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--emerald)", margin: "0 0 3px" }}>
              🎉 {successPlan.planName} activated!
            </p>
            <p style={{ fontSize: 12, color: "var(--text2)", margin: 0 }}>
              Expires {format(new Date(successPlan.expiresAt), "MMM d, yyyy")} · You now have full premium access.
            </p>
          </div>
          <Link to="/challenges" className="btn-primary" style={{ fontSize: 12, flexShrink: 0 }}>
            Browse Premium Challenges →
          </Link>
        </div>
      )}

      {/* ── Active plan banner (existing plan, not just purchased) ─────── */}
      {user && isPremiumActive && !successPlan && (
        <div
          className="ix-card"
          style={{
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 24,
            borderColor: "rgba(74,222,128,0.25)",
          }}
        >
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--emerald)", margin: "0 0 2px" }}>
              ✓ Active: {user.plan === "ten_day" ? "10-Day Sprint" : "Monthly Pro"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text2)", margin: 0 }}>
              Expires {format(new Date(user.planExpiresAt), "MMM d, yyyy")}
            </p>
          </div>
          <Link to="/dashboard" className="btn-ghost" style={{ fontSize: 12 }}>
            Dashboard →
          </Link>
        </div>
      )}

      {/* ── Plan cards ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
        {plans.map((plan) => {
          const isCurrent  = user?.plan === plan.id && (plan.id === "free" || isPremiumActive);
          const isFeatured = plan.id === "monthly";
          const isLoading  = processingPlan === plan.id;

          return (
            <div
              key={plan.id}
              style={{
                background:   isFeatured ? "var(--btn-primary-bg)" : "var(--bg2)",
                border:       `0.5px solid ${isFeatured ? "var(--btn-primary-bg)" : "var(--border)"}`,
                borderRadius: 14,
                padding:      "26px 20px",
                display:      "flex",
                flexDirection:"column",
                position:     "relative",
                transition:   "transform 0.15s, box-shadow 0.15s",
              }}
            >
              {/* Tag badge */}
              {plan.tag && (
                <div style={{
                  position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
                  background: "var(--bg3)", border: "0.5px solid var(--border2)", color: "var(--text2)",
                  fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
                  padding: "3px 12px", borderRadius: 100, whiteSpace: "nowrap",
                }}>
                  {plan.tag}
                </div>
              )}

              {/* Price */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 500, color: isFeatured ? "var(--logo-fg)" : "var(--text1)", margin: "0 0 10px" }}>
                  {plan.name}
                </h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 30, fontWeight: 500, color: isFeatured ? "var(--logo-fg)" : "var(--text1)", letterSpacing: "-1px" }}>
                    {plan.price === 0 ? "₹0" : `₹${plan.price}`}
                  </span>
                  {plan.period && (
                    <span style={{ fontSize: 12, color: isFeatured ? "rgba(0,0,0,0.4)" : "var(--text2)" }}>
                      / {plan.period}
                    </span>
                  )}
                </div>
              </div>

              {/* Features */}
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", flex: 1 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: 8, fontSize: 12, color: isFeatured ? "rgba(0,0,0,0.55)" : "var(--text2)", marginBottom: 9, lineHeight: 1.5 }}>
                    <span style={{ color: isFeatured ? "rgba(0,0,0,0.4)" : "var(--text3)", flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {isCurrent ? (
                <div style={{ textAlign: "center", padding: "9px", borderRadius: 9, fontSize: 12, fontWeight: 500, color: "var(--text3)", border: "0.5px solid var(--border)" }}>
                  Current Plan
                </div>

              ) : plan.id === "free" ? (
                // Free plan — just a link
                user ? (
                  <div style={{ textAlign: "center", padding: "9px", borderRadius: 9, fontSize: 12, color: "var(--text3)", border: "0.5px solid var(--border)" }}>
                    Your current plan
                  </div>
                ) : (
                  <Link
                    to="/login"
                    style={{ display: "block", textAlign: "center", padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500, textDecoration: "none", background: "var(--bg3)", color: "var(--text2)", border: "0.5px solid var(--border2)" }}
                  >
                    {plan.cta}
                  </Link>
                )

              ) : (
                // Paid plan — Razorpay button
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isLoading || !!processingPlan}
                  style={{
                    display:        "block",
                    width:          "100%",
                    textAlign:      "center",
                    padding:        "9px",
                    borderRadius:   9,
                    fontSize:       13,
                    fontWeight:     500,
                    border:         isFeatured ? "none" : "0.5px solid var(--border2)",
                    background:     isLoading
                      ? (isFeatured ? "rgba(0,0,0,0.6)" : "var(--bg3)")
                      : (isFeatured ? "var(--logo-fg)" : "var(--bg3)"),
                    color:          isFeatured ? "var(--logo-bg)" : "var(--text2)",
                    cursor:         isLoading || processingPlan ? "not-allowed" : "pointer",
                    opacity:        processingPlan && !isLoading ? 0.5 : 1,
                    transition:     "opacity 0.2s, background 0.2s",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    gap:            8,
                  }}
                >
                  {isLoading ? (
                    <>
                      <div style={{ width: 13, height: 13, border: "2px solid currentColor", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      Processing…
                    </>
                  ) : (
                    <>
                      {/* Razorpay logo mark */}
                      <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor" style={{ opacity: 0.7 }}>
                        <path d="M16 0L1.6 8v16L16 32l14.4-8V8L16 0zm0 2.4l12 6.667v13.866L16 29.6 4 22.933V9.067L16 2.4z"/>
                      </svg>
                      Pay ₹{plan.price}
                    </>
                  )}
                </button>
              )}

              {/* Secure payment note under paid plans */}
              {plan.id !== "free" && !isCurrent && (
                <p style={{ fontSize: 10, color: isFeatured ? "rgba(0,0,0,0.35)" : "var(--text3)", textAlign: "center", margin: "8px 0 0", fontFamily: "monospace" }}>
                  🔒 Secured by Razorpay
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text3)", marginTop: 28 }}>
        Payments are processed securely via Razorpay. Plans activate instantly after payment.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}