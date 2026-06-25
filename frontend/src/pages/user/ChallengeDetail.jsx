import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { format, isPast, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Trophy,
  Users,
  Sparkles,
  Clock,
  ChevronRight,
  Lock, // 🔹 NEW — used on the disabled submit button
} from "lucide-react";
import toast from "react-hot-toast"; // 🔹 NEW
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

/* ── helpers ──────────────────────────────────────────────────────────── */
const diffBadgeClass = (d) => {
  const key = (d || "").toLowerCase();
  if (key === "easy") return "badge-easy";
  if (key === "hard") return "badge-hard";
  return "badge-medium";
};

const rankColor = (i) => {
  if (i === 0) return "var(--amber)";
  if (i === 1) return "var(--text2)";
  if (i === 2) return "#c98a4b";
  return "var(--text3)";
};

const diffAccent = (d) => {
  const key = (d || "").toLowerCase();
  if (key === "easy") return "var(--emerald)";
  if (key === "hard") return "var(--red)";
  return "var(--amber)";
};

const diffGlow = (d) => {
  const key = (d || "").toLowerCase();
  if (key === "easy") return "rgba(74,222,128,0.12)";
  if (key === "hard") return "rgba(248,113,113,0.12)";
  return "rgba(251,191,36,0.12)";
};

/* ── skeleton ─────────────────────────────────────────────────────────── */
function ChallengeSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-12">
      <div className="skeleton h-4 w-28 mb-6" />
      <div className="skeleton h-64 mb-4" />
      <div className="skeleton h-20 mb-4" />
      <div className="skeleton h-40" />
    </div>
  );
}

