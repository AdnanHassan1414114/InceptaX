import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Initialize from localStorage ──────────────────────────────────────────
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const token      = localStorage.getItem("accessToken");
      if (storedUser && token) {
        setUser(JSON.parse(storedUser));
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }
    } catch (err) {
      console.error("Auth init error:", err);
      localStorage.clear();
    } finally {
      setLoading(false);
    }
  }, []);

  // ── REGISTER — returns { userId } for OTP step, does NOT log user in yet ──
  const registerWithEmail = async (email, password, name, username) => {
    try {
      const res = await api.post("/auth/register", { name, email, username, password });
      // Returns { userId } — no accessToken until email is verified
      return res.data.data; // { userId }
    } catch (error) {
      throw error.response?.data || error;
    }
  };

  // 🔹 NEW — VERIFY EMAIL (OTP step)
  // Sends OTP to backend → on success stores session and logs user in
  const verifyEmail = async (userId, otp) => {
    try {
      const res = await api.post("/auth/verify-email", { userId, otp }, { withCredentials: true });
      const { user: u, accessToken } = res.data.data;
      _storeSession(u, accessToken);
      return u;
    } catch (error) {
      throw error.response?.data || error;
    }
  };

  // 🔹 NEW — RESEND OTP
  const resendOTP = async (userId) => {
    try {
      await api.post("/auth/resend-otp", { userId });
    } catch (error) {
      throw error.response?.data || error;
    }
  };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const loginWithEmail = async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email, password }, { withCredentials: true });
      const { user: u, accessToken } = res.data.data;
      _storeSession(u, accessToken);
      return u;
    } catch (error) {
      // Re-throw so Login.jsx can handle EMAIL_NOT_VERIFIED sentinel
      throw error.response?.data || error;
    }
  };

  // ── OAUTH ──────────────────────────────────────────────────────────────────
  const loginWithOAuth = async (accessToken) => {
    try {
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
      localStorage.setItem("accessToken", accessToken);
      const res = await api.get("/users/me", { withCredentials: true });
      const u   = res.data.data.user;
      localStorage.setItem("user", JSON.stringify(u));
      setUser(u);
      return u;
    } catch (error) {
      delete api.defaults.headers.common["Authorization"];
      localStorage.removeItem("accessToken");
      throw error.response?.data || error;
    }
  };

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await api.post("/auth/logout", {}, { withCredentials: true });
    } catch {
      console.warn("Logout request failed (ignored)");
    }
    _clearSession();
  };

  // ── UPDATE PROFILE ─────────────────────────────────────────────────────────
  const updateUserProfile = async (updates) => {
    try {
      const res         = await api.put("/users/me/profile", updates, { withCredentials: true });
      const updatedUser = res.data.data.user;
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      throw error.response?.data || error;
    }
  };

  // ── REFRESH USER ───────────────────────────────────────────────────────────
  const refreshUser = async () => {
    try {
      const res = await api.get("/users/me", { withCredentials: true });
      const u   = res.data.data.user;
      localStorage.setItem("user", JSON.stringify(u));
      setUser(u);
    } catch {
      console.warn("Refresh user failed");
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const _storeSession = (u, accessToken) => {
    localStorage.setItem("user",        JSON.stringify(u));
    localStorage.setItem("accessToken", accessToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
    setUser(u);
  };

  const _clearSession = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("accessToken");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      registerWithEmail,
      verifyEmail,        // 🔹
      resendOTP,          // 🔹
      loginWithEmail,
      loginWithOAuth,
      logout,
      updateUserProfile,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};