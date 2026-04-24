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

  const NavLink = ({
    to, icon, label
  }: { to: string; icon: React.ReactNode; label: string }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
          ${active
            ? darkMode
              ? "bg-indigo-600/20 text-indigo-300 border border-indigo-600/30"
              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
            : darkMode
              ? "text-gray-400 hover:bg-white/5 hover:text-white"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-indigo-500 rounded-r-full" />
        )}
        <span className={`transition-transform duration-200 group-hover:scale-110 ${active ? (darkMode ? "text-indigo-400" : "text-indigo-600") : ""}`}>
          {icon}
        </span>
        {label}
      </Link>
    );
  };

  return (
    <div
      className={`fixed left-0 top-0 h-screen w-64 flex flex-col z-50 shadow-xl transition-colors duration-300
        ${darkMode
          ? "bg-gray-950 border-r border-gray-800/60"
          : "bg-white border-r border-slate-200"
        }`}
    >
      {/* Brand */}
      <div className={`p-5 border-b ${darkMode ? "border-gray-800/60" : "border-slate-200"}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`font-bold text-base tracking-tight ${darkMode ? "text-white" : "text-slate-900"}`}>
              SecureDesk
            </h1>
            <p className={`text-xs ${darkMode ? "text-gray-500" : "text-slate-400"}`}>AI Data Protection</p>
          </div>
        </div>
      </div>

      {/* User Card */}
      <Link
        to="/profile"
        className={`p-4 border-b transition-colors group ${
          darkMode
            ? "border-gray-800/60 hover:bg-white/[0.02]"
            : "border-slate-200 hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md transition-transform duration-200 group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${user?.avatar_color || "#6366f1"}, ${user?.avatar_color || "#6366f1"}cc)`
            }}
          >
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${darkMode ? "text-white" : "text-slate-800"}`}>
              {user?.name}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              user?.role === "admin"
                ? darkMode
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  : "bg-amber-100 text-amber-700"
                : darkMode
                  ? "bg-teal-500/15 text-teal-400 border border-teal-500/20"
                  : "bg-teal-100 text-teal-700"
            }`}>
              {user?.role}
            </span>
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {user?.role === "admin" ? (
          <>
            <NavLink to="/admin"       icon={<LayoutDashboard className="w-4 h-4" />} label={t("dashboard")} />
            <NavLink to="/admin/users" icon={<Users className="w-4 h-4" />}           label={t("users")} />
            <NavLink to="/phishing"    icon={<ShieldAlert className="w-4 h-4" />}     label={t("phishing")} />
            <NavLink to="/chat"        icon={<MessageSquare className="w-4 h-4" />}   label={t("ai_assistant")} />
          </>
        ) : (
          <>
            <NavLink to="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label={t("dashboard")} />
            <NavLink to="/share"     icon={<Send className="w-4 h-4" />}             label={t("send_file")} />
            <NavLink to="/history"   icon={<History className="w-4 h-4" />}          label={t("history")} />
            <NavLink to="/phishing"  icon={<ShieldAlert className="w-4 h-4" />}      label={t("phishing")} />
            <NavLink to="/chat"      icon={<MessageSquare className="w-4 h-4" />}    label={t("ai_assistant")} />
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className={`p-3 border-t space-y-0.5 ${darkMode ? "border-gray-800/60" : "border-slate-200"}`}>
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm transition-all duration-200 group
            ${darkMode
              ? "text-gray-400 hover:bg-white/5 hover:text-white"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
        >
          <span className="transition-transform duration-300 group-hover:rotate-12">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </span>
          <span className="flex-1 text-left">{darkMode ? "Light Mode" : "Dark Mode"}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${
            darkMode
              ? "bg-gray-800 text-gray-500"
              : "bg-indigo-100 text-indigo-600"
          }`}>
            {darkMode ? "OFF" : "ON"}
          </span>
        </button>

        {/* Sign out */}
        <button
          onClick={() => { logout(); navigate("/login"); }}
          className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm transition-all duration-200 group
            ${darkMode
              ? "text-gray-400 hover:bg-red-500/10 hover:text-red-400"
              : "text-slate-500 hover:bg-red-50 hover:text-red-600"
            }`}
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