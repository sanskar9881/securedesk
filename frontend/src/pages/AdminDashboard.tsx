import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import { Link } from "react-router-dom";
import api from "../api/axios";
import {
  Users, ShieldCheck, ShieldAlert, TrendingUp,
  FileText, Activity, Brain, Clock, AlertTriangle
} from "lucide-react";

interface Stats {
  total_users: number; admins: number; regular_users: number;
  total_transactions: number; suspicious: number; legitimate: number; avg_risk: number;
}
interface Tx {
  _id: string; sender_name: string; recipient_email: string; subject: string;
  classification: string; risk_score: number; severity: string; timestamp: string;
}
interface Alert { _id: string; message: string; severity: string; timestamp: string; }

export default function AdminDashboard() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [txs, setTxs]       = useState<Tx[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/admin/stats").catch(() => ({ data: null })),
      api.get("/admin/transactions").catch(() => ({ data: [] })),
      api.get("/dlp/alerts").catch(() => ({ data: [] })),
    ]).then(([statsRes, txRes, alertRes]) => {
      if (statsRes.data) setStats(statsRes.data);
      setTxs((txRes.data as Tx[]).slice(0, 8));
      setAlerts((alertRes.data as Alert[]).slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  const sev = (s: string) =>
    s === "high"   ? "text-red-400 bg-red-950/40 border-red-800/40" :
    s === "medium" ? "text-amber-400 bg-amber-950/40 border-amber-800/40" :
                     "text-green-400 bg-green-950/40 border-green-800/40";

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <Header title="Dashboard" subtitle="Platform Overview" />

        {/* Top stats row */}
        {stats && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5"/> Platform Overview
            </p>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label:"Total Users",    val: stats.total_users,       icon:<Users className="w-5 h-5 text-indigo-400"/>,   color:"text-white" },
                { label:"Admins",         val: stats.admins,            icon:<ShieldCheck className="w-5 h-5 text-amber-400"/>,color:"text-amber-400" },
                { label:"Regular Users",  val: stats.regular_users,     icon:<Users className="w-5 h-5 text-teal-400"/>,     color:"text-teal-400" },
                { label:"Transactions",   val: stats.total_transactions, icon:<Activity className="w-5 h-5 text-purple-400"/>,color:"text-white" },
              ].map(s => (
                <div key={s.label} className="bg-gray-800/50 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">{s.label}</p>
                    <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label:"Total Sent",  val: stats.total_transactions, color:"bg-indigo-950/30 border-indigo-800/30", num:"text-white" },
              { label:"Legitimate",  val: stats.legitimate,         color:"bg-green-950/30 border-green-800/30",  num:"text-green-400" },
              { label:"Suspicious",  val: stats.suspicious,         color:"bg-red-950/30 border-red-800/30",     num:"text-red-400" },
              { label:"Avg Risk",    val: `${stats.avg_risk ?? 0}%`,color:"bg-amber-950/30 border-amber-800/30", num:"text-amber-400" },
            ].map(s => (
              <div key={s.label} className={`border rounded-2xl p-5 ${s.color}`}>
                <p className="text-gray-500 text-xs">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.num}`}>{s.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { to:"/admin/users",  icon:<Users className="w-5 h-5"/>,     label:"Manage Users",      color:"from-indigo-600 to-indigo-700" },
            { to:"/activity",     icon:<Activity className="w-5 h-5"/>,   label:"Activity Logs",    color:"from-teal-600 to-teal-700" },
            { to:"/ai-copilot",   icon:<Brain className="w-5 h-5"/>,      label:"AI Copilot",       color:"from-purple-600 to-purple-700" },
            { to:"/compliance",   icon:<ShieldCheck className="w-5 h-5"/>,label:"Compliance Report",color:"from-amber-600 to-amber-700" },
          ].map(a => (
            <Link key={a.to} to={a.to}
              className={`bg-gradient-to-br ${a.color} text-white rounded-2xl p-4 flex items-center gap-3 hover:opacity-90 transition shadow-lg font-medium text-sm`}>
              {a.icon} {a.label}
            </Link>
          ))}
        </div>

        {/* Alerts + transactions */}
        <div className="grid grid-cols-2 gap-6">
          {/* Alerts */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400"/>
              <h3 className="text-white font-semibold text-sm">Recent Alerts</h3>
            </div>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-gray-600">
                <ShieldCheck className="w-8 h-8 mb-2 text-green-700"/>
                <p className="text-sm">No active alerts</p>
              </div>
            ) : alerts.map(a => (
              <div key={a._id} className="px-5 py-3 border-b border-gray-800/50 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"/>
                <div>
                  <p className="text-gray-200 text-xs">{a.message}</p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    {new Date(a.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent transactions */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400"/>
              <h3 className="text-white font-semibold text-sm">Recent Transactions</h3>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
              </div>
            ) : txs.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-gray-600">
                <FileText className="w-8 h-8 mb-2"/>
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : txs.map(tx => (
              <div key={tx._id} className="px-5 py-3 border-b border-gray-800/50 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-gray-300 text-xs font-medium truncate">{tx.subject || "No subject"}</p>
                  <p className="text-gray-500 text-xs truncate">{tx.sender_name} → {tx.recipient_email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ml-3 capitalize ${sev(tx.severity)}`}>
                  {tx.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
