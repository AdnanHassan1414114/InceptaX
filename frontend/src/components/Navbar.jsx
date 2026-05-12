import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNotifications } from "../context/NotificationContext";
import { useChat } from "../context/ChatContext";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";

// ─── Logo ─────────────────────────────────────────────────────────────────────
const IXLogo = () => (
  <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: "var(--logo-bg)" }}>
      <span style={{ color: "var(--logo-fg)", fontSize: "10px", fontWeight: 600, letterSpacing: "0.3px" }}>IX</span>
    </div>
    <span style={{ color: "var(--text1)", fontSize: "14px", fontWeight: 500, letterSpacing: "-0.3px" }}>InceptaX</span>
  </Link>
);

// ─── Nav link ─────────────────────────────────────────────────────────────────
const NavLink = ({ to, children }) => {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== "/" && pathname.startsWith(to));
  return (
    <Link to={to} style={{ fontSize: "13px", color: active ? "var(--text1)" : "var(--text2)", textDecoration: "none", transition: "color 0.2s" }}>
      {children}
    </Link>
  );
};

// ─── Theme toggle ─────────────────────────────────────────────────────────────
const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button onClick={toggleTheme} className="ix-theme-toggle" title="Toggle theme" aria-label="Toggle theme">
      <div className="ix-theme-toggle-knob">
        {isDark ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--logo-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--logo-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </div>
    </button>
  );
};

// ─── Notification helpers ─────────────────────────────────────────────────────
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

function groupNotifications(notifications) {
  const groups = [];
  const keyMap = {};
  for (const n of notifications) {
    const key = `${n.type}||${n.link || ""}`;
    if (keyMap[key] !== undefined) {
      const g = groups[keyMap[key]];
      g.count += 1;
      g.ids.push(n._id);
      if (!n.read) { g.unreadCount += 1; g.read = false; }
    } else {
      keyMap[key] = groups.length;
      groups.push({
        id: n._id, ids: [n._id], type: n.type,
        message: n.message, link: n.link, read: n.read,
        createdAt: n.createdAt, count: 1,
        unreadCount: n.read ? 0 : 1,
      });
    }
  }
  return groups.slice(0, 3);
}

