/**
 * SocketContext.jsx
 *
 * Provides a SINGLE Socket.io connection shared across the entire app.
 * Both NotificationContext and ChatContext consume this — no duplicate sockets.
 *
 * The socket connects when user logs in and disconnects on logout.
 * All feature-specific listeners are registered in their own contexts via
 * the `socket` object returned from `useSocket()`.
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io as socketIO } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      // Disconnect and clean up when user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    // Don't reconnect if already connected for this user
    if (socketRef.current?.connected) return;

    const s = socketIO(
      // Use base URL without /api path — socket.io lives at root
      (import.meta.env.VITE_API_URL || "").replace(/\/api$/, "") || "",
      {
        auth: { token },
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
      }
    );

    socketRef.current = s;
    setSocket(s);

    s.on("connect", () => {
      console.log("[Socket] Connected:", s.id);
    });

    s.on("connect_error", (err) => {
      console.warn("[Socket] Connection error:", err.message);
    });

    s.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);