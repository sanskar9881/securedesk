import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Header, { Console } from "../components/Header";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { Send, ScanLine, ShieldAlert, ArrowUpRight, Inbox } from "lucide-react";

interface Tx {
  _id: string;
  recipient_email?: string;
  subject?: string;
  filename?: string;
  classification?: string;
  risk_score?: number;
  severity?: string;
  timestamp?: string;
}

const sevOf = (s?: string): "block" | "warn" | "allow" => {
  const v = (s || "").toLowerCase();
  if (v === "high" || v === "critical") return "block";
  if (v === "medium") return "warn";
  return "allow";
};

function when(ts?: string) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/files/my-history")
      .catch(() => ({ data: [] }))
      .then(({ data }) => setTxs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const total = txs.length;
  const flagged = txs.filter((t) => t.classification === "suspicious").length;
  const highest = txs.reduce((m, t) => Math.max(m, t.risk_score ?? 0), 0);
  const recent = txs.slice(0, 8);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const actions = [
    { to: "/share", icon: <Send className="w-4 h-4" />, title: "Send a file", desc: "Scanned before it leaves" },
    { to: "/dlp", icon: <ScanLine className="w-4 h-4" />, title: "Scan content", desc: "Check text or a document" },
    { to: "/phishing", icon: <ShieldAlert className="w-4 h-4" />, title: "Check a message", desc: "Verify a suspicious email" },
  ];

  return (
    <div>
      <Navbar />
      <Console>
        <Header title={`Good to see you, ${firstName}`} subtitle="Your workspace" />

        {/* ── Quick actions ─────────────────────────────────── */}
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          {actions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="group rounded-md px-4 py-3.5 flex items-start gap-3 transition-colors"
              style={{ background: "var(--surface-1)", border: "1px solid var(--line-1)" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-line)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line-1)")}
            >
              <span
                className="w-8 h-8 rounded-sm flex items-center justify-center flex-none"
                style={{ background: "var(--accent-wash)", color: "var(--accent)" }}
              >
                {a.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[13.5px] font-medium" style={{ color: "var(--text-1)" }}>
                    {a.title}
                  </span>
                  <ArrowUpRight
                    className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--accent)" }}
                  />
                </span>
                <span className="block text-[12px] mt-0.5" style={{ color: "var(--text-4)" }}>
                  {a.desc}
                </span>
              </span>
            </Link>
          ))}
        </div>

        {/* ── Personal metrics ──────────────────────────────── */}
        <div
          className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-px rounded-md overflow-hidden mb-5"
          style={{ background: "var(--line-1)", border: "1px solid var(--line-1)" }}
        >
          {[
            { label: "Files sent", value: total, tone: "var(--text-1)" },
            { label: "Flagged", value: flagged, tone: flagged ? "var(--sev-block)" : "var(--text-1)" },
            { label: "Highest risk", value: total ? `${highest}` : "—", tone: highest >= 70 ? "var(--sev-block)" : highest >= 35 ? "var(--sev-warn)" : "var(--text-1)" },
          ].map((m) => (
            <div key={m.label} className="px-5 py-4" style={{ background: "var(--surface-1)" }}>
              <p className="eyebrow mb-2.5">{m.label}</p>
              {loading ? (
                <div className="skeleton h-8 w-16" />
              ) : (
                <p
                  className="text-[27px] leading-none font-semibold tracking-[-0.03em] tabular-nums"
                  style={{ color: m.tone }}
                >
                  {m.value}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── History ───────────────────────────────────────── */}
        <section className="rounded-md overflow-hidden min-w-0" style={{ border: "1px solid var(--line-1)" }}>
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line-1)" }}
          >
            <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>
              Recent activity
            </h2>
            <Link
              to="/history"
              className="mono text-[10px] tracking-[0.09em] uppercase flex items-center gap-1 transition-colors"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
            >
              Full history
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div style={{ background: "var(--surface-1)" }}>
            {loading ? (
              <div className="p-4 space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-9 w-full" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <Inbox className="w-5 h-5 mb-3" style={{ color: "var(--text-4)" }} />
                <p className="text-[13px] mb-3" style={{ color: "var(--text-3)" }}>
                  Nothing here yet.
                </p>
                <Link to="/share" className="btn btn-secondary !py-1.5 !px-3 !text-[12.5px]">
                  Send your first file
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line-1)" }}>
                      {["Severity", "Recipient", "Item", "Risk", "When"].map((h) => (
                        <th
                          key={h}
                          className="eyebrow px-4 py-2 font-medium whitespace-nowrap"
                          style={{ fontSize: "0.5625rem" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((t) => {
                      const tone = sevOf(t.severity);
                      return (
                        <tr
                          key={t._id}
                          className={`stripe stripe-${tone} transition-colors`}
                          style={{ borderBottom: "1px solid var(--line-1)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className={`tag tag-${tone}`}>{(t.severity || "low").toUpperCase()}</span>
                          </td>
                          <td className="px-4 py-2.5 text-[13px] max-w-[180px] truncate" style={{ color: "var(--text-1)" }}>
                            {t.recipient_email || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-[13px] max-w-[220px] truncate" style={{ color: "var(--text-3)" }}>
                            {t.filename || t.subject || "—"}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span
                              className="mono text-[12px] tabular-nums"
                              style={{
                                color:
                                  (t.risk_score ?? 0) >= 70
                                    ? "var(--sev-block)"
                                    : (t.risk_score ?? 0) >= 35
                                    ? "var(--sev-warn)"
                                    : "var(--text-3)",
                              }}
                            >
                              {t.risk_score != null ? t.risk_score : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 mono text-[11.5px] whitespace-nowrap" style={{ color: "var(--text-4)" }}>
                            {when(t.timestamp)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </Console>
    </div>
  );
}
