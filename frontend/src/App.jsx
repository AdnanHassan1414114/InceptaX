import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { SocketProvider } from "./context/SocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ChatProvider } from "./context/ChatContext";

// User pages
import Navbar from "./components/Navbar";
import Home from "./pages/user/Home";
import Login from "./pages/user/Login";
import OAuthCallback from "./pages/user/OAuthCallback";
import ForgotPassword from "./pages/user/ForgotPassword"; // 🔹 NEW
import ResetPassword from "./pages/user/ResetPassword";   // 🔹 NEW
import Dashboard from "./pages/user/Dashboard";
import Challenges from "./pages/user/Challenges";
import ChallengeDetail from "./pages/user/ChallengeDetail";
import SubmitProject from "./pages/user/SubmitProject";
import SubmissionDetail from "./pages/user/SubmissionDetail";
import Leaderboard from "./pages/user/Leaderboard";
import ProjectLeaderboard from "./pages/user/ProjectLeaderboard";
import Profile from "./pages/user/Profile";
import Pricing from "./pages/user/Pricing";
import Team from "./pages/user/Team";
import TeamsByChallenge from "./pages/user/TeamsByChallenge";
import NotificationsPage from "./pages/user/NotificationsPage";

// Admin pages
import AdminPanel from "./pages/admin/AdminPanel";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminChallenges from "./pages/admin/AdminChallenges";
import AdminSubmissions from "./pages/admin/AdminSubmissions";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminEmailBlast from "./pages/admin/AdminEmailBlast";

import LoadingScreen from "./components/ui/LoadingScreen";

// ─── Guards ───────────────────────────────────────────────────────────────────

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
};

const PublicOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return children;
  return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
};

const UserAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { admin, loading } = useAdminAuth();
  if (loading) return <LoadingScreen />;
  return admin ? children : <Navigate to="/admin-portal/login" replace />;
};

// ─── User App ─────────────────────────────────────────────────────────────────
const UserApp = () => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1">
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Auth — public only (redirect logged-in users) */}
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />

        {/* Password reset — public, no guard needed */}
        <Route path="/forgot-password" element={<ForgotPassword />} />  {/* 🔹 NEW */}
        <Route path="/reset-password"  element={<ResetPassword />} />   {/* 🔹 NEW */}

        {/* OAuth callback — no guard, handles own redirect */}
        <Route path="/auth/callback" element={<OAuthCallback />} />

        {/* Main app */}
        <Route path="/challenges" element={<Challenges />} />
        <Route path="/challenges/:id" element={<ChallengeDetail />} />
        <Route path="/challenges/:id/submit" element={<PrivateRoute><SubmitProject /></PrivateRoute>} />
        <Route path="/challenges/:id/teams" element={<PrivateRoute><TeamsByChallenge /></PrivateRoute>} />
        <Route path="/submissions/:id" element={<PrivateRoute><SubmissionDetail /></PrivateRoute>} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/leaderboard/challenge/:id" element={<ProjectLeaderboard />} />
        <Route path="/u/:username" element={<Profile />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/team/:teamId" element={<PrivateRoute><Team /></PrivateRoute>} />
        <Route path="/admin" element={<UserAdminRoute><AdminPanel /></UserAdminRoute>} />
        <Route path="/notifications" element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div>
);

// ─── Admin Portal App (unchanged) ─────────────────────────────────────────────
const AdminPortalApp = () => (
  <Routes>
    <Route path="login" element={<AdminLogin />} />
    <Route path="/*" element={
      <AdminRoute>
        <AdminLayout>
          <Routes>
            <Route path="/" element={<AdminOverview />} />
            <Route path="/challenges" element={<AdminChallenges />} />
            <Route path="/submissions" element={<AdminSubmissions />} />
            <Route path="/users" element={<AdminUsers />} />
            <Route path="/email" element={<AdminEmailBlast />} />
            <Route path="*" element={<Navigate to="/admin-portal" replace />} />
          </Routes>
        </AdminLayout>
      </AdminRoute>
    } />
  </Routes>
);

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AdminAuthProvider>
            <SocketProvider>
              <NotificationProvider>
                <ChatProvider>
                  <Routes>
                    <Route path="/admin-portal/*" element={<AdminPortalApp />} />
                    <Route path="/*" element={<UserApp />} />
                  </Routes>
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      style: {
                        background:     "var(--bg2)",
                        color:          "var(--text1)",
                        border:         "0.5px solid var(--border2)",
                        fontFamily:     "'Inter', sans-serif",
                        fontSize:       "13px",
                        borderRadius:   "10px",
                        backdropFilter: "blur(12px)",
                      },
                      success: { iconTheme: { primary: "#4ade80", secondary: "transparent" } },
                      error:   { iconTheme: { primary: "#f87171", secondary: "transparent" } },
                    }}
                  />
                </ChatProvider>
              </NotificationProvider>
            </SocketProvider>
          </AdminAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}