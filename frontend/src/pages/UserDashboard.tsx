import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { Send, FileText, ShieldCheck, ShieldAlert, TrendingUp, Clock } from "lucide-react";

interface Stats {
  total: number; legitimate: number; suspicious: number; avg_risk: number;
}
interface Tx {
  _id: string; recipient_email: string; subject: string; filename: string;
  classification: string; risk_score: number; severity: string; timestamp: string;
}

export default function UserDashboard() {
  const { user, t } = useAuth();
  const [stats, setStats] = useState<Stats>({ total:0, legitimate:0, suspicious:0, avg_risk:0 });
  const [txs, setTxs]     = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/files/my-history").catch(() => ({ data: [] })),
      api.get("/admin/stats").catch(() => ({ data: null })),
    ]).then(([histRes, statsRes]) => {
      const hist = histRes.data as Tx[];
      setTxs(hist.slice(0, 8));
      const total      = hist.length;
      const legit      = hist.filter(h => h.classification === "legitimate").length;
      const suspicious = hist.filter(h => h.classification === "suspicious").length;
      const avg        = total > 0
        ? Math.round(hist.reduce((s,h) => s + (h.risk_score||0), 0) / total)
        : 0;
      setStats({ total, legitimate: legit, suspicious, avg_risk: avg });

      // If admin stats available, merge total users
      if (statsRes.data) {
        // keep local file stats
      }
    }).finally(() => setLoading(false));
  }, []);

  const severityColor = (s: string) =>
    s === "high"   ? "text-red-400 bg-red-950/40 border-red-800/40" :
    s === "medium" ? "text-amber-400 bg-amber-950/40 border-amber-800/40" :
                     "text-green-400 bg-green-950/40 border-green-800/40";

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <Header title="Dashboard" subtitle="Platform Overview" />

        {/* Stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> Platform Overview
          </p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label:"Total Sent",   val: stats.total,       icon:<FileText className="w-5 h-5 text-indigo-400"/>,  color:"text-white" },
              { label:"Legitimate",   val: stats.legitimate,  icon:<ShieldCheck className="w-5 h-5 text-green-400"/>, color:"text-green-400" },
              { label:"Suspicious",   val: stats.suspicious,  icon:<ShieldAlert className="w-5 h-5 text-red-400"/>,   color:"text-red-400" },
              { label:"Avg Risk",     val: `${stats.avg_risk}%`, icon:<TrendingUp className="w-5 h-5 text-amber-400"/>, color:"text-amber-400" },
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

        {/* Send file CTA */}
        <Link to="/share"
          className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-4 rounded-2xl font-semibold mb-6 transition shadow-lg shadow-indigo-500/20 w-fit">
          <Send className="w-5 h-5" /> Send File
        </Link>

        {/* Recent transactions */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" /> Recent Transactions
            </h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : txs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-600">
              <FileText className="w-12 h-12 mb-3"/>
              <p className="text-sm font-medium">No transactions yet</p>
              <Link to="/share" className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm transition">
                Send your first file →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                    {["Recipient","Subject","File","Status","Risk","Date"].map(h => (
                      <th key={h} className="text-left px-6 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txs.map(tx => (
                    <tr key={tx._id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition">
                      <td className="px-6 py-3 text-gray-300 truncate max-w-[140px]">{tx.recipient_email}</td>
                      <td className="px-6 py-3 text-gray-400 truncate max-w-[140px]">{tx.subject}</td>
                      <td className="px-6 py-3 text-gray-500 truncate max-w-[120px]">{tx.filename || "—"}</td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize
                          ${tx.classification === "legitimate"
                            ? "text-green-400 bg-green-950/40 border-green-800/40"
                            : "text-red-400 bg-red-950/40 border-red-800/40"}`}>
                          {tx.classification}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${severityColor(tx.severity)}`}>
                          {tx.severity}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs">
                        {new Date(tx.timestamp).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
