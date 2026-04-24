import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  User, Settings, Globe, ShieldCheck,
  LogOut, ChevronDown, Bell, Sun, Moon
} from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user, logout, darkMode, toggleDarkMode, t } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking anywhere outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const menuItems = [
    { icon: <User className="w-3.5 h-3.5" />, label: t("profile"), action: () => go("/profile") },
    { icon: <Settings className="w-3.5 h-3.5" />, label: t("settings"), action: () => go("/settings") },
    { icon: <Globe className="w-3.5 h-3.5" />, label: t("language"), action: () => go("/settings/language") },
    { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: t("privacy_center"), action: () => go("/settings/privacy") },
  ];

  return (
    /* 
      KEY FIX: position relative + z-index on the header wrapper
      so the dropdown always floats above all page content.
      isolation: isolate prevents any parent stacking context from clipping it.
    */
    <div
      className="flex items-start justify-between mb-8"
      style={{ position: "relative", zIndex: 40 }}
    >
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Dark/light toggle */}
        <button
          onClick={toggleDarkMode}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105
            ${darkMode
              ? "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
              : "bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 border border-gray-200"
            }`}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <button
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 relative
            ${darkMode
              ? "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"
              : "bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 border border-gray-200"
            }`}
        >
          <Bell className="w-4 h-4" />
          <span className={`absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-offset-0
            ${darkMode ? "ring-gray-900" : "ring-white"}`}
          />
        </button>

        {/* Profile dropdown */}
        <div ref={ref} style={{ position: "relative" }}>
          <button
            onClick={() => setOpen(!open)}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-200
              ${darkMode
                ? "bg-gray-800 hover:bg-gray-700"
                : "bg-gray-100 hover:bg-gray-200 border border-gray-200"
              }`}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${user?.avatar_color || "#6366f1"}, ${user?.avatar_color || "#6366f1"}cc)`
              }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span className={`text-sm font-medium max-w-[100px] truncate ${darkMode ? "text-white" : "text-gray-800"}`}>
              {user?.name}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""} ${darkMode ? "text-gray-400" : "text-gray-500"}`}
            />
          </button>

          {/* Dropdown — rendered with fixed high z-index, detached from page flow */}
          {open && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: "220px",
                zIndex: 9999,
              }}
              className={`rounded-2xl shadow-2xl overflow-hidden border
                ${darkMode
                  ? "bg-gray-900 border-gray-700"
                  : "bg-white border-gray-200"
                }`}
            >
              {/* User info header */}
              <div className={`px-4 py-3.5 border-b ${darkMode ? "border-gray-800 bg-indigo-950/30" : "border-gray-100 bg-indigo-50"}`}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${user?.avatar_color || "#6366f1"}, ${user?.avatar_color || "#6366f1"}cc)`
                    }}
                  >
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${darkMode ? "text-white" : "text-gray-900"}`}>
                      {user?.name}
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      user?.role === "admin"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-teal-100 text-teal-700"
                    }`}>
                      {user?.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                {menuItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${darkMode
                        ? "text-gray-300 hover:bg-white/5 hover:text-white"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                  >
                    <span className={darkMode ? "text-gray-500" : "text-gray-400"}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                ))}

                {/* Dark mode toggle inside dropdown */}
                <button
                  onClick={() => { toggleDarkMode(); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                    ${darkMode
                      ? "text-gray-300 hover:bg-white/5 hover:text-white"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                >
                  <span className={darkMode ? "text-gray-500" : "text-gray-400"}>
                    {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </span>
                  <span className="flex-1 text-left">{darkMode ? "Light Mode" : "Dark Mode"}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium
                    ${darkMode ? "bg-gray-700 text-gray-400" : "bg-indigo-100 text-indigo-600"}`}>
                    {darkMode ? "OFF" : "ON"}
                  </span>
                </button>
              </div>

              {/* Sign out */}
              <div className={`border-t py-1 ${darkMode ? "border-gray-800" : "border-gray-100"}`}>
                <button
                  onClick={() => { setOpen(false); logout(); navigate("/login"); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                    ${darkMode
                      ? "text-red-400 hover:bg-red-500/10"
                      : "text-red-500 hover:bg-red-50"
                    }`}
                >
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