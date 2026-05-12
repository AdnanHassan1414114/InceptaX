/**
 * NotificationContext.jsx — updated to use shared SocketContext.
 * No longer creates its own socket — consumes the one from SocketContext.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import { useSocket } from "./SocketContext"; // 🔹 shared socket

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const socket = useSocket(); // 🔹 shared socket instance

  const [notifications, setNotifications]   = useState([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [loading, setLoading]               = useState(false);
  const [pagination, setPagination]         = useState({ totalPages: 1, page: 1 });

  // ── Fetch notifications ────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (page = 1) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get("/notifications", { params: { page, limit: 20 } });
      const { data: items, pagination: pg, unreadCount: uc } = res.data.data;
      setNotifications((prev) => page === 1 ? items : [...prev, ...items]);
      setPagination(pg);
      setUnreadCount(uc);
    } catch (err) {
      console.error("[NotificationContext] fetchNotifications error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = useCallback(async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[NotificationContext] markAsRead error:", err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("[NotificationContext] markAllAsRead error:", err);
    }
  }, []);

  const deleteNotification = useCallback(async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => {
        const n = prev.find((n) => n._id === id);
        if (n && !n.read) setUnreadCount((c) => Math.max(0, c - 1));
        return prev.filter((n) => n._id !== id);
      });
    } catch (err) {
      console.error("[NotificationContext] deleteNotification error:", err);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (pagination.page < pagination.totalPages) {
      fetchNotifications(pagination.page + 1);
    }
  }, [fetchNotifications, pagination]);

  // ── Listen for real-time notifications on shared socket ───────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (payload) => {
      const newNotification = {
        _id:       payload.id,
        type:      payload.type,
        message:   payload.message,
        link:      payload.link,
        read:      payload.read ?? false,
        metadata:  payload.metadata ?? {},
        createdAt: payload.createdAt,
      };

      setNotifications((prev) => {
        if (prev.some((n) => n._id === newNotification._id)) return prev;
        return [newNotification, ...prev];
      });
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("notification", handleNotification);
    return () => socket.off("notification", handleNotification);
  }, [socket]);

  // ── Initial fetch on login ────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      fetchNotifications(1);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, fetchNotifications]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      pagination,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      loadMore,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
};