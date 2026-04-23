import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import UserCountWidget from "../components/UserCountWidget";
import api from "../api/axios";
import { FileText, Send, TrendingUp, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface Transaction {
  _id: string; recipient_email: string; subject: string; filename: string;
  classification: string; risk_score: number; severity: string; timestamp: string;
}

export default function UserDashboard() {
  const { t } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/files/my-history").then(({ data }) => {
      setTransactions(data); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const stats = {
    total: transactions.length,
    suspicious: transactions.filter((t) => t.classification === "suspicious").length,
    legitimate: transactions.filter((t) => t.classification === "legitimate").length,
    avgRisk: transactions.length > 0
      ? Math.round(transactions.reduce((s, t) => s + t.risk_score, 0) / transactions.length)
      : 0,
  };

  const badgeClass = (c: string, sev: string) => {
    if (c === "suspicious") {
      if (sev === "high") return "bg-red-500/15 text-red-400 border border-red-500/20";
      return "bg-amber-500/15 text-amber-400 border border-amber-500/20";
    }
    return "bg-green-500/15 text-green-400 border border-green-500/20";
  };

  const statCards = [
    { label: t("total_sent"), value: stats.total, color: "indigo", icon: <FileText className="w-5 h-5" /> },
    { label: t("legitimate"), value: stats.legitimate, color: "green", icon: <Shield className="w-5 h-5" /> },
    { label: t("suspicious"), value: stats.suspicious, color: "red", icon: <FileText className="w-5 h-5" /> },
    { label: "Avg Risk", value: `${stats.avgRisk}%`, color: "amber", icon: <TrendingUp className="w-5 h-5" /> },
  ];

  const colorMap: Record<string, string> = {
    indigo: "from-indigo-600/20 to-indigo-600/5 border-indigo-600/20 text-indigo-400",
    green: "from-green-600/20 to-green-600/5 border-green-600/20 text-green-400",
    red: "from-red-600/20 to-red-600/5 border-red-600/20 text-red-400",
    amber: "from-amber-600/20 to-amber-600/5 border-amber-600/20 text-amber-400",
  };

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <Header title={t("dashboard")} subtitle={t("platform_overview")} />
        <UserCountWidget />

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-8 stagger">
          {statCards.map((card) => (
            <div key={card.label}
              className={`stat-card animate-fadeInUp bg-gradient-to-br ${colorMap[card.color]} border rounded-2xl p-5 cursor-default`}>
              <div className={`w-10 h-10 bg-current/10 rounded-xl flex items-center justify-center mb-3 ${colorMap[card.color].split(" ")[3]}`}>
                {card.icon}
              </div>
              <p className="text-gray-400 text-sm">{card.label}</p>
              <p className={`text-3xl font-bold mt-1 ${colorMap[card.color].split(" ")[3]}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Quick action */}
        <div className="mb-8">
          <Link to="/share"
            className="btn-primary inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all">
            <Send className="w-4 h-4" />
            {t("send_file")}
          </Link>
        </div>

        {/* Transactions table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-white font-semibold">{t("recent_transactions")}</h2>
            {transactions.length > 0 && (
              <Link to="/history" className="text-indigo-400 hover:text-indigo-300 text-xs transition">
                View all →
              </Link>
            )}
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <div className="w-14 h-14 bg-gray-800/50 rounded-2xl flex items-center justify-center mb-3">
                <FileText className="w-7 h-7" />
              </div>
              <p className="font-medium">{t("no_transactions")}</p>
              <Link to="/share" className="text-indigo-400 text-sm mt-2 hover:text-indigo-300 transition">{t("send_first")}</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wider">
                    {[t("recipient"), t("subject"), t("file"), t("status"), t("risk"), t("date")].map(h => (
                      <th key={h} className={`px-6 py-3 font-semibold ${h === t("risk") || h === t("date") ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 8).map((tx) => (
                    <tr key={tx._id} className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3.5 text-gray-300 max-w-[150px] truncate">{tx.recipient_email}</td>
                      <td className="px-6 py-3.5 text-gray-300 max-w-[150px] truncate">{tx.subject}</td>
                      <td className="px-6 py-3.5 text-gray-500 max-w-[120px] truncate">{tx.filename || "—"}</td>
                      <td className="px-6 py-3.5">
                        <span className={`badge text-xs px-2.5 py-1 rounded-full font-medium ${badgeClass(tx.classification, tx.severity)}`}>
                          {tx.classification}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className={`font-bold ${tx.risk_score >= 70 ? "text-red-400" : tx.risk_score >= 35 ? "text-amber-400" : "text-green-400"}`}>
                          {tx.risk_score}%
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right text-gray-500 text-xs">{new Date(tx.timestamp).toLocaleDateString()}</td>
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