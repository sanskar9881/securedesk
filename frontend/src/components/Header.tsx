import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { User, Settings, Globe, ShieldCheck, LogOut, ChevronDown, Bell, Sun, Moon } from "lucide-react";

interface HeaderProps { title: string; subtitle?: string; }

export default function Header({ title, subtitle }: HeaderProps) {
  const { user, logout, darkMode, toggleDarkMode, t } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const go = (path: string) => { setOpen(false); navigate(path); };

  const menuItems = [
    { icon: <User className="w-3.5 h-3.5" />, label: t("profile"), action: () => go("/profile") },
    { icon: <Settings className="w-3.5 h-3.5" />, label: t("settings"), action: () => go("/settings") },
    { icon: <Globe className="w-3.5 h-3.5" />, label: t("language"), action: () => go("/settings/language") },
    { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: t("privacy_center"), action: () => go("/settings/privacy") },
  ];

  return (
    <div className="flex items-start justify-between mb-8 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        {/* Dark mode quick toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200 hover:scale-105"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification bell */}
        <button className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all duration-200 hover:scale-105 relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-gray-800" />
        </button>

        {/* Profile dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl px-3 py-2 transition-all duration-200 group"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${user?.avatar_color || "#6366f1"}, ${user?.avatar_color || "#6366f1"}cc)` }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span className="text-white text-sm font-medium max-w-[100px] truncate">{user?.name}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fadeIn">
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-gray-800 bg-gradient-to-br from-indigo-950/40 to-gray-900">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${user?.avatar_color || "#6366f1"}, ${user?.avatar_color || "#6366f1"}cc)` }}
                  >
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{user?.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      user?.role === "admin" ? "bg-amber-500/15 text-amber-400" : "bg-teal-500/15 text-teal-400"
                    }`}>{user?.role}</span>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                {menuItems.map((item, i) => (
                  <button key={i} onClick={item.action}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-400 hover:bg-white/[0.04] hover:text-white text-sm transition-colors group">
                    <span className="text-gray-600 group-hover:text-gray-400 transition-colors">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                ))}
                <button onClick={toggleDarkMode}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-400 hover:bg-white/[0.04] hover:text-white text-sm transition-colors group">
                  <span className="text-gray-600 group-hover:text-gray-400 transition-colors">
                    {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </span>
                  <span className="flex-1 text-left">{darkMode ? "Light Mode" : "Dark Mode"}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${darkMode ? "bg-gray-700 text-gray-500" : "bg-indigo-600/20 text-indigo-400"}`}>
                    {darkMode ? "OFF" : "ON"}
                  </span>
                </button>
              </div>

              <div className="border-t border-gray-800 py-1">
                <button onClick={() => { logout(); navigate("/login"); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400/80 hover:bg-red-500/10 hover:text-red-400 text-sm transition-colors group">
                  <LogOut className="w-3.5 h-3.5" />
                  {t("sign_out")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}