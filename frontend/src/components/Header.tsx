import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { User, Settings, Globe, ShieldCheck, LogOut, ChevronDown, Bell, Sun, Moon } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: Props) {
  const { user, logout, darkMode, toggleDarkMode } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  useEffect(() => {
    const pull = () =>
      api
        .get("/notifications/count")
        .then(({ data }) => setAlerts(data.count || 0))
        .catch(() => {});
    pull();
    const id = setInterval(pull, 30000);
    return () => clearInterval(id);
  }, []);

  const go = (p: string) => {
    setOpen(false);
    navigate(p);
  };

  const iconBtn =
    "w-8 h-8 rounded-sm flex items-center justify-center transition-colors duration-150 relative";
  const iconStyle = { color: "var(--text-3)" } as const;
  const hoverOn = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "var(--surface-2)";
    e.currentTarget.style.color = "var(--text-1)";
  };
  const hoverOff = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.color = "var(--text-3)";
  };

  return (
    <header
      className="sticky top-0 z-40 -mx-4 md:-mx-8 px-4 md:px-8 mb-6 md:mb-8"
      style={{
        background: "color-mix(in srgb, var(--surface-0) 88%, transparent)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--line-1)",
      }}
    >
      <div className="h-14 flex items-center justify-between gap-4 pl-11 md:pl-0">
        <div className="min-w-0">
          <h1
            className="text-[16.5px] font-semibold tracking-[-0.022em] truncate"
            style={{ color: "var(--text-1)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mono text-[10px] tracking-[0.1em] uppercase truncate" style={{ color: "var(--text-4)" }}>
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-none">
          {actions}

          <button
            onClick={toggleDarkMode}
            aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
            className={iconBtn}
            style={iconStyle}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            aria-label={alerts ? `${alerts} unread alerts` : "Alerts"}
            className={iconBtn}
            style={iconStyle}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            <Bell className="w-4 h-4" />
            {alerts > 0 && (
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--sev-warn)" }}
              />
            )}
          </button>

          <div ref={ref} className="relative ml-1">
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-sm transition-colors duration-150"
              style={{ color: "var(--text-2)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span
                className="w-6 h-6 rounded-xs flex items-center justify-center text-[10.5px] font-semibold flex-none"
                style={{
                  background: "var(--accent-wash)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent-line)",
                }}
              >
                {user?.name?.[0]?.toUpperCase() ?? "?"}
              </span>
              <span className="hidden sm:block text-[13px] max-w-[110px] truncate">{user?.name}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 flex-none transition-transform duration-150 ${open ? "rotate-180" : ""}`}
              />
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+6px)] w-[212px] rounded-md overflow-hidden z-50"
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--line-2)",
                  boxShadow: "var(--shadow-panel)",
                }}
              >
                <div className="px-3.5 py-3" style={{ borderBottom: "1px solid var(--line-1)" }}>
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--text-1)" }}>
                    {user?.name}
                  </p>
                  <p className="mono text-[9.5px] tracking-[0.11em] uppercase mt-0.5" style={{ color: "var(--text-4)" }}>
                    {user?.role === "admin"
                      ? "Administrator"
                      : user?.role === "manager"
                      ? "Manager"
                      : "Employee"}
                  </p>
                </div>

                <div className="py-1">
                  {[
                    { icon: <User className="w-3.5 h-3.5" />, label: "Profile", path: "/profile" },
                    { icon: <Settings className="w-3.5 h-3.5" />, label: "Settings", path: "/settings" },
                    { icon: <Globe className="w-3.5 h-3.5" />, label: "Language", path: "/settings/language" },
                    { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: "Privacy", path: "/settings/privacy" },
                  ].map((i) => (
                    <button
                      key={i.path}
                      role="menuitem"
                      onClick={() => go(i.path)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] transition-colors"
                      style={{ color: "var(--text-2)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--surface-2)";
                        e.currentTarget.style.color = "var(--text-1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-2)";
                      }}
                    >
                      <span style={{ color: "var(--text-4)" }}>{i.icon}</span>
                      {i.label}
                    </button>
                  ))}
                </div>

                <div className="py-1" style={{ borderTop: "1px solid var(--line-1)" }}>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      logout();
                      navigate("/login");
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] transition-colors"
                    style={{ color: "var(--sev-block)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sev-block-wash)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Standard page frame for every console screen. */
export function Console({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="ml-0 md:ml-64 min-h-screen px-4 md:px-8 pb-16"
      style={{ background: "var(--surface-0)" }}
    >
      {children}
    </main>
  );
}
