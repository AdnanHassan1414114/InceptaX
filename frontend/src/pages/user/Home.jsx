import { Link } from "react-router-dom";
import { BotMessageSquare, Trophy, Users, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: BotMessageSquare,
    title: "AI Evaluation",
    desc: "Every submission is analyzed by GPT for code quality, structure, and real-world impact.",
  },
  {
    icon: Trophy,
    title: "Per-Project Rankings",
    desc: "See exactly where you rank on every challenge — not just globally.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    desc: "Invite partners, build together, and chat in real time. Premium plans only.",
  },
  {
    icon: ShieldCheck,
    title: "Admin-Curated Quality",
    desc: "Admins review AI results before publishing — no junk scores, ever.",
  },
];

const plans = [
  { id: "free", name: "Free", price: 0, period: null, tag: null, features: ["All public challenges", "AI evaluation (after admin review)", "Public portfolio at /u/username", "Global + per-project leaderboard"], cta: "Start Free", href: "/login" },
  { id: "ten_day", name: "10-Day Sprint", price: 99, period: "10 days", tag: "Popular", features: ["Everything in Free", "All premium challenges", "Team collaboration (up to 3)", "Real-time team chat", "Priority evaluation"], cta: "Start Sprint", href: "/login?plan=ten_day" },
  { id: "monthly", name: "Monthly Pro", price: 199, period: "month", tag: "Best Value", features: ["Everything in Sprint", "Unlimited team members", "Exclusive monthly challenges", "Pro badge on profile", "Early feature access"], cta: "Go Pro", href: "/login?plan=monthly" },
];

export default function Home() {
  return (
    <div className="page-enter" style={{ background: "var(--bg)" }}>

      {/* Hero */}
      <section style={{ padding: "80px 24px 64px", textAlign: "center", position: "relative" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "0.5px solid var(--border2)",
            borderRadius: 100,
            padding: "5px 14px",
            fontSize: 11,
            color: "var(--text2)",
            marginBottom: 28,
            background: "var(--pill-bg)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
          Live challenges open
        </div>

        <h1 style={{ fontSize: "clamp(36px,6vw,56px)", fontWeight: 500, color: "var(--text1)", lineHeight: 1.1, letterSpacing: "-1.5px", margin: "0 0 20px" }}>
          Where builders<br />
          <span style={{ color: "var(--text2)" }}>get ranked.</span>
        </h1>

        <p style={{ fontSize: 15, color: "var(--text2)", maxWidth: 440, margin: "0 auto 36px", lineHeight: 1.7 }}>
          Tackle real-world challenges. Submit your GitHub project. Get AI-powered feedback. Compete on a public leaderboard.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 56 }}>
          <Link to="/login" className="btn-primary" style={{ padding: "11px 26px", fontSize: 14 }}>
            Start Building →
          </Link>
          <Link to="/challenges" className="btn-ghost" style={{ padding: "11px 26px", fontSize: 14 }}>
            Browse Challenges
          </Link>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", justifyContent: "center", gap: 48, paddingTop: 32, borderTop: "0.5px solid var(--stat-border)", flexWrap: "wrap" }}>
          {[["100+", "Challenges"], ["AI-Powered", "Evaluation"], ["Free", "To Start"]].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.5px" }}>{val}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: "0.5px", background: "linear-gradient(90deg,transparent,var(--border2),transparent)", maxWidth: 800, margin: "0 auto" }} />

      {/* Features */}
      <section style={{ padding: "64px 24px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 8 }}>Features</p>
          <h2 style={{ fontSize: 26, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.5px", margin: "0 0 8px" }}>Built for serious builders</h2>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Not just another portfolio project site.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          {features.map((f) => (
            <div key={f.title} className="ix-card" style={{ padding: "22px 18px" }}>
              <div style={{ marginBottom: 14 }}>
                <f.icon size={22} color="currentColor" strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: 13, fontWeight: 500, color: "var(--text1)", margin: "0 0 6px" }}>{f.title}</h3>
              <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: "0 24px 72px", maxWidth: 900, margin: "0 auto" }} id="pricing">
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p style={{ fontSize: 11, color: "var(--text3)", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 8 }}>Pricing</p>
          <h2 style={{ fontSize: 26, fontWeight: 500, color: "var(--text1)", letterSpacing: "-0.5px", margin: "0 0 8px" }}>Simple, honest plans</h2>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>Start free. Upgrade when you need teams.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {plans.map((plan) => {
            const isFeatured = plan.id === "monthly";
            return (
              <div
                key={plan.id}
                style={{
                  background: isFeatured ? "var(--btn-primary-bg)" : "var(--bg2)",
                  border: `0.5px solid ${isFeatured ? "var(--btn-primary-bg)" : "var(--border)"}`,
                  borderRadius: 14,
                  padding: "26px 20px",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                {plan.tag && (
                  <div style={{
                    position: "absolute",
                    top: -11,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#111",
                    border: "0.5px solid #333",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    padding: "3px 12px",
                    borderRadius: 100,
                    whiteSpace: "nowrap",
                  }}>
                    {plan.tag}
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 500, color: isFeatured ? "var(--logo-fg)" : "var(--text1)", margin: "0 0 10px" }}>{plan.name}</h3>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 30, fontWeight: 500, color: isFeatured ? "var(--logo-fg)" : "var(--text1)", letterSpacing: "-1px" }}>
                      {plan.price === 0 ? "₹0" : `₹${plan.price}`}
                    </span>
                    {plan.period && <span style={{ fontSize: 12, color: isFeatured ? "rgba(0,0,0,0.4)" : "var(--text2)" }}>/ {plan.period}</span>}
                  </div>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", flex: 1 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", gap: 8, fontSize: 12, color: isFeatured ? "rgba(0,0,0,0.55)" : "var(--text2)", marginBottom: 9, lineHeight: 1.5 }}>
                      <span style={{ color: isFeatured ? "rgba(0,0,0,0.5)" : "var(--text3)", flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.href}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "9px",
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: "none",
                    background: isFeatured ? "var(--logo-fg)" : "var(--bg3)",
                    color: isFeatured ? "var(--logo-bg)" : "var(--text2)",
                    border: isFeatured ? "none" : "0.5px solid var(--border2)",
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "0.5px solid var(--stat-border)", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text3)" }}>InceptaX</span>
        <p style={{ fontSize: 11, color: "var(--text3)", margin: 0 }}>© {new Date().getFullYear()} InceptaX · Building the future, one commit at a time.</p>
      </footer>
    </div>
  );
}