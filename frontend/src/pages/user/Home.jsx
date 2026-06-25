import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, Rocket, Crown, Flame } from "lucide-react";
import devToolsWallpaper from "../../assets/dev-tool-wallpapers.jpg";
import aiImg from "../../assets/ai.jpg";
import leaderboardImg from "../../assets/leaderboard.jpg";
import teamImg from "../../assets/team.jpg";

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: null,
    tag: null,
    icon: Zap,
    accent: "neutral",
    illustrationGlow: "rgba(163,163,163,0.18)",
    features: [
      "All public challenges",
      "AI evaluation (after admin review)",
      "Public portfolio at /u/username",
      "Global + per-project leaderboard",
    ],
    cta: "Start Free",
    href: "/login",
    featured: false,
  },
  {
    id: "ten_day",
    name: "10-Day Sprint",
    price: 99,
    period: "10 days",
    tag: "Popular",
    tagIcon: Flame,
    icon: Rocket,
    accent: "neutral",
    illustrationGlow: "rgba(120,170,255,0.18)",
    features: [
      "Everything in Free",
      "All premium challenges",
      "Team collaboration (up to 3)",
      "Real-time team chat",
      "Priority evaluation",
    ],
    cta: "Start Sprint",
    href: "/login?plan=ten_day",
    featured: true,
  },
  {
    id: "monthly",
    name: "Monthly Pro",
    price: 199,
    period: "month",
    tag: "Best Value",
    tagIcon: Crown,
    icon: Crown,
    accent: "gold",
    illustrationGlow: "rgba(250,204,21,0.22)",
    features: [
      "Everything in Sprint",
      "Unlimited team members",
      "Exclusive monthly challenges",
      "Pro badge on profile",
      "Early feature access",
    ],
    cta: "Go Pro",
    href: "/login?plan=monthly",
    featured: false,
  },
];

const portals = [
  { name: "HackerEarth", short: "HE", bg: "#2b2d7e", accent: "#ffffff" },
  { name: "Devfolio", short: "Devfolio", bg: "#3770ff", accent: "#ffffff" },
  { name: "MLH", short: "MLH", bg: "#cc0000", accent: "#ffffff" },
  { name: "Unstop", short: "Unstop", bg: "#6c2bd9", accent: "#ffffff" },
  { name: "HackerRank", short: "HR", bg: "#00ea64", accent: "#000000" },
  { name: "Replit", short: "Replit", bg: "#f5a623", accent: "#000000" },
  { name: "GitHub", short: "GitHub", bg: "#24292e", accent: "#ffffff" },
  { name: "Google", short: "Google", bg: "#ffffff", accent: "#4285f4" },
  { name: "Microsoft", short: "MSFT", bg: "#00a4ef", accent: "#ffffff" },
  { name: "Flipkart", short: "Flipkart", bg: "#2874f0", accent: "#ffffff" },
  { name: "LeetCode", short: "LC", bg: "#ffa116", accent: "#000000" },
  { name: "Codeforces", short: "CF", bg: "#1f8dd6", accent: "#ffffff" },
  { name: "CodeChef", short: "CC", bg: "#5b4638", accent: "#ffffff" },
  { name: "Kaggle", short: "Kaggle", bg: "#20beff", accent: "#000000" },
  { name: "Devpost", short: "Devpost", bg: "#003e54", accent: "#ffffff" },
];

const featureCards = [
  {
    img: aiImg,
    imgPosition: "center bottom",
    icon: "⚡",
    tag: "Free & Premium",
    title: "AI Evaluation",
    desc: "Every submission is analyzed for code quality, structure, and real-world impact.",
    pills: ["Code quality", "Structure", "Impact score"],
    center: false,
  },
  {
    img: leaderboardImg,
    imgPosition: "center bottom",
    icon: "🏆",
    tag: "All plans",
    title: "Per-Project Rankings",
    desc: "See exactly where you rank on every challenge — not just globally.",
    pills: ["Global board", "Per-challenge rank"],
    center: true,
  },
  {
    img: teamImg,
    imgPosition: "center bottom",
    icon: "👥",
    tag: "Premium only",
    title: "Team Collaboration",
    desc: "Invite partners, build together, and chat in real time on any challenge.",
    pills: ["Up to 3 members", "Real-time chat"],
    center: false,
  },
];

const stats = [
  { value: "1000+", label: "Developers" },
  { value: "100+", label: "Challenges" },
  { value: "3", label: "Plan tiers" },
  { value: "24h", label: "Avg. eval time" },
];

function HackathonCarousel() {
  const total = portals.length;
  const repeated = Array.from({ length: 21 }, () => portals).flat();
  const START = total * 10;

  const [idx, setIdx] = useState(START);
  const [animated, setAnimated] = useState(true);
  const timerRef = useRef(null);

  const startTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setIdx((p) => p + 1), 3000);
  };

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, []);

  const handleTransitionEnd = () => {
    if (idx > total * 15 || idx < total * 5) {
      const offset = ((idx - START) % total + total) % total;
      setAnimated(false);
      setIdx(START + offset);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimated(true)));
    }
  };

  const currentReal = ((idx - START) % total + total) % total;

  const CARD_W = 210;
  const GAP = 28;
  const STEP = CARD_W + GAP;
  const translateExpr = `calc(50% - ${CARD_W / 2}px - ${idx} * ${STEP}px)`;

  return (
    <div style={{
      padding: "28px 0",
      borderTop: "0.5px solid var(--stat-border)",
      borderBottom: "0.5px solid var(--stat-border)",
      position: "relative",
      zIndex: 1,
    }}>
      <p style={{ textAlign: "center", fontSize: 13, color: "var(--text2)", marginBottom: 24 }}>
        <span style={{ fontWeight: 600, color: "var(--text1)" }}>100+ Different Challenges</span>
      </p>

      <div style={{
        position: "relative",
        width: "90%",
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        {/* Left fade mask */}
        <div style={{
          position: "absolute",
          left: 44,
          top: 0,
          width: 80,
          height: "100%",
          background: "linear-gradient(to right, var(--bg), transparent)",
          zIndex: 2,
          pointerEvents: "none",
        }} />

        <button
          onClick={() => { setAnimated(true); setIdx((p) => p - 1); startTimer(); }}
          style={{
            width: 36, height: 36, flexShrink: 0, borderRadius: "50%",
            border: "0.5px solid var(--border2)", background: "var(--bg2)",
            color: "var(--text2)", fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", zIndex: 3,
          }}
        >‹</button>

        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div
            onTransitionEnd={handleTransitionEnd}
            style={{
              display: "flex",
              gap: `${GAP}px`,
              transform: `translateX(${translateExpr})`,
              transition: animated ? "transform 0.45s cubic-bezier(0.4,0,0.2,1)" : "none",
              willChange: "transform",
            }}
          >
            {repeated.map((portal, pos) => {
              const dist = Math.abs(pos - idx);
              return (
                <div
                  key={pos}
                  style={{
                    flex: `0 0 ${CARD_W}px`,
                    height: 130,
                    borderRadius: 10,
                    background: portal.bg || "var(--bg2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "16px 20px",
                    opacity: dist === 0 ? 1 : dist === 1 ? 0.85 : dist === 2 ? 0.6 : 0.35,
                    transition: "opacity 0.45s ease",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: portal.accent, textAlign: "center", letterSpacing: "-0.5px", lineHeight: 1 }}>
                      {portal.short}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 500, color: portal.accent, opacity: 0.7, textAlign: "center", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                      {portal.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right fade mask */}
        <div style={{
          position: "absolute",
          right: 44,
          top: 0,
          width: 80,
          height: "100%",
          background: "linear-gradient(to left, var(--bg), transparent)",
          zIndex: 2,
          pointerEvents: "none",
        }} />

        <button
          onClick={() => { setAnimated(true); setIdx((p) => p + 1); startTimer(); }}
          style={{
            width: 36, height: 36, flexShrink: 0, borderRadius: "50%",
            border: "0.5px solid var(--border2)", background: "var(--bg2)",
            color: "var(--text2)", fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", zIndex: 3,
          }}
        >›</button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 20 }}>
        {portals.map((_, i) => (
          <div
            key={i}
            onClick={() => { setAnimated(true); setIdx(START + i); startTimer(); }}
            style={{
              width: i === currentReal ? 18 : 5,
              height: 5, borderRadius: 3,
              background: i === currentReal ? "var(--text1)" : "var(--border2)",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="page-enter" style={{ position: "relative", background: "var(--bg)", overflowX: "hidden" }}>

      {/* ── Hero ── */}
      <section style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        overflow: "hidden",
        zIndex: 1,
      }}>
        {/* Left content */}
        <div style={{
          position: "relative",
          zIndex: 1,
          width: "50%",
          padding: "130px 56px 200px",
        }}>
          <h1 style={{
            fontSize: "clamp(40px, 5.5vw, 64px)",
            fontWeight: 600,
            color: "var(--text1)",
            lineHeight: 1.08,
            letterSpacing: "-2px",
            margin: "0 0 18px",
          }}>
            Where builders<br />
            <span style={{ color: "var(--text3)", fontWeight: 400, fontStyle: "italic" }}>get ranked.</span>
          </h1>

          <p style={{
            fontSize: 16,
            color: "var(--text2)",
            maxWidth: 420,
            margin: "0 0 40px",
            lineHeight: 1.75,
            fontWeight: 400,
          }}>
            Tackle real-world challenges. Submit your GitHub project.
            Get AI-powered feedback. Compete on a public leaderboard.
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/login" className="btn-primary" style={{ padding: "12px 28px", fontSize: 14, fontWeight: 500 }}>
              Start Building →
            </Link>
            <Link to="/challenges" className="btn-ghost" style={{ padding: "12px 28px", fontSize: 14 }}>
              Browse Challenges
            </Link>
          </div>
        </div>

        {/* ── Stats strip — full width at bottom of hero ── */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderTop: "0.5px solid var(--border)",
          borderBottom: "0.5px solid var(--border)",
          background: "var(--bg)",
          textAlign: "center",
        }}>
          {stats.map((s, i) => (
            <div key={s.label} style={{
              padding: "28px 16px",
              borderRight: i < stats.length - 1 ? "0.5px solid var(--border)" : "none",
            }}>
              <div style={{
                fontSize: 36,
                fontWeight: 700,
                color: "var(--text1)",
                letterSpacing: "-2px",
                lineHeight: 1,
              }}>
                {s.value}
              </div>
              <div style={{
                fontSize: 11,
                color: "var(--text3)",
                marginTop: 8,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Right image panel */}
        <div style={{
          position: "absolute",
          top: 0, right: 0,
          width: "50%",
          height: "100%",
          zIndex: 0,
          overflow: "hidden",
        }}>
          <img
            src={devToolsWallpaper}
            alt="Dev tools"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: 0.85 }}
          />
          <div style={{
            position: "absolute", top: 0, left: 0,
            width: "55%", height: "100%",
            background: "linear-gradient(90deg, var(--bg) 0%, transparent 100%)",
          }} />
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: "120px",
            background: "linear-gradient(to bottom, var(--bg), transparent)",
          }} />
          {/* Stronger bottom fade — fixes image spilling out */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: "260px",
            background: "linear-gradient(to top, var(--bg) 30%, transparent 100%)",
          }} />
        </div>
      </section>

      {/* Spacer for absolute stats strip (~120px tall) */}
      <div style={{ height: 120 }} />

      {/* ── Hackathon Portals Carousel ── */}
      <HackathonCarousel />

      {/* ── Divider ── */}
      <div style={{
        height: "0.5px",
        background: "linear-gradient(90deg, transparent, var(--border2), transparent)",
        maxWidth: 860,
        margin: "0 auto",
        position: "relative",
        zIndex: 1,
      }} />

      {/* ── Features ── */}
      <section style={{ padding: "88px 32px", maxWidth: 1180, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "2.5px", textTransform: "uppercase", marginBottom: 10 }}>
            Features
          </p>
          <h2 style={{ fontSize: 32, fontWeight: 600, color: "var(--text1)", letterSpacing: "-0.8px", margin: "0 0 8px" }}>
            Built for serious builders
          </h2>
          <p style={{ fontSize: 14, color: "var(--text2)", margin: 0 }}>
            Not just another portfolio project site.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.12fr 1fr",
          gap: 20,
          alignItems: "center",
        }}>
          {featureCards.map((card) => (
            <div
              key={card.title}
              style={{
                position: "relative",
                borderRadius: 20,
                overflow: "hidden",
                minHeight: card.center ? 500 : 440,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                border: "0.5px solid #2a2a2a",
                background: "var(--bg2)",
              }}
            >
              {/* Full-bleed image anchored to bottom */}
              <img
                src={card.img}
                alt={card.title}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: card.imgPosition,
                  display: "block",
                }}
              />

              {/* Gradient: very dark at top (for text), fades away at bottom (image shows) */}
              <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to bottom, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.92) 35%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.0) 100%)",
              }} />

              {/* Content at top */}
              <div style={{ position: "relative", zIndex: 2, padding: "26px 22px 22px" }}>

                {/* Icon + Tag */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{
                    width: 28, height: 28,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.1)",
                    border: "0.5px solid rgba(255,255,255,0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13,
                  }}>
                    {card.icon}
                  </div>
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.5)",
                    background: "rgba(255,255,255,0.07)",
                    border: "0.5px solid rgba(255,255,255,0.15)",
                    borderRadius: 100,
                    padding: "4px 11px",
                  }}>
                    {card.tag}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize: card.center ? 20 : 18,
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: "0 0 10px",
                  letterSpacing: "-0.5px",
                  lineHeight: 1.2,
                }}>
                  {card.title}
                </h3>

                {/* Description */}
                <p style={{
                  fontSize: 12.5,
                  color: "rgba(255,255,255,0.48)",
                  margin: "0 0 18px",
                  lineHeight: 1.7,
                  maxWidth: 260,
                }}>
                  {card.desc}
                </p>

                {/* Pills — max 2 to prevent wrapping */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {card.pills.map((pill) => (
                    <span
                      key={pill}
                      style={{
                        fontSize: 10.5,
                        color: "rgba(255,255,255,0.52)",
                        background: "rgba(255,255,255,0.06)",
                        border: "0.5px solid rgba(255,255,255,0.12)",
                        borderRadius: 100,
                        padding: "4px 11px",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>✓</span>
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section
        style={{ padding: "80px 24px 100px", maxWidth: 1000, margin: "0 auto", position: "relative", zIndex: 1 }}
        id="pricing"
      >
        {/* Ambient glow behind section */}
        <div style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 300,
          background: "radial-gradient(ellipse, var(--bg3) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }} />

        <div style={{ textAlign: "center", marginBottom: 56, position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 10, color: "var(--text3)", letterSpacing: "3px", textTransform: "uppercase", marginBottom: 14 }}>
            Pricing
          </p>
          <h2 style={{ fontSize: 36, fontWeight: 700, color: "var(--text1)", letterSpacing: "-1.5px", margin: "0 0 10px", lineHeight: 1.1 }}>
            Simple, honest plans
          </h2>
          <p style={{ fontSize: 14, color: "var(--text3)", margin: 0, fontWeight: 400 }}>
            Start free. Upgrade when you need teams.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.1fr 1fr",
          gap: 16,
          alignItems: "stretch",
          position: "relative",
          zIndex: 1,
        }}>
          {plans.map((plan) => {
            const isFeatured = plan.featured;
            const isGold = plan.accent === "gold";
            const Icon = plan.icon;
            const TagIcon = plan.tagIcon;

            const checkBg = isGold ? "rgba(250,204,21,0.14)" : "var(--bg3)";
            const checkFg = isGold ? "#fde68a" : "var(--text1)";

            return (
              <div
                key={plan.id}
                style={{
                  position: "relative",
                  borderRadius: 16,
                  padding: isFeatured ? "8px 26px 30px" : "8px 20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  border: `0.5px solid ${isFeatured ? "var(--border2)" : "var(--border)"}`,
                  background:
                    "radial-gradient(circle at 30% 0%, var(--bg3) 0%, transparent 60%), var(--bg2)",
                  boxShadow: isFeatured
                    ? "0 16px 36px -16px rgba(0,0,0,0.35)"
                    : "0 10px 24px -14px rgba(0,0,0,0.22)",
                  zIndex: isFeatured ? 2 : 1,
                }}
              >
                {/* Tag badge */}
                {plan.tag && (
                  <div style={{
                    position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
                    display: "flex", alignItems: "center", gap: 5,
                    background: isGold
                      ? "linear-gradient(135deg, rgba(250,204,21,0.22), rgba(250,204,21,0.06))"
                      : "var(--bg3)",
                    border: `0.5px solid ${isGold ? "rgba(250,204,21,0.35)" : "var(--border2)"}`,
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

                {/* Footer: CTA */}
                <div>
                  <Link
                    to={plan.href}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      textAlign: "center",
                      padding: "10px",
                      borderRadius: 9,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                      boxSizing: "border-box",
                      background: isFeatured ? "var(--btn-primary-bg)" : "var(--btn-ghost-bg)",
                      color: isFeatured ? "var(--btn-primary-fg)" : "var(--btn-ghost-fg)",
                      border: isFeatured ? "none" : "0.5px solid var(--btn-ghost-border)",
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text3)", marginTop: 28, position: "relative", zIndex: 1 }}>
          Payments are processed securely via Razorpay. Plans activate instantly after payment.
        </p>
      </section>

      {/* ── Back to Top ── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "var(--bg2)",
          border: "0.5px solid var(--border2)",
          color: "var(--text2)",
          fontSize: 18,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999,
          transition: "opacity 0.2s, border-color 0.2s",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--text3)"; e.currentTarget.style.color = "var(--text1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text2)"; }}
        title="Back to top"
      >
        ↑
      </button>

      {/* ── Footer ── */}
      <footer style={{
        position: "relative",
        zIndex: 1,
        background: "var(--bg)",
        overflow: "hidden",
      }}>
        {/* top hairline with center glow, echoes divider style used elsewhere */}
        <div style={{
          height: "0.5px",
          background: "linear-gradient(90deg, transparent, var(--border2), transparent)",
        }} />

        {/* Ambient glow behind footer */}
        <div style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 360,
          background: "radial-gradient(ellipse, var(--bg3) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }} />

        {/* Newsletter CTA strip — elevated glass card, same language as pricing cards */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 32px 0", position: "relative", zIndex: 1 }}>
          <div style={{
            borderRadius: 20,
            padding: "32px 36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 24,
            border: "0.5px solid var(--border2)",
            background:
              "radial-gradient(circle at 15% 20%, var(--bg3) 0%, transparent 55%), var(--bg2)",
            boxShadow: "0 12px 30px -16px rgba(0,0,0,0.35)",
          }}>
            <div>
              <h3 style={{
                fontSize: 19,
                fontWeight: 600,
                color: "var(--text1)",
                margin: "0 0 6px",
                letterSpacing: "-0.5px",
              }}>
                Stay in the loop
              </h3>
              <p style={{ fontSize: 13, color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>
                New challenges, platform updates, and builder spotlights — no spam.
              </p>
            </div>
            <div style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}>
              <input
                type="email"
                placeholder="you@example.com"
                style={{
                  padding: "11px 16px",
                  borderRadius: 10,
                  border: "0.5px solid var(--input-border)",
                  background: "var(--input-bg)",
                  color: "var(--text1)",
                  fontSize: 13,
                  outline: "none",
                  width: 230,
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--border2)"; e.target.style.background = "var(--bg3)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--input-border)"; e.target.style.background = "var(--input-bg)"; }}
              />
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "11px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--btn-primary-bg)",
                  color: "var(--btn-primary-fg)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                Subscribe →
              </button>
            </div>
          </div>
        </div>

        {/* Main footer body */}
        <div style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "52px 32px 40px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 40,
          position: "relative",
          zIndex: 1,
        }}>
          {/* Brand column */}
          <div style={{ gridColumn: "span 1" }}>
            <span style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "-0.5px",
              background: "linear-gradient(135deg, var(--text1), var(--text3))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              InceptaX
            </span>
            <p style={{
              fontSize: 13,
              color: "var(--text2)",
              margin: "14px 0 20px",
              lineHeight: 1.7,
            }}>
              Tackle real challenges, get AI feedback, and compete on public leaderboards.
            </p>
            {/* Social icons — proper SVG */}
            <div style={{ display: "flex", gap: 8 }}>
              {[
                {
                  label: "GitHub", href: "https://github.com",
                  svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                },
                {
                  label: "Twitter", href: "https://twitter.com",
                  svg: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                },
                {
                  label: "Discord", href: "#",
                  svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.112 18.101.13 18.115a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.label}
                  style={{
                    width: 32, height: 32,
                    borderRadius: 8,
                    border: "0.5px solid var(--border2)",
                    background: "var(--bg2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text3)",
                    textDecoration: "none",
                    transition: "color 0.15s, border-color 0.15s, background 0.15s, transform 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text1)"; e.currentTarget.style.borderColor = "var(--text3)"; e.currentTarget.style.background = "var(--bg3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.background = "var(--bg2)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {s.svg}
                </a>
              ))}
            </div>
          </div>

          {/* Product column */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text1)", letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 18px" }}>
              Product
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Challenges", to: "/challenges" },
                { label: "Leaderboard", to: "/leaderboard" },
                { label: "Pricing", to: "/#pricing" },
                { label: "AI Evaluation", to: "#" },
              ].map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  style={{ fontSize: 13, color: "var(--text2)", textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={(e) => (e.target.style.color = "var(--text1)")}
                  onMouseLeave={(e) => (e.target.style.color = "var(--text2)")}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Company column */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text1)", letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 18px" }}>
              Company
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "About", to: "#" },
                { label: "Blog", to: "#" },
                { label: "Careers", to: "#" },
                { label: "Contact", to: "#" },
              ].map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  style={{ fontSize: 13, color: "var(--text2)", textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={(e) => (e.target.style.color = "var(--text1)")}
                  onMouseLeave={(e) => (e.target.style.color = "var(--text2)")}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Legal column */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text1)", letterSpacing: "1.5px", textTransform: "uppercase", margin: "0 0 18px" }}>
              Legal
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Privacy Policy", to: "#" },
                { label: "Terms of Service", to: "#" },
                { label: "Cookie Policy", to: "#" },
              ].map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  style={{ fontSize: 13, color: "var(--text2)", textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={(e) => (e.target.style.color = "var(--text1)")}
                  onMouseLeave={(e) => (e.target.style.color = "var(--text2)")}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: "0.5px solid var(--border)",
          padding: "18px 32px",
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          position: "relative",
          zIndex: 1,
        }}>
          <p style={{ fontSize: 11, color: "var(--text3)", margin: 0 }}>
            © {new Date().getFullYear()} InceptaX. All rights reserved.
          </p>
          <p style={{ fontSize: 11, color: "var(--text3)", margin: 0, fontStyle: "italic" }}>
            Building the future, one commit at a time.
          </p>
        </div>
      </footer>
    </div>
  );
}