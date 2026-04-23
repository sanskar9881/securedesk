import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Shield, LayoutDashboard, Send, LogOut, Users,
  History, ShieldAlert, MessageSquare, Moon, Sun,
} from "lucide-react";

export default function Navbar() {
  const { user, logout, darkMode, toggleDarkMode, t } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const NavLink = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
    <Link
      to={to}
      className={`nav-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
        ${isActive(to)
          ? "active bg-indigo-600/20 text-indigo-300 border border-indigo-600/30"
          : "text-gray-400 hover:bg-white/5 hover:text-white"
        }`}
    >
      <span className={`transition-transform duration-200 group-hover:scale-110 ${isActive(to) ? "text-indigo-400" : ""}`}>
        {icon}
      </span>
      {label}
    </Link>
  );

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-gray-950 border-r border-gray-800/60 flex flex-col z-50 shadow-2xl">
      {/* Brand */}
      <div className="p-5 border-b border-gray-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base tracking-tight">SecureDesk</h1>
            <p className="text-gray-500 text-xs">AI Data Protection</p>
          </div>
        </div>
      </div>

      {/* User Card */}
      <Link to="/profile" className="p-4 border-b border-gray-800/60 hover:bg-white/[0.02] transition-colors group">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md transition-transform duration-200 group-hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${user?.avatar_color || "#6366f1"}, ${user?.avatar_color || "#6366f1"}cc)` }}
          >
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              user?.role === "admin" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-teal-500/15 text-teal-400 border border-teal-500/20"
            }`}>{user?.role}</span>
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {user?.role === "admin" ? (
          <>
            <NavLink to="/admin" icon={<LayoutDashboard className="w-4 h-4" />} label={t("dashboard")} />
            <NavLink to="/admin/users" icon={<Users className="w-4 h-4" />} label={t("users")} />
            <NavLink to="/phishing" icon={<ShieldAlert className="w-4 h-4" />} label={t("phishing")} />
            <NavLink to="/chat" icon={<MessageSquare className="w-4 h-4" />} label={t("ai_assistant")} />
          </>
        ) : (
          <>
            <NavLink to="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label={t("dashboard")} />
            <NavLink to="/share" icon={<Send className="w-4 h-4" />} label={t("send_file")} />
            <NavLink to="/history" icon={<History className="w-4 h-4" />} label={t("history")} />
            <NavLink to="/phishing" icon={<ShieldAlert className="w-4 h-4" />} label={t("phishing")} />
            <NavLink to="/chat" icon={<MessageSquare className="w-4 h-4" />} label={t("ai_assistant")} />
          </>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-gray-800/60 space-y-1">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl text-sm transition-all duration-200 group"
        >
          <span className="transition-transform duration-300 group-hover:rotate-12">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </span>
          {darkMode ? "Light Mode" : "Dark Mode"}
          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-md font-medium ${darkMode ? "bg-gray-700 text-gray-400" : "bg-indigo-600/20 text-indigo-400"}`}>
            {darkMode ? "OFF" : "ON"}
          </span>
        </button>

        <button
          onClick={() => { logout(); navigate("/login"); }}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-sm transition-all duration-200 group"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
            <LogOut className="w-4 h-4" />
          </span>
          {t("sign_out")}
        </button>
      </div>
    </div>
  );
}