export default function ChallengeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [topSubs, setTopSubs] = useState([]);
  const [mySubmission, setMySubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/assignments/${id}`),
      api.get(`/submissions/assignment/${id}`, { params: { limit: 5 } }),
    ])
      .then(([aRes, sRes]) => {
        setAssignment(aRes.data.data.assignment);
        const subs = sRes.data.data.data || [];
        setTopSubs(subs);
        if (user) {
          setMySubmission(
            subs.find(
              (s) =>
                s.userId?._id === user._id ||
                s.userId?.username === user.username
            ) || null
          );
        }
      })
      .catch((err) =>
        setError(err.response?.data?.message || "Failed to load challenge")
      )
      .finally(() => setLoading(false));
  }, [id, user]);

  if (loading) return <ChallengeSkeleton />;

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-12">
        <div className="ix-card text-center py-16 px-8">
          <p className="text-ix-muted text-sm mb-5">{error}</p>
          <Link to="/challenges" className="btn-ghost">
            <ArrowLeft size={14} className="mr-1.5" /> Back to Challenges
          </Link>
        </div>
      </div>
    );
  }

  if (!assignment) return null;

  const expired = isPast(new Date(assignment.deadline));
  const isPremiumActive =
    user?.plan !== "free" &&
    user?.planExpiresAt &&
    new Date() < new Date(user.planExpiresAt);

  // 🔹 REPLACED — was a single `canSubmit` boolean that silently hid the
  // button with zero explanation whenever any condition failed. This is
  // a well-known anti-pattern (a disabled or hidden action with no
  // stated reason leaves the user guessing). The industry-standard fix:
  // always render the control, and compute exactly WHY it's blocked so
  // that reason can be shown — as a tooltip (desktop hover) AND as a
  // toast on click (works on mobile / no-hover, and for users who don't
  // hover before clicking).
  //
  // Only one of these should ever be true at a time for a given state,
  // but they're checked in priority order below (most specific/actionable
  // reason wins if somehow more than one applied).
  let submitBlockedReason = null;
  if (!user) {
    submitBlockedReason = null; // handled separately — shows "Sign in to Submit" instead
  } else if (mySubmission) {
    submitBlockedReason = "You've already submitted a project for this challenge.";
  } else if (expired) {
    submitBlockedReason = "The submission deadline for this challenge has passed.";
  } else if (assignment.isPremium && !isPremiumActive) {
    submitBlockedReason = "This is a Premium challenge — upgrade your plan to submit.";
  }

  const canSubmit = user && !submitBlockedReason;

  const handleBlockedSubmitClick = () => {
    if (submitBlockedReason) toast.error(submitBlockedReason);
  };

  return (
    <div className="page-enter max-w-3xl mx-auto px-5 py-12">
      {/* Back */}
      <Link
        to="/challenges"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ix-subtle hover:text-ix-text transition-colors mb-6"
      >
        <ArrowLeft size={13} /> All Challenges
      </Link>

      {/* ── Hero card ───────────────────────────────────────────────── */}
      <div
        className="ix-card relative overflow-hidden p-7 mb-4 rounded-[18px]"
        style={{ borderTop: `2px solid ${diffAccent(assignment.difficulty)}` }}
      >
        {/* ambient glow mesh */}
        <div
          className="absolute -top-32 -right-20 w-80 h-80 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(167,139,250,0.14), transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-32 -left-16 w-72 h-72 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${diffGlow(
              assignment.difficulty
            )}, transparent 70%)`,
          }}
        />
        {/* faint dot texture for depth */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.6) 0.5px, transparent 0.5px)",
            backgroundSize: "16px 16px",
          }}
        />

        <div className="relative">
          {/* badges + actions */}
          <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={diffBadgeClass(assignment.difficulty)}>
                {assignment.difficulty}
              </span>
              {assignment.isPremium && (
                <span className="premium-badge inline-flex items-center gap-1">
                  <Sparkles size={10} /> Premium
                </span>
              )}
              {expired && (
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{
                    color: "var(--red)",
                    border: "0.5px solid rgba(248,113,113,0.25)",
                    background: "rgba(248,113,113,0.06)",
                  }}
                >
                  Ended
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* 🔹 CHANGED — was `{canSubmit && <Link>...</Link>}`, which
                  rendered NOTHING when blocked. Now the button always
                  renders for logged-in users. When blocked, it's a
                  disabled <button> (not a navigable <Link>) with a
                  title attribute (hover tooltip on desktop) and an
                  onClick that shows a toast explaining why — works on
                  mobile and for keyboard/click-without-hover users too. */}
              {user && canSubmit && (
                <Link to={`/challenges/${id}/submit`} className="btn-primary">
                  Submit Project <ChevronRight size={14} className="ml-1" />
                </Link>
              )}
              {user && !canSubmit && !mySubmission && (
                <button
                  type="button"
                  onClick={handleBlockedSubmitClick}
                  title={submitBlockedReason}
                  className="btn-primary"
                  style={{ opacity: 0.5, cursor: "not-allowed" }}
                >
                  <Lock size={13} className="mr-1.5" />
                  Submit Project
                </button>
              )}
              {mySubmission && (
                <Link
                  to={`/submissions/${mySubmission._id}`}
                  className="btn-ghost"
                >
                  View My Submission
                </Link>
              )}
              {!user && !expired && (
                <Link to="/login" className="btn-primary">
                  Sign in to Submit <ChevronRight size={14} className="ml-1" />
                </Link>
              )}
            </div>
          </div>

          {/* 🔹 NEW — inline banner restating the block reason, visible
              without needing to hover or click. Tooltip + toast cover
              the "why is this disabled" moment of clicking; this covers
              users who never interact with the button at all and would
              otherwise never learn why it's disabled. Only shown for
              the premium-gate case specifically, since that one has an
              actionable next step (upgrade) worth surfacing prominently —
              "already submitted" and "deadline passed" are self-evident
              from the rest of the page (the "View My Submission" button
              and the "Ended" badge already communicate those). */}
          {user && assignment.isPremium && !isPremiumActive && !mySubmission && !expired && (
            <div
              className="flex items-center gap-2 mb-5 px-3 py-2 rounded-xl text-xs"
              style={{
                color: "var(--amber)",
                border: "0.5px solid rgba(251,191,36,0.25)",
                background: "rgba(251,191,36,0.06)",
              }}
            >
              <Sparkles size={13} />
              <span>This is a Premium challenge.</span>
              <Link to="/pricing" className="underline" style={{ color: "var(--amber)" }}>
                Upgrade your plan
              </Link>
              <span>to submit.</span>
            </div>
          )}

          {/* Title + description */}
          <h1 className="text-ix-text text-[26px] font-semibold tracking-tight leading-tight mb-3">
            {assignment.title}
          </h1>
          <p className="text-ix-muted text-sm leading-relaxed whitespace-pre-wrap mb-5">
            {assignment.description}
          </p>

          {/* Tags */}
          {(assignment.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {assignment.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-ix-surface text-ix-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="glow-line mb-6" />

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(96,165,250,0.1)" }}
              >
                <Calendar size={16} style={{ color: "var(--blue)" }} />
              </div>
              <div>
                <p className="text-ix-subtle text-[10px] uppercase tracking-wider mb-0.5">
                  Deadline
                </p>
                <p className="text-ix-text text-sm font-semibold">
                  {format(new Date(assignment.deadline), "MMM d, yyyy")}
                </p>
              </div>
            </div>

            {!expired && (
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(74,222,128,0.1)" }}
                >
                  <Clock size={16} style={{ color: "var(--emerald)" }} />
                </div>
                <div>
                  <p className="text-ix-subtle text-[10px] uppercase tracking-wider mb-0.5">
                    Time Left
                  </p>
                  <p className="text-ix-text text-sm font-semibold">
                    {formatDistanceToNow(new Date(assignment.deadline))}
                  </p>
                </div>
              </div>
            )}

            {assignment.prize && (
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(251,191,36,0.1)" }}
                >
                  <Trophy size={16} style={{ color: "var(--amber)" }} />
                </div>
                <div>
                  <p className="text-ix-subtle text-[10px] uppercase tracking-wider mb-0.5">
                    Prize
                  </p>
                  <p className="text-ix-text text-sm font-semibold">
                    {assignment.prize}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Teams card ──────────────────────────────────────────────── */}
      <div className="ix-card flex items-center justify-between gap-4 flex-wrap p-6 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(167,139,250,0.1)" }}
          >
            <Users size={18} style={{ color: "var(--violet)" }} />
          </div>
          <div>
            <p className="text-ix-text text-sm font-semibold mb-0.5">
              Looking for teammates?
            </p>
            <p className="text-ix-subtle text-xs">
              Browse teams for this challenge or create your own.
            </p>
          </div>
        </div>
        <Link to={`/challenges/${id}/teams`} className="btn-ghost">
          Browse Teams <ChevronRight size={14} className="ml-1" />
        </Link>
      </div>

      {/* ── Top Submissions ─────────────────────────────────────────── */}
      <div className="ix-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-ix-text text-base font-semibold tracking-tight">
            Top Submissions
          </h2>
          <Link
            to={`/leaderboard/challenge/${id}`}
            className="text-ix-subtle hover:text-ix-text text-xs font-medium transition-colors inline-flex items-center gap-1"
          >
            Full Leaderboard <ChevronRight size={13} />
          </Link>
        </div>

        {topSubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: "var(--bg3)" }}
            >
              <Trophy size={20} style={{ color: "var(--text3)" }} />
            </div>
            <p className="text-ix-text text-sm font-medium mb-1">
              No submissions yet
            </p>
            <p className="text-ix-subtle text-xs">
              Be the first to submit and claim the top spot.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {topSubs.map((sub, i) => (
              <Link
                key={sub._id}
                to={`/submissions/${sub._id}`}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-ix-card-hover/0 hover:bg-ix-card-hover transition-colors border-ix-border"
                style={{ border: "0.5px solid var(--border)" }}
              >
                <span
                  className="text-xs font-mono font-bold w-6 text-center"
                  style={{ color: rankColor(i) }}
                >
                  #{i + 1}
                </span>
                <img
                  src={
                    sub.userId?.profileImage ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${sub.userId?.name}&backgroundColor=111111&textColor=ffffff`
                  }
                  className="w-7 h-7 rounded-full"
                  style={{ border: "0.5px solid var(--border2)" }}
                  alt=""
                />
                <span className="flex-1 text-ix-text text-sm font-medium">
                  {sub.userId?.name}
                </span>
                {sub.finalScore !== null && (
                  <span className="text-ix-text text-sm font-bold font-mono">
                    {sub.finalScore}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}