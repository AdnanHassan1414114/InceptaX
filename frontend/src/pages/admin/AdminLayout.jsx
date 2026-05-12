import { NavLink, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import toast from "react-hot-toast";

const navItems = [
  { to: "/admin-portal", label: "Overview", icon: "⬡", end: true },
  { to: "/admin-portal/challenges", label: "Challenges", icon: "◈" },
  { to: "/admin-portal/submissions", label: "Submissions", icon: "◎" },
  { to: "/admin-portal/users", label: "Users", icon: "◉" },
  { to: "/admin-portal/email", label: "Email Blast", icon: "◌" },
];

export default function AdminLayout({ children }) {
  const { admin, logoutAdmin } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutAdmin();
    toast.success("Signed out of admin portal");
    navigate("/admin-portal/login");
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#02020a" }}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-ix-border flex flex-col" style={{ background: "#050510" }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-ix-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#1e1e4e,#4f46e5)" }}>
              <span className="text-white text-xs font-black font-display">IX</span>
            </div>
            <div>
              <p className="text-xs font-display font-bold text-ix-white">InceptaX</p>
              <p className="text-[10px] font-mono text-ix-muted">Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-body font-medium transition-all ${
                  isActive
                    ? "bg-ix-primary/15 text-ix-white border border-ix-primary/25"
                    : "text-ix-muted hover:text-ix-text hover:bg-ix-card"
                }`
              }>
              <span className="font-mono text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Admin info */}
        <div className="px-4 py-4 border-t border-ix-border">
          <div className="mb-3">
            <p className="text-xs font-display font-semibold text-ix-white truncate">{admin?.name}</p>
            <p className="text-[10px] font-mono text-ix-muted truncate">{admin?.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full text-xs text-ix-muted hover:text-red-400 border border-ix-border hover:border-red-500/30 py-1.5 rounded-lg transition-all font-body">
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
