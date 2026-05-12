import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Initialize auth from localStorage ─────────────────────────────────────
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedUser = localStorage.getItem("user");
        const token      = localStorage.getItem("accessToken");

        if (storedUser && token) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        }
      } catch (err) {
        console.error("Auth init error:", err);
        localStorage.clear();
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  // ── REGISTER ───────────────────────────────────────────────────────────────
  const registerWithEmail = async (email, password, name, username) => {
    try {
      const res = await api.post(
        "/auth/register",
        { name, email, username, password },
        { withCredentials: true }
      );
      const { user: u, accessToken } = res.data.data;
      _storeSession(u, accessToken);
      return u;
    } catch (error) {
      console.error("Register error:", error.response?.data || error.message);
      throw error.response?.data || error;
    }
  };

  // ── LOGIN (email / password) ───────────────────────────────────────────────
  const loginWithEmail = async (email, password) => {
    try {
      const res = await api.post(
        "/auth/login",
        { email, password },
        { withCredentials: true }
      );
      const { user: u, accessToken } = res.data.data;
      _storeSession(u, accessToken);
      return u;
    } catch (error) {
      console.error("Login error:", error.response?.data || error.message);
      throw error.response?.data || error;
    }
  };

  // 🔹 NEW — LOGIN (OAuth callback)
  // Called by OAuthCallback page after backend redirects with ?token=xxx
  // Stores the token, fetches the full user object from /users/me,
  // then sets user in context + localStorage.
  const loginWithOAuth = async (accessToken) => {
    try {
      // Attach token so the /users/me request is authenticated
      api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
      localStorage.setItem("accessToken", accessToken);

      // Fetch full user profile (includes plan, skills, socialLinks etc.)
      const res = await api.get("/users/me", { withCredentials: true });
      const u   = res.data.data.user;

      localStorage.setItem("user", JSON.stringify(u));
      setUser(u);
      return u;
    } catch (error) {
      // Clean up on failure
      delete api.defaults.headers.common["Authorization"];
      localStorage.removeItem("accessToken");
      console.error("OAuth login error:", error.response?.data || error.message);
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
      console.error("Update profile error:", error.response?.data);
      throw error.response?.data || error;
    }
  };

  // ── REFRESH USER (after plan change, payment, etc.) ────────────────────────
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

  // ── Private helpers ────────────────────────────────────────────────────────
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
    <AuthContext.Provider
      value={{
        user,
        loading,
        registerWithEmail,
        loginWithEmail,
        loginWithOAuth,   // 🔹 NEW
        logout,
        updateUserProfile,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};