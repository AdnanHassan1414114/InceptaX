import { createContext, useContext, useState, useEffect } from "react";
import adminApi from "../services/adminApi";

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedAdmin = localStorage.getItem("adminUser");
    const token = localStorage.getItem("adminToken");
    if (storedAdmin && token) {
      setAdmin(JSON.parse(storedAdmin));
    }
    setLoading(false);
  }, []);

  // Login using the same /auth/login endpoint; verify role === admin
  const loginAdmin = async (email, password) => {
    const res = await adminApi.post("/auth/login", { email, password });
    const { user: u, accessToken } = res.data.data;

    if (u.role !== "admin") {
      throw new Error("Access denied: admin account required");
    }

    localStorage.setItem("adminUser", JSON.stringify(u));
    localStorage.setItem("adminToken", accessToken);
    setAdmin(u);
    return u;
  };

  const logoutAdmin = async () => {
    try {
      await adminApi.post("/auth/logout");
    } catch {
      // ignore
    }
    localStorage.removeItem("adminUser");
    localStorage.removeItem("adminToken");
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, loginAdmin, logoutAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be inside AdminAuthProvider");
  return ctx;
};
