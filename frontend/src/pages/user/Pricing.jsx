import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { format } from "date-fns";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  Check,
  Zap,
  Rocket,
  Crown,
  Flame,
  CreditCard,
  Lock,
  PartyPopper,
} from "lucide-react";

// ─── Plan definitions (matches backend PLAN_CONFIG) ───────────────────────────
const plans = [
  {
    id:       "free",
    name:     "Free",
    price:    0,
    period:   null,
    tag:      null,
    icon:     Zap,
    accent:   "neutral",
    illustrationGlow: "rgba(163,163,163,0.18)",
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
    tagIcon:  Flame,
    icon:     Rocket,
    accent:   "neutral",
    illustrationGlow: "rgba(120,170,255,0.18)",
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
    tagIcon:  Crown,
    icon:     Crown,
    accent:   "gold",
    illustrationGlow: "rgba(250,204,21,0.22)",
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

  // The "center" plan is the user's active plan if they have one,
  // otherwise Free is the default centerpiece for a logged-out / free visitor.
  const centerPlanId = isPremiumActive ? user.plan : "free";

  // Reorder so the center plan always renders in the middle slot,
  // with the other two plans on either side (cheaper plan on the left).
  const orderedPlans = (() => {
    const center = plans.find((p) => p.id === centerPlanId);
    const others = plans.filter((p) => p.id !== centerPlanId);
    return [others[0], center, others[1]];
  })();

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
              toast.success(`${planName} activated!`);
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
    <div className="page-enter" style={{ maxWidth: 900, margin: "0 auto", padding: "48px 16px" }}>

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
          style={{
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 24,
            borderRadius: 14,
            border: "0.5px solid rgba(74,222,128,0.35)",
            background:
              "radial-gradient(circle at 20% 0%, rgba(74,222,128,0.10), transparent 60%), rgba(74,222,128,0.04)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 30px -16px rgba(0,0,0,0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(74,222,128,0.14)", color: "var(--emerald)",
            }}>
              <PartyPopper size={17} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--emerald)", margin: "0 0 3px" }}>
                {successPlan.planName} activated!
              </p>
              <p style={{ fontSize: 12, color: "var(--text2)", margin: 0 }}>
                Expires {format(new Date(successPlan.expiresAt), "MMM d, yyyy")} · You now have full premium access.
              </p>
            </div>
          </div>
          <Link to="/challenges" className="btn-primary" style={{ fontSize: 12, flexShrink: 0 }}>
            Browse Premium Challenges →
          </Link>
        </div>
      )}

      {/* ── Plan cards ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 1fr", gap: 16, alignItems: "stretch" }}>
        {orderedPlans.map((plan) => {
          const isCurrent  = user?.plan === plan.id && (plan.id === "free" || isPremiumActive);
          const isFeatured = plan.id === centerPlanId;
          const isGold     = plan.accent === "gold";
          const isLoading  = processingPlan === plan.id;
          const Icon       = plan.icon;
          const TagIcon    = plan.tagIcon;

          const checkBg   = isGold ? "rgba(250,204,21,0.14)" : "rgba(255,255,255,0.08)";
          const checkFg   = isGold ? "#fde68a" : "#d4d4d4";

          return (
            <div
              key={plan.id}
              style={{
                position:     "relative",
                borderRadius: 16,
                padding:      isFeatured ? "8px 26px 30px" : "8px 20px 24px",
                display:      "flex",
                flexDirection:"column",
                border:       `0.5px solid ${isFeatured ? "rgba(255,255,255,0.28)" : "var(--border2)"}`,
                background:
                  "radial-gradient(circle at 30% 0%, rgba(255,255,255,0.05), transparent 60%), linear-gradient(160deg, rgba(255,255,255,0.025), rgba(255,255,255,0) 40%), var(--bg2)",
                boxShadow: isFeatured
                  ? "0 1px 0 rgba(255,255,255,0.07) inset, 0 24px 48px -16px rgba(0,0,0,0.8)"
                  : "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 30px -14px rgba(0,0,0,0.6)",
                zIndex:       isFeatured ? 2 : 1,
              }}
            >
              {/* Tag badge */}
              {plan.tag && (
                <div style={{
                  position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
                  display: "flex", alignItems: "center", gap: 5,
                  background: isGold
                    ? "linear-gradient(135deg, rgba(250,204,21,0.22), rgba(250,204,21,0.06))"
                    : "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))",
                  border: `0.5px solid ${isGold ? "rgba(250,204,21,0.35)" : "rgba(255,255,255,0.18)"}`,
                  color: isGold ? "#fde68a" : "var(--text1)",
                  fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
                  padding: "4px 14px", borderRadius: 100, whiteSpace: "nowrap", zIndex: 2,
                }}>
                  {TagIcon && <TagIcon size={11} />}
                  {plan.tag}
                </div>
              )}

              {/* Illustration banner */}
              <div style={{
                height: isFeatured ? 104 : 88,
                margin: isFeatured ? "20px -26px 18px" : "20px -20px 18px",
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                background: `radial-gradient(circle at 50% 30%, ${plan.illustrationGlow}, transparent 70%)`,
              }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(180deg, transparent 40%, var(--bg2) 100%)",
                }} />
                <Icon size={isFeatured ? 48 : 38} strokeWidth={1.5} style={{ opacity: 0.55, color: isGold ? "#fde68a" : "var(--text1)", zIndex: 1 }} />
              </div>

              {/* Price */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: isFeatured ? 14 : 13, fontWeight: 500, color: "var(--text1)", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
                  {plan.name}
                </h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: isFeatured ? 34 : 30, fontWeight: 500, color: "var(--text1)", letterSpacing: "-1px" }}>
                    {plan.price === 0 ? "₹0" : `₹${plan.price}`}
                  </span>
                  {plan.period && (
                    <span style={{ fontSize: 12, color: "var(--text2)" }}>
                      / {plan.period}
                    </span>
                  )}
                </div>
              </div>

              {/* Features */}
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", flex: 1 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: 9, fontSize: 12, color: "var(--text2)", marginBottom: 10, lineHeight: 1.5, alignItems: "flex-start" }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: checkBg, color: checkFg,
                    }}>
                      <Check size={10} strokeWidth={2.5} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Footer: CTA + secure note, fixed-height block so buttons align across all cards */}
              <div>
                {isCurrent ? (
                  <div style={{ textAlign: "center", padding: "10px", borderRadius: 9, fontSize: 12, fontWeight: 500, color: "var(--text3)", border: "0.5px solid var(--border)" }}>
                    Current Plan
                  </div>

                ) : plan.id === "free" ? (
                  // Free plan — just a link
                  user ? (
                    <div style={{ textAlign: "center", padding: "10px", borderRadius: 9, fontSize: 12, color: "var(--text3)", border: "0.5px solid var(--border)" }}>
                      Your current plan
                    </div>
                  ) : (
                    <Link
                      to="/login"
                      style={{
                        display: "block", textAlign: "center", padding: "10px", borderRadius: 9,
                        fontSize: 13, fontWeight: 500, textDecoration: "none",
                        background: "rgba(255,255,255,0.04)", color: "var(--text2)",
                        border: "0.5px solid var(--border2)",
                      }}
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
                      display:        "flex",
                      width:          "100%",
                      alignItems:     "center",
                      justifyContent: "center",
                      gap:            8,
                      textAlign:      "center",
                      padding:        "10px",
                      borderRadius:   9,
                      fontSize:       13,
                      fontWeight:     600,
                      border:         "none",
                      background:     isLoading
                        ? "rgba(255,255,255,0.08)"
                        : "linear-gradient(135deg, #ffffff, #e5e5e5)",
                      color:          isLoading ? "var(--text2)" : "#0a0a0a",
                      cursor:         isLoading || processingPlan ? "not-allowed" : "pointer",
                      opacity:        processingPlan && !isLoading ? 0.5 : 1,
                      transition:     "opacity 0.2s, background 0.2s",
                    }}
                  >
                    {isLoading ? (
                      <>
                        <div style={{ width: 13, height: 13, border: "2px solid currentColor", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        Processing…
                      </>
                    ) : (
                      <>
                        <CreditCard size={14} />
                        Pay ₹{plan.price}
                      </>
                    )}
                  </button>
                )}

                {/* Secure payment note — reserved space on every card so buttons stay level */}
                <p style={{
                  fontSize: 10, color: "var(--text3)", textAlign: "center", margin: "9px 0 0",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  visibility: (plan.id !== "free" && !isCurrent) ? "visible" : "hidden",
                }}>
                  <Lock size={10} />
                  Secured by Razorpay
                </p>
              </div>
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