const NotifRow = ({ group, onRead, onDelete, onNavigate }) => {
  const [hovered, setHovered] = useState(false);
  const icon = TYPE_ICON[group.type] || "🔔";
  const timeAgo = group.createdAt ? formatDistanceToNow(new Date(group.createdAt), { addSuffix: true }) : "";
  return (
    <div
      onClick={(e) => { if (e.target.closest("[data-del]")) return; if (!group.read) onRead(group.ids); if (group.link) onNavigate(group.link); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px 9px 12px", margin: "1px 5px", borderRadius: 8, background: hovered ? "var(--bg-hover)" : group.read ? "transparent" : "var(--bg3)", cursor: group.link ? "pointer" : "default", transition: "background 0.12s", position: "relative" }}
    >
      {!group.read && <span style={{ position: "absolute", left: 3, top: "50%", transform: "translateY(-50%)", width: 2.5, height: 18, borderRadius: 2, background: "var(--emerald)" }} />}
      <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: group.read ? "var(--text2)" : "var(--text1)", fontWeight: group.read ? 400 : 500, margin: "0 0 2px", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.message}</p>
        <p style={{ fontSize: 10, color: "var(--text3)", margin: 0, fontFamily: "monospace" }}>{timeAgo}</p>
      </div>
      {group.unreadCount > 1 && (
        <span style={{ flexShrink: 0, minWidth: 20, height: 16, borderRadius: 8, background: "rgba(74,222,128,0.1)", border: "0.5px solid rgba(74,222,128,0.25)", color: "var(--emerald)", fontSize: 9, fontWeight: 700, fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", marginLeft: "auto" }}>
          {group.unreadCount > 99 ? "99+" : group.unreadCount}
        </span>
      )}
      <button data-del="true" onClick={(e) => { e.stopPropagation(); onDelete(group.ids); }} title="Delete"
        style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 4, border: "0.5px solid var(--border)", background: "var(--bg2)", color: "var(--text3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: hovered ? 1 : 0, transition: "opacity 0.1s, color 0.1s", padding: 0 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "rgba(248,113,113,0.07)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.background = "var(--bg2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
      >
        <Trash2 size={11} strokeWidth={1.8} />
      </button>
    </div>
  );
};

// ─── Notification Bell ────────────────────────────────────────────────────────
const NotificationBell = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const goTo = useCallback((link) => { setOpen(false); navigate(link); }, [navigate]);
  const handleRead = useCallback(async (ids) => { for (const id of ids) await markAsRead(id); }, [markAsRead]);
  const handleDelete = useCallback(async (ids) => { for (const id of ids) await deleteNotification(id); }, [deleteNotification]);
  const grouped = groupNotifications(notifications);
  const hasAny = notifications.length > 0;

  const handleDeleteAll = async () => {
    const allIds = grouped.flatMap((g) => g.ids);
    for (const id of allIds) await deleteNotification(id);
    toast.success("Cleared");
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} aria-label="Notifications"
        style={{ position: "relative", width: 32, height: 32, borderRadius: 8, border: `0.5px solid ${open ? "var(--border2)" : "transparent"}`, background: open ? "var(--bg3)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text2)", flexShrink: 0, transition: "background 0.12s, border-color 0.12s" }}
        onMouseEnter={(e) => { if (!open) { e.currentTarget.style.background = "var(--bg3)"; e.currentTarget.style.borderColor = "var(--border)"; } }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: 2, right: 2, minWidth: 14, height: 14, borderRadius: 7, background: "var(--emerald)", color: "#000", fontSize: 8, fontWeight: 800, fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: "1.5px solid var(--bg)", lineHeight: 1 }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 296, background: "var(--bg)", border: "0.5px solid var(--border2)", borderRadius: 12, boxShadow: "0 16px 48px rgba(0,0,0,0.22)", zIndex: 200, overflow: "hidden", animation: "nDrop 0.15s cubic-bezier(0.16,1,0.3,1)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 12px 10px", borderBottom: "0.5px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text1)" }}>Notifications</span>
              {unreadCount > 0 && <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "monospace", color: "var(--emerald)", background: "rgba(74,222,128,0.09)", border: "0.5px solid rgba(74,222,128,0.22)", padding: "1px 6px", borderRadius: 100 }}>{unreadCount} new</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {unreadCount > 0 && <button onClick={markAllAsRead} style={actionBtnStyle} onMouseEnter={actionHoverIn} onMouseLeave={actionHoverOut}>Read all</button>}
              {hasAny && <button onClick={handleDeleteAll} style={actionBtnStyle} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "rgba(248,113,113,0.06)"; }} onMouseLeave={actionHoverOut}>Delete all</button>}
            </div>
          </div>

          <div style={{ padding: "5px 0" }}>
            {loading && notifications.length === 0 ? (
              [1,2,3].map((i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "10px 12px", alignItems: "center" }}>
                  <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}><div className="skeleton" style={{ height: 9, borderRadius: 3, marginBottom: 5, width: "75%" }} /><div className="skeleton" style={{ height: 7, borderRadius: 3, width: "35%" }} /></div>
                </div>
              ))
            ) : grouped.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "26px 16px", gap: 7 }}>
                <span style={{ fontSize: 22, opacity: 0.4 }}>🔕</span>
                <p style={{ fontSize: 12, color: "var(--text3)", margin: 0 }}>No notifications</p>
              </div>
            ) : grouped.map((group) => (
              <NotifRow key={group.id} group={group} onRead={handleRead} onDelete={handleDelete} onNavigate={goTo} />
            ))}
          </div>

          <button onClick={() => { setOpen(false); navigate("/notifications"); }}
            style={{ width: "100%", padding: "9px 12px", fontSize: 11, fontWeight: 500, color: "var(--text3)", background: "none", border: "none", borderTop: "0.5px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "color 0.12s, background 0.12s", fontFamily: "monospace" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text1)"; e.currentTarget.style.background = "var(--bg3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.background = "none"; }}
          >
            View all notifications
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSENGER CHAT PANEL
// ─────────────────────────────────────────────────────────────────────────────

const Avatar = ({ name, profileImage, size = 28, radius = 8 }) => (
  <img
    src={profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${name || "U"}&backgroundColor=111111&textColor=ffffff`}
    style={{ width: size, height: size, borderRadius: radius, flexShrink: 0 }}
    alt={name || ""}
  />
);

// ── Single conversation row in the list ───────────────────────────────────────
const ConvRow = ({ conv, isActive, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const last = conv.lastMessage;
  const timeAgo = last?.createdAt ? formatDistanceToNow(new Date(last.createdAt), { addSuffix: false }) : "";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px",
        background: isActive ? "var(--bg3)" : hovered ? "var(--bg-hover)" : "transparent",
        cursor: "pointer", transition: "background 0.12s",
        borderLeft: isActive ? "2px solid var(--emerald)" : "2px solid transparent",
      }}
    >
      {/* Team avatar — initials of team name */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: "var(--bg3)", border: "0.5px solid var(--border2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 600, color: "var(--text2)",
        fontFamily: "monospace",
      }}>
        {conv.name?.slice(0, 2).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: conv.unreadCount > 0 ? 600 : 500, color: "var(--text1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
            {conv.name}
          </span>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text3)", flexShrink: 0, marginLeft: 4 }}>
            {timeAgo}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 11, color: conv.unreadCount > 0 ? "var(--text2)" : "var(--text3)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
            {last ? last.message : <span style={{ fontStyle: "italic" }}>No messages yet</span>}
          </p>
          {conv.unreadCount > 0 && (
            <span style={{
              flexShrink: 0, minWidth: 18, height: 18, borderRadius: 9,
              background: "var(--emerald)", color: "#000",
              fontSize: 9, fontWeight: 800, fontFamily: "monospace",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 4px", marginLeft: 4,
            }}>
              {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
            </span>
          )}
        </div>
        <p style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text3)", margin: "2px 0 0" }}>
          {conv.challengeTitle}
        </p>
      </div>
    </div>
  );
};

// ── Message bubble ────────────────────────────────────────────────────────────
const MsgBubble = ({ msg, isMine }) => {
  const timeAgo = msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : "";
  return (
    <div style={{ display: "flex", gap: 6, flexDirection: isMine ? "row-reverse" : "row", alignItems: "flex-end", marginBottom: 8 }}>
      <Avatar name={msg.senderId?.name} profileImage={msg.senderId?.profileImage} size={22} radius={6} />
      <div style={{ maxWidth: "72%" }}>
        {!isMine && (
          <p style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text3)", margin: "0 0 2px", paddingLeft: 4 }}>
            {msg.senderId?.name}
          </p>
        )}
        <div style={{
          padding: "7px 10px", borderRadius: 10,
          background: isMine ? "var(--btn-primary-bg)" : "var(--bg3)",
          color: isMine ? "var(--btn-primary-fg)" : "var(--text1)",
          border: isMine ? "none" : "0.5px solid var(--border2)",
          fontSize: 12, lineHeight: 1.5, wordBreak: "break-word",
        }}>
          {msg.message}
        </div>
        <p style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text3)", margin: "2px 0 0", textAlign: isMine ? "right" : "left", padding: isMine ? "0 4px 0 0" : "0 0 0 4px" }}>
          {timeAgo}
        </p>
      </div>
    </div>
  );
};

// ── Main chat panel ────────────────────────────────────────────────────────────
const ChatPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    convList, conversations, activeConvId, totalUnread,
    loadingConvs, openConversation, closeConversation, sendMessage,
  } = useChat();

  const [open, setOpen]       = useState(false);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const ref        = useRef(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); closeConversation(); } };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open, closeConversation]);

  // Auto-scroll to bottom when messages change
  const activeConv = activeConvId ? conversations[activeConvId] : null;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages?.length]);

  // Focus input when conversation opens
  useEffect(() => {
    if (activeConvId) setTimeout(() => inputRef.current?.focus(), 50);
  }, [activeConvId]);

  const handleToggle = () => {
    setOpen((v) => !v);
    if (open) closeConversation();
  };

  const handleSelectConv = async (teamId) => {
    await openConversation(teamId);
    setMsgText("");
  };

  const handleBack = () => {
    closeConversation();
    setMsgText("");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!msgText.trim() || !activeConvId || sending) return;
    setSending(true);
    try {
      await sendMessage(activeConvId, msgText);
      setMsgText("");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Chat icon button */}
      <button
        onClick={handleToggle}
        aria-label="Messages"
        style={{
          position: "relative", width: 32, height: 32, borderRadius: 8,
          border: `0.5px solid ${open ? "var(--border2)" : "transparent"}`,
          background: open ? "var(--bg3)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "var(--text2)", flexShrink: 0,
          transition: "background 0.12s, border-color 0.12s",
        }}
        onMouseEnter={(e) => { if (!open) { e.currentTarget.style.background = "var(--bg3)"; e.currentTarget.style.borderColor = "var(--border)"; } }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}
      >
        {/* Chat bubble icon */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {/* Unread badge */}
        {totalUnread > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            minWidth: 14, height: 14, borderRadius: 7,
            background: "var(--blue)", color: "#fff",
            fontSize: 8, fontWeight: 800, fontFamily: "monospace",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", border: "1.5px solid var(--bg)", lineHeight: 1,
          }}>
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ─────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 320, height: 460,
          background: "var(--bg)",
          border: "0.5px solid var(--border2)",
          borderRadius: 14,
          boxShadow: "0 16px 48px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.1)",
          zIndex: 200,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "nDrop 0.15s cubic-bezier(0.16,1,0.3,1)",
        }}>

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px 11px",
            borderBottom: "0.5px solid var(--border)",
            flexShrink: 0,
          }}>
            {activeConvId ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={handleBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", padding: 0, display: "flex", alignItems: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", margin: 0, letterSpacing: "-0.2px" }}>
                    {activeConv?.name}
                  </p>
                  <p style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text3)", margin: 0 }}>
                    {activeConv?.members?.length} members · {activeConv?.challengeTitle}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", letterSpacing: "-0.2px" }}>Messages</span>
                {totalUnread > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "monospace", color: "var(--blue)", background: "rgba(96,165,250,0.1)", border: "0.5px solid rgba(96,165,250,0.25)", padding: "1px 6px", borderRadius: 100 }}>
                    {totalUnread} unread
                  </span>
                )}
              </div>
            )}

            {/* Go to team page (in conversation view) */}
            {activeConvId && (
              <button
                onClick={() => { setOpen(false); closeConversation(); navigate(`/team/${activeConvId}`); }}
                title="Open team page"
                style={{ background: "none", border: "0.5px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text2)", padding: "4px 8px", fontSize: 10, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
              >
                Open ↗
              </button>
            )}
          </div>

          {/* ── Body ─────────────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

            {/* Conversation list */}
            {!activeConvId && (
              <div style={{ flex: 1, overflowY: "auto" }}>
                {loadingConvs ? (
                  <div style={{ padding: "8px 0" }}>
                    {[1,2,3].map((i) => (
                      <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", alignItems: "center" }}>
                        <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div className="skeleton" style={{ height: 10, borderRadius: 3, marginBottom: 6, width: "60%" }} />
                          <div className="skeleton" style={{ height: 8, borderRadius: 3, width: "80%" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : convList.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 20px", gap: 10 }}>
                    <span style={{ fontSize: 28, opacity: 0.35 }}>💬</span>
                    <p style={{ fontSize: 13, color: "var(--text2)", margin: 0, textAlign: "center" }}>No team chats yet</p>
                    <p style={{ fontSize: 11, color: "var(--text3)", margin: 0, textAlign: "center" }}>Join or create a team to start chatting</p>
                    <Link to="/challenges" onClick={() => setOpen(false)} className="btn-ghost" style={{ fontSize: 11, marginTop: 6 }}>
                      Browse Challenges →
                    </Link>
                  </div>
                ) : (
                  <div>
                    {convList.map((conv) => (
                      <ConvRow
                        key={conv.id}
                        conv={conv}
                        isActive={activeConvId === conv.id}
                        onClick={() => handleSelectConv(conv.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Message thread */}
            {activeConvId && activeConv && (
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 6px", display: "flex", flexDirection: "column" }}>
                {!activeConv.loaded ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
                    <div style={{ width: 18, height: 18, border: "2px solid var(--border2)", borderTop: "2px solid var(--text2)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  </div>
                ) : activeConv.messages.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 8 }}>
                    <span style={{ fontSize: 24, opacity: 0.35 }}>👋</span>
                    <p style={{ fontSize: 12, color: "var(--text3)", margin: 0 }}>Say hi to your team!</p>
                  </div>
                ) : (
                  activeConv.messages.map((msg) => {
                    const isMine =
                      msg.senderId?._id?.toString() === user?._id?.toString() ||
                      msg.senderId?.username === user?.username;
                    return <MsgBubble key={msg._id} msg={msg} isMine={isMine} />;
                  })
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ── Input (only in conversation view) ───────────────────────── */}
          {activeConvId && (
            <div style={{ flexShrink: 0, padding: "10px 12px", borderTop: "0.5px solid var(--border)" }}>
              <form onSubmit={handleSend} style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  className="ix-input"
                  style={{ flex: 1, resize: "none", fontSize: 12, padding: "8px 10px", maxHeight: 80, overflowY: "auto", lineHeight: 1.5 }}
                  placeholder="Message your team…"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={2000}
                />
                <button
                  type="submit"
                  disabled={sending || !msgText.trim()}
                  style={{
                    flexShrink: 0, width: 32, height: 32, borderRadius: 8,
                    background: msgText.trim() ? "var(--btn-primary-bg)" : "var(--bg3)",
                    border: "0.5px solid var(--border)",
                    color: msgText.trim() ? "var(--btn-primary-fg)" : "var(--text3)",
                    cursor: msgText.trim() ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s, color 0.15s",
                    opacity: sending ? 0.5 : 1,
                  }}
                >
                  {sending ? (
                    <div style={{ width: 12, height: 12, border: "1.5px solid currentColor", borderTop: "1.5px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </form>
              <p style={{ fontSize: 9, fontFamily: "monospace", color: "var(--text3)", margin: "4px 0 0", textAlign: "right" }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Shared style helpers ─────────────────────────────────────────────────────
const actionBtnStyle = { fontSize: 10, fontFamily: "monospace", color: "var(--text3)", background: "none", border: "none", cursor: "pointer", padding: "3px 6px", borderRadius: 5, transition: "color 0.12s, background 0.12s", whiteSpace: "nowrap" };
const actionHoverIn  = (e) => { e.currentTarget.style.color = "var(--text1)"; e.currentTarget.style.background = "var(--bg3)"; };
const actionHoverOut = (e) => { e.currentTarget.style.color = "var(--text3)"; e.currentTarget.style.background = "none"; };

// ─── Main Navbar ──────────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
    navigate("/");
    setMenuOpen(false);
  };

  const isPremium = user?.plan !== "free" && user?.planExpiresAt && new Date() < new Date(user.planExpiresAt);
  const avatar = user?.profileImage
    || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || "U"}&backgroundColor=111111&textColor=ffffff`;

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "var(--bg2)",
      borderBottom: "0.5px solid var(--border)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      transition: "background 0.3s, border-color 0.3s",
    }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <IXLogo />

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-7">
          <NavLink to="/challenges">Challenges</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          <NavLink to="/pricing">Pricing</NavLink>
          {user && <NavLink to="/dashboard">Dashboard</NavLink>}
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {isPremium && <span className="premium-badge">✦ Premium</span>}
              {/* 🔹 Chat icon */}
              <ChatPanel />
              {/* Notification bell */}
              <NotificationBell />
              <Link to={`/u/${user.username}`} style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", marginLeft: 2 }}>
                <img src={avatar} alt="" style={{ width: 28, height: 28, borderRadius: 7, border: "0.5px solid var(--border2)" }} />
                <span style={{ fontSize: "13px", color: "var(--text2)" }}>{user.name?.split(" ")[0]}</span>
              </Link>
              <button onClick={handleLogout} className="btn-ghost" style={{ fontSize: "12px", padding: "6px 12px" }}>Sign out</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Link to="/login" className="btn-ghost" style={{ fontSize: "12px" }}>Sign in</Link>
              <Link to="/login" className="btn-primary" style={{ fontSize: "12px" }}>Get started</Link>
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <>
              <ChatPanel />
              <NotificationBell />
            </>
          )}
          <button style={{ color: "var(--text2)", padding: 4 }} onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ borderTop: "0.5px solid var(--border)", background: "var(--bg2)", backdropFilter: "blur(20px)", padding: "16px" }} className="md:hidden space-y-3">
          {[["Challenges", "/challenges"], ["Leaderboard", "/leaderboard"], ["Pricing", "/pricing"]].map(([label, to]) => (
            <Link key={to} to={to} onClick={() => setMenuOpen(false)} style={{ display: "block", fontSize: "13px", color: "var(--text2)", padding: "6px 0" }}>{label}</Link>
          ))}
          {user && <Link to="/dashboard" onClick={() => setMenuOpen(false)} style={{ display: "block", fontSize: "13px", color: "var(--text2)", padding: "6px 0" }}>Dashboard</Link>}
          <div style={{ paddingTop: 12, borderTop: "0.5px solid var(--border)" }}>
            {user ? (
              <div className="space-y-2">
                <Link to={`/u/${user.username}`} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                  <img src={avatar} style={{ width: 26, height: 26, borderRadius: 7 }} alt="" />
                  <span style={{ fontSize: "13px", color: "var(--text1)" }}>{user.name}</span>
                </Link>
                <button onClick={handleLogout} className="btn-ghost w-full" style={{ fontSize: "12px", marginTop: 8 }}>Sign out</button>
              </div>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-primary w-full" style={{ fontSize: "13px" }}>Get started</Link>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes nDrop { from { opacity:0; transform:translateY(-5px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </nav>
  );
}