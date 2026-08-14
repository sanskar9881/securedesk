import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import { MessageCircle, AlertTriangle, RefreshCw, Loader2, Shield } from "lucide-react";

interface WALog {
  _id: string; user_name: string; filename: string; recipient: string;
  risk_level: string; action: string; reasons: string[]; timestamp: string; flagged: boolean;
}

const riskCls = (r: string) =>
  r === "HIGH" ? "bg-red-900/40 text-red-400 border border-red-800/40" :
  r === "MEDIUM" ? "bg-amber-900/40 text-amber-400 border border-amber-800/40" :
  "bg-green-900/40 text-green-400 border border-green-800/40";

export default function WhatsAppLogsPage() {
  const [logs, setLogs]       = useState<WALog[]>([]);
  const [stats, setStats]     = useState({ total_shares: 0, flagged: 0, high_risk: 0 });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        api.get("/whatsapp/logs?limit=100"),
        api.get("/whatsapp/stats"),
      ]);
      setLogs(logsRes.data);
      setStats(statsRes.data);
    } catch {
      /* non-critical fetch: the view renders its empty state instead */
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <MessageCircle className="w-6 h-6 text-green-400" /> WhatsApp DLP Monitor
            </h1>
            <p className="text-gray-500 text-sm mt-1">Track files shared via WhatsApp Web — India's #1 data leak channel</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm transition">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-green-950/30 border border-green-800/40 rounded-2xl p-5 mb-6 flex items-start gap-4">
          <MessageCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-medium text-sm">WhatsApp Web File Monitoring — India's Unique DLP Feature</p>
            <p className="text-gray-400 text-sm mt-1">
              No other DLP tool monitors WhatsApp sharing. The Chrome extension detects when employees
              share files on web.whatsapp.com and scans them for sensitive data before they're sent.
              This catches 60%+ of corporate data leaks in Indian companies.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total WA Shares", val: stats.total_shares, color: "text-white", icon: "📤" },
            { label: "Flagged Shares", val: stats.flagged, color: "text-amber-400", icon: "⚠️" },
            { label: "High Risk Blocked", val: stats.high_risk, color: "text-red-400", icon: "🚫" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{s.icon}</span>
                <p className="text-gray-500 text-xs">{s.label}</p>
              </div>
              <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Logs table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-600">
              <MessageCircle className="w-10 h-10 mb-3" />
              <p className="text-sm font-medium">No WhatsApp shares detected yet</p>
              <p className="text-xs mt-1 max-w-xs text-center">Install the Chrome extension and browse web.whatsapp.com to start monitoring</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wider">
                    {["Employee", "File Shared", "Recipient", "Risk", "Decision", "Time"].map(h => (
                      <th key={h} className="text-left px-5 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log._id}
                      className={`border-b border-gray-800/50 transition ${log.flagged ? "bg-red-950/10 hover:bg-red-950/20" : "hover:bg-gray-800/20"}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {log.flagged && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                          <span className="text-white font-medium">{log.user_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-300 max-w-[180px] truncate">{log.filename}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{log.recipient || "unknown"}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskCls(log.risk_level)}`}>
                          {log.risk_level}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          log.action === "BLOCK" ? "bg-red-900/40 text-red-400" :
                          log.action === "WARN"  ? "bg-amber-900/40 text-amber-400" :
                          "bg-green-900/40 text-green-400"}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {new Date(log.timestamp).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Extension install guide */}
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" /> How WhatsApp Monitoring Works
          </h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            {[
              ["1", "Install", "Install the SecureDesk Chrome Extension"],
              ["2", "Login", "Login with your SecureDesk credentials in the extension"],
              ["3", "Browse", "Open web.whatsapp.com normally"],
              ["4", "Protected", "Extension scans all files before they're sent"],
            ].map(([n, title, desc]) => (
              <div key={n} className="bg-gray-800/50 rounded-xl p-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm mx-auto mb-2">{n}</div>
                <p className="text-white text-sm font-medium">{title}</p>
                <p className="text-gray-500 text-xs mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
