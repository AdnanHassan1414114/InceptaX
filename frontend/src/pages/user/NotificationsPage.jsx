import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";

// ─── Type → emoji (same as Navbar) ───────────────────────────────────────────
const TYPE_ICON = {
  join_request_received: "👋",
  member_joined:         "✅",
  new_team_message:      "💬",
  new_challenge:         "🚀",
  deadline_approaching:  "⏰",
  submission_published:  "🎉",
  rank_updated:          "🏆",
  team_created:          "👥",
};

const TYPE_LABEL = {
  join_request_received: "Team",
  member_joined:         "Team",
  new_team_message:      "Chat",
  new_challenge:         "Challenge",
  deadline_approaching:  "Deadline",
  submission_published:  "Submission",
  rank_updated:          "Rank",
  team_created:          "Team",
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    pagination,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    fetchNotifications,
  } = useNotifications();

  // Refresh on mount
  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleClick = async (n) => {
    if (!n.read) await markAsRead(n._id);
    if (n.link) navigate(n.link);
  };

  return (
    <div
      className="page-enter"
      style={{ maxWidth: 680, margin: "0 auto", padding: "40px 16px" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "var(--text1)",
              margin: "0 0 4px",
              letterSpacing: "-0.4px",
            }}
          >
            Notifications
          </h1>
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn-ghost"
            style={{ fontSize: 12 }}
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* ── Loading skeleton ────────────────────────────────────────────────── */}
      {loading && notifications.length === 0 ? (
        <div className="ix-card" style={{ overflow: "hidden" }}>
          {Array(5).fill(0).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                padding: "14px 18px",
                borderTop: i > 0 ? "0.5px solid var(--border)" : "none",
                alignItems: "center",
              }}
            >
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 10, borderRadius: 4, marginBottom: 6, width: "70%" }} />
                <div className="skeleton" style={{ height: 8, borderRadius: 4, width: "35%" }} />
              </div>
            </div>
          ))}
        </div>

      ) : notifications.length === 0 ? (
        /* ── Empty state ─────────────────────────────────────────────────── */
        <div
          className="ix-card"
          style={{ padding: "64px 24px", textAlign: "center" }}
        >
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>🔕</div>
          <p style={{ fontSize: 14, color: "var(--text2)", margin: "0 0 4px" }}>
            No notifications yet
          </p>
          <p style={{ fontSize: 12, color: "var(--text3)", margin: 0 }}>
            You'll see team events, challenge updates and more here.
          </p>
        </div>

      ) : (
        /* ── Notification list ───────────────────────────────────────────── */
        <div className="ix-card" style={{ overflow: "hidden" }}>
          {notifications.map((n, i) => {
            const icon     = TYPE_ICON[n.type] || "🔔";
            const label    = TYPE_LABEL[n.type] || "General";
            const timeAgo  = n.createdAt
              ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })
              : "";

            return (
              <div
                key={n._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 18px",
                  borderTop: i > 0 ? "0.5px solid var(--border)" : "none",
                  background: n.read ? "transparent" : "var(--bg3)",
                  cursor: n.link ? "pointer" : "default",
                  transition: "background 0.15s",
                  position: "relative",
                }}
                onClick={() => handleClick(n)}
                onMouseEnter={(e) => {
                  if (n.read) e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = n.read ? "transparent" : "var(--bg3)";
                }}
              >
                {/* Unread bar */}
                {!n.read && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      background: "var(--emerald)",
                      borderRadius: "0 2px 2px 0",
                    }}
                  />
                )}

                {/* Icon circle */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "var(--bg3)",
                    border: "0.5px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 3,
                      flexWrap: "wrap",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: n.read ? 400 : 500,
                        color: n.read ? "var(--text2)" : "var(--text1)",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {n.message}
                    </p>
                    {/* Type label badge */}
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: "monospace",
                        color: "var(--text3)",
                        border: "0.5px solid var(--border)",
                        padding: "1px 6px",
                        borderRadius: 100,
                        flexShrink: 0,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "var(--text3)",
                      margin: 0,
                    }}
                  >
                    {timeAgo}
                  </p>
                </div>

                {/* Delete button with Trash2 icon */}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }}
                  title="Delete"
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    border: "0.5px solid var(--border)",
                    background: "var(--bg2)",
                    color: "var(--text3)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "color 0.1s, background 0.1s, border-color 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--red)";
                    e.currentTarget.style.background = "rgba(248,113,113,0.07)";
                    e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text3)";
                    e.currentTarget.style.background = "var(--bg2)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  <Trash2 size={13} strokeWidth={1.8} />
                </button>
              </div>
            );
          })}

          {/* Load more */}
          {pagination && pagination.page < pagination.totalPages && (
            <div
              style={{
                padding: "12px",
                borderTop: "0.5px solid var(--border)",
                textAlign: "center",
              }}
            >
              <button
                onClick={loadMore}
                disabled={loading}
                className="btn-ghost"
                style={{ fontSize: 12, opacity: loading ? 0.5 : 1 }}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}