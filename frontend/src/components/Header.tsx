import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { User, Settings, Globe, ShieldCheck, LogOut, ChevronDown, Bell, Sun, Moon } from "lucide-react";

interface Props { title: string; subtitle?: string; }

export default function Header({ title, subtitle }: Props) {
  const { user, logout, darkMode, toggleDarkMode, t } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <div className="flex items-start justify-between mb-6 md:mb-8 flex-wrap gap-3 md:gap-0" style={{ position:"relative", zIndex:40 }}>
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-gray-500 text-xs md:text-sm mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
        {/* Dark mode toggle */}
        <button onClick={toggleDarkMode}
          className="w-8 md:w-9 h-8 md:h-9 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition">
          {darkMode ? <Sun className="w-3.5 md:w-4 h-3.5 md:h-4"/> : <Moon className="w-3.5 md:w-4 h-3.5 md:h-4"/>}
        </button>

        {/* Notifications */}
        <button className="w-8 md:w-9 h-8 md:h-9 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center relative text-gray-400 hover:text-white transition">
          <Bell className="w-3.5 md:w-4 h-3.5 md:h-4"/>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full"/>
        </button>

        {/* Profile dropdown */}
        <div ref={ref} style={{ position:"relative" }}>
          <button onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 md:gap-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl px-2 md:px-3 py-1.5 md:py-2 transition">
            <div className="w-6 md:w-7 h-6 md:h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background:`linear-gradient(135deg,${user?.avatar_color||"#6366f1"},${user?.avatar_color||"#6366f1"}bb)` }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs md:text-sm font-medium text-white max-w-[80px] md:max-w-[100px] truncate">{user?.name}</span>
            <ChevronDown className={`w-3 md:w-3.5 h-3 md:h-3.5 text-gray-400 transition-transform flex-shrink-0 ${open?"rotate-180":""}`}/>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
              <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, width:"220px", zIndex:9999 }}
                className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">

                {/* User info */}
                <div className="px-4 py-3.5 border-b border-gray-800 bg-indigo-950/30">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background:`linear-gradient(135deg,${user?.avatar_color||"#6366f1"},${user?.avatar_color||"#6366f1"}bb)` }}>
                      {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        user?.role==="admin"   ? "bg-amber-100 text-amber-700" :
                        user?.role==="manager" ? "bg-purple-100 text-purple-700" :
                                                 "bg-teal-100 text-teal-700"}`}>
                        {user?.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  {[
                    { icon:<User className="w-3.5 h-3.5"/>,       label:"Profile",        path:"/profile" },
                    { icon:<Settings className="w-3.5 h-3.5"/>,   label:"Settings",       path:"/settings" },
                    { icon:<Globe className="w-3.5 h-3.5"/>,      label:"Language",       path:"/settings/language" },
                    { icon:<ShieldCheck className="w-3.5 h-3.5"/>,label:"Privacy Center", path:"/settings/privacy" },
                  ].map(item => (
                    <button key={item.path} onClick={() => go(item.path)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition">
                      <span className="text-gray-500">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}

                  {/* Dark mode toggle */}
                  <button onClick={() => { toggleDarkMode(); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition">
                    <span className="text-gray-500">{darkMode ? <Sun className="w-3.5 h-3.5"/> : <Moon className="w-3.5 h-3.5"/>}</span>
                    <span className="flex-1 text-left">{darkMode ? "Light Mode" : "Dark Mode"}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${darkMode?"bg-gray-700 text-gray-400":"bg-indigo-100 text-indigo-600"}`}>
                      {darkMode ? "OFF" : "ON"}
                    </span>
                  </button>
                </div>

                {/* Sign out */}
                <div className="border-t border-gray-800 py-1">
                  <button onClick={() => { setOpen(false); logout(); navigate("/login"); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
                    <LogOut className="w-3.5 h-3.5"/> Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
