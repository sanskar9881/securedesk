import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Mark from "./Mark";
import {
  LayoutDashboard, Send, LogOut, Users, History, ShieldAlert,
  MessageSquare, ScanLine, Brain, Activity, Database, FileCheck,
  TrendingUp, Building2, MessageCircle, Menu, X, Settings,
} from "lucide-react";

type Item = { to: string; icon: React.ReactNode; label: string };
type Group = { title: string; items: Item[] };

const ic = "w-[15px] h-[15px]";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [loc.pathname]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const isStaff = isAdmin || isManager;

  const groups: Group[] = isStaff
    ? [
        {
          title: "Monitor",
          items: [
            { to: "/admin", icon: <LayoutDashboard className={ic} />, label: "Overview" },
            { to: "/activity", icon: <Activity className={ic} />, label: "Event stream" },
            { to: "/ueba", icon: <TrendingUp className={ic} />, label: "Behaviour" },
          ],
        },
        {
          title: "Inspect",
          items: [
            { to: "/dlp", icon: <ScanLine className={ic} />, label: "Content scanner" },
            { to: "/fingerprints", icon: <Database className={ic} />, label: "Fingerprints" },
            { to: "/whatsapp-logs", icon: <MessageCircle className={ic} />, label: "Messaging" },
            { to: "/phishing", icon: <ShieldAlert className={ic} />, label: "Phishing checks" },
          ],
        },
        {
          title: "Govern",
          items: [
            ...(isAdmin ? [{ to: "/admin/users", icon: <Users className={ic} />, label: "People" }] : []),
            { to: "/organization", icon: <Building2 className={ic} />, label: "Organisation" },
            { to: "/compliance", icon: <FileCheck className={ic} />, label: "Compliance" },
          ],
        },
        {
          title: "Assist",
          items: [
            { to: "/ai-copilot", icon: <Brain className={ic} />, label: "Copilot" },
            { to: "/chat", icon: <MessageSquare className={ic} />, label: "Assistant" },
          ],
        },
      ]
    : [
        {
          title: "Workspace",
          items: [
            { to: "/dashboard", icon: <LayoutDashboard className={ic} />, label: "Overview" },
            { to: "/share", icon: <Send className={ic} />, label: "Send a file" },
            { to: "/history", icon: <History className={ic} />, label: "My history" },
          ],
        },
        {
          title: "Tools",
          items: [
            { to: "/dlp", icon: <ScanLine className={ic} />, label: "Content scanner" },
            { to: "/phishing", icon: <ShieldAlert className={ic} />, label: "Phishing check" },
            { to: "/activity", icon: <Activity className={ic} />, label: "My activity" },
          ],
        },
        {
          title: "Assist",
          items: [
            { to: "/ai-copilot", icon: <Brain className={ic} />, label: "Copilot" },
            { to: "/chat", icon: <MessageSquare className={ic} />, label: "Assistant" },
          ],
        },
      ];

  const roleLabel =
    user?.role === "admin" ? "Administrator" : user?.role === "manager" ? "Manager" : "Employee";

  return (
    <>
      {/* mobile trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="lg:hidden fixed top-3 left-3 z-[60] w-9 h-9 rounded flex items-center justify-center"
        style={{ background: "var(--surface-1)", border: "1px solid var(--line-2)", color: "var(--text-2)" }}
      >
        <Menu className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-[65] bg-black/60 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed left-0 top-0 h-screen w-64 z-[70] flex flex-col transition-transform duration-200 ease-swift
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ background: "var(--surface-1)", borderRight: "1px solid var(--line-1)" }}
      >
        {/* brand */}
        <div
          className="h-14 px-4 flex items-center justify-between flex-none"
          style={{ borderBottom: "1px solid var(--line-1)" }}
        >
          <Link to={isStaff ? "/admin" : "/dashboard"} className="flex items-center gap-2.5 min-w-0">
            <Mark size={19} tone="var(--accent)" />
            <span
              className="font-semibold text-[14.5px] tracking-[-0.02em] truncate"
              style={{ color: "var(--text-1)" }}
            >
              SecureDesk
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden p-1 rounded"
            style={{ color: "var(--text-3)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-2.5">
          {groups.map((g) => (
            <div key={g.title} className="mb-5">
              <p className="eyebrow px-2.5 mb-1.5" style={{ fontSize: "0.5625rem" }}>
                {g.title}
              </p>
              <div className="space-y-px">
                {g.items.map((it) => {
                  const active = loc.pathname === it.to;
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      aria-current={active ? "page" : undefined}
                      className="relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-sm text-[13.5px] transition-colors duration-150"
                      style={{
                        background: active ? "var(--accent-wash)" : "transparent",
                        color: active ? "var(--accent)" : "var(--text-3)",
                        fontWeight: active ? 550 : 450,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "var(--surface-2)";
                          e.currentTarget.style.color = "var(--text-1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "var(--text-3)";
                        }
                      }}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[15px] rounded-r"
                          style={{ background: "var(--accent)" }}
                        />
                      )}
                      <span className="flex-none opacity-90">{it.icon}</span>
                      <span className="truncate">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* account */}
        <div className="flex-none p-2.5" style={{ borderTop: "1px solid var(--line-1)" }}>
          <Link
            to="/profile"
            className="flex items-center gap-2.5 px-2 py-2 rounded-sm transition-colors duration-150"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              className="w-7 h-7 rounded flex items-center justify-center text-[11.5px] font-semibold flex-none"
              style={{ background: "var(--accent-wash)", color: "var(--accent)", border: "1px solid var(--accent-line)" }}
            >
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] truncate" style={{ color: "var(--text-1)" }}>
                {user?.name}
              </span>
              <span className="block mono text-[9.5px] tracking-[0.11em] uppercase" style={{ color: "var(--text-4)" }}>
                {roleLabel}
              </span>
            </span>
          </Link>

          <div className="flex gap-px mt-1">
            <Link
              to="/settings"
              className="flex-1 flex items-center justify-center gap-1.5 py-[7px] rounded-sm text-[12px] transition-colors"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-2)";
                e.currentTarget.style.color = "var(--text-1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-3)";
              }}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </Link>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-[7px] rounded-sm text-[12px] transition-colors"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--sev-block-wash)";
                e.currentTarget.style.color = "var(--sev-block)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-3)";
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
