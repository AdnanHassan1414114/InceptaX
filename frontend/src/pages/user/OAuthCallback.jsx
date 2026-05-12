/**
 * OAuthCallback.jsx
 * Route: /auth/callback
 *
 * The backend redirects here after a successful OAuth login with:
 *   /auth/callback?token=<accessToken>&provider=google|github
 *
 * This page:
 *   1. Reads the token from the URL
 *   2. Stores it in localStorage + attaches to axios
 *   3. Fetches /users/me to get the full user object
 *   4. Stores user in localStorage + AuthContext
 *   5. Cleans the URL (removes token from query string)
 *   6. Redirects to /dashboard (or /admin for admin users)
 */
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import toast from "react-hot-toast";
import LoadingScreen from "../../components/ui/LoadingScreen";

export default function OAuthCallback() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const { loginWithOAuth } = useAuth();
  const handled    = useRef(false); // prevent double-execution in StrictMode

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = params.get("token");
    const error = params.get("error");

    if (error || !token) {
      toast.error("OAuth sign-in failed. Please try again.");
      navigate("/login", { replace: true });
      return;
    }

    // Hand off to AuthContext — it stores token + fetches user
    loginWithOAuth(token)
      .then((user) => {
        toast.success(`Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 🚀`);
        navigate(user?.role === "admin" ? "/admin" : "/dashboard", { replace: true });
      })
      .catch(() => {
        toast.error("Failed to complete sign-in. Please try again.");
        navigate("/login", { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <LoadingScreen />;
}