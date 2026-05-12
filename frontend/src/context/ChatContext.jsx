/**
 * ChatContext.jsx
 *
 * Manages the messenger-style chat system.
 *
 * A "conversation" = one team the user is a member of.
 * Data shape per conversation:
 *   {
 *     id:           teamId,
 *     name:         teamName,
 *     challengeTitle: string,
 *     members:      [...],
 *     messages:     [...],   // cached messages, newest at end
 *     unreadCount:  number,
 *     lastMessage:  object | null,
 *     loaded:       boolean, // whether messages have been fetched
 *   }
 *
 * Real-time: listens for "team_message" events on the shared socket.
 * Increments unreadCount for a conversation only when it's NOT the active one.
 */
import {
  createContext, useContext, useState,
  useEffect, useCallback, useRef,
} from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext";

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user }  = useAuth();
  const socket    = useSocket();

  // Map of teamId → conversation object
  const [conversations, setConversations] = useState({});

  // teamId of the currently open conversation (null = list view)
  const [activeConvId, setActiveConvId]   = useState(null);

  // Total unread across all conversations
  const [totalUnread, setTotalUnread]     = useState(0);

  const [loadingConvs, setLoadingConvs]   = useState(false);
  const activeConvIdRef                   = useRef(null);

  // Keep ref in sync so socket handler can read latest value without stale closure
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  // ── Fetch user's team conversations ───────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoadingConvs(true);
    try {
      const res = await api.get("/teams/my");
      const teams = res.data.data.teams || [];

      const convMap = {};
      teams.forEach((team) => {
        convMap[team._id] = {
          id:             team._id,
          name:           team.teamName,
          challengeTitle: team.challengeId?.title || "",
          challengeId:    team.challengeId?._id || team.challengeId,
          members:        team.members || [],
          messages:       [],
          unreadCount:    0,
          lastMessage:    null,
          loaded:         false,
        };
      });

      setConversations(convMap);
      setTotalUnread(0);
    } catch (err) {
      console.error("[ChatContext] fetchConversations error:", err);
    } finally {
      setLoadingConvs(false);
    }
  }, [user]);

  // ── Fetch messages for a specific team conversation ───────────────────────
  const fetchMessages = useCallback(async (teamId) => {
    if (!teamId) return;
    try {
      const res = await api.get(`/teams/${teamId}/chat`, { params: { limit: 50 } });
      const messages = res.data.data.data || [];

      setConversations((prev) => {
        if (!prev[teamId]) return prev;
        return {
          ...prev,
          [teamId]: {
            ...prev[teamId],
            messages,
            loaded:      true,
            lastMessage: messages[messages.length - 1] || null,
            // Mark as read when we open it
            unreadCount: 0,
          },
        };
      });

      // Recalculate total unread
      setTotalUnread((prev) => {
        const conv = conversations[teamId];
        return Math.max(0, prev - (conv?.unreadCount || 0));
      });
    } catch (err) {
      console.error("[ChatContext] fetchMessages error:", err);
    }
  }, [conversations]);

  // ── Open a conversation ───────────────────────────────────────────────────
  const openConversation = useCallback(async (teamId) => {
    setActiveConvId(teamId);

    // Fetch messages if not yet loaded
    const conv = conversations[teamId];
    if (conv && !conv.loaded) {
      await fetchMessages(teamId);
    } else if (conv && conv.unreadCount > 0) {
      // Already loaded but has unreads — clear them
      setConversations((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], unreadCount: 0 },
      }));
      setTotalUnread((prev) => Math.max(0, prev - (conv.unreadCount || 0)));
    }
  }, [conversations, fetchMessages]);

  // ── Close active conversation (back to list) ──────────────────────────────
  const closeConversation = useCallback(() => {
    setActiveConvId(null);
  }, []);

  // ── Send a message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (teamId, text) => {
    if (!text?.trim() || !teamId) return;
    try {
      const res = await api.post(`/teams/${teamId}/chat`, { message: text.trim() });
      const msg = res.data.data.message;

      // Optimistically append — socket will also deliver it back (deduplicate by _id)
      setConversations((prev) => {
        if (!prev[teamId]) return prev;
        const msgs = prev[teamId].messages;
        // Avoid duplicate if socket fires before response
        if (msgs.some((m) => m._id === msg._id)) return prev;
        return {
          ...prev,
          [teamId]: {
            ...prev[teamId],
            messages:    [...msgs, msg],
            lastMessage: msg,
          },
        };
      });
    } catch (err) {
      console.error("[ChatContext] sendMessage error:", err);
      throw err; // re-throw so UI can show error toast
    }
  }, []);

  // ── Join socket rooms for all conversations ───────────────────────────────
  useEffect(() => {
    if (!socket || Object.keys(conversations).length === 0) return;
    const teamIds = Object.keys(conversations);
    socket.emit("join_teams", teamIds);
  }, [socket, conversations]);

  // ── Real-time: listen for incoming team messages ──────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleTeamMessage = (msg) => {
      const teamId = msg.teamId?.toString?.() || msg.teamId;

      setConversations((prev) => {
        if (!prev[teamId]) return prev; // not a conversation we track

        const conv    = prev[teamId];
        const msgs    = conv.messages;
        const isOwn   = msg.senderId?._id?.toString() === user?._id?.toString() ||
                        msg.senderId?.username === user?.username;
        const isActive = activeConvIdRef.current === teamId;

        // Deduplicate (we may have appended it optimistically in sendMessage)
        if (msgs.some((m) => m._id?.toString() === msg._id?.toString())) {
          return prev;
        }

        // Only increment unread when:
        //  - message is from someone else
        //  - this conversation is NOT currently open
        const shouldIncrement = !isOwn && !isActive;

        return {
          ...prev,
          [teamId]: {
            ...conv,
            messages:    conv.loaded ? [...msgs, msg] : msgs,
            lastMessage: msg,
            unreadCount: shouldIncrement ? conv.unreadCount + 1 : conv.unreadCount,
          },
        };
      });

      // Increment global unread badge
      const isOwn    = msg.senderId?._id?.toString() === user?._id?.toString();
      const isActive = activeConvIdRef.current === msg.teamId?.toString?.();
      if (!isOwn && !isActive) {
        setTotalUnread((prev) => prev + 1);
      }
    };

    socket.on("team_message", handleTeamMessage);
    return () => socket.off("team_message", handleTeamMessage);
  }, [socket, user]);

  // ── Load conversations when user logs in ─────────────────────────────────
  useEffect(() => {
    if (user) {
      fetchConversations();
    } else {
      setConversations({});
      setTotalUnread(0);
      setActiveConvId(null);
    }
  }, [user, fetchConversations]);

  const convList = Object.values(conversations).sort((a, b) => {
    // Sort by last message time, newest first
    const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(0);
    const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(0);
    return bTime - aTime;
  });

  return (
    <ChatContext.Provider value={{
      conversations,
      convList,
      activeConvId,
      totalUnread,
      loadingConvs,
      openConversation,
      closeConversation,
      sendMessage,
      fetchConversations,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be inside ChatProvider");
  return ctx;
};