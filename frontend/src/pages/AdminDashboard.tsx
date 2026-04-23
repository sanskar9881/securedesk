import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Download, Search, Users, AlertTriangle, FileText, TrendingUp } from "lucide-react";

interface Stats {
  total: number;
  suspicious: number;
  legitimate: number;
  high_risk: number;
  recent_7_days: number;
  total_users: number;
  risk_pct: number;
}

interface Log {
  _id: string;
  sender_name: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  filename: string;
  classification: string;
  risk_score: number;
  severity: string;
  suspicious_keywords: string[];
  timestamp: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterSev, setFilterSev] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const { data } = await api.get("/admin/stats");
      setStats(data);
    } catch {
      /* ignore */
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
        ...(search && { search }),
        ...(filterClass && { classification: filterClass }),
        ...(filterSev && { severity: filterSev }),
      });
      const { data } = await api.get(`/admin/logs?${params}`);
      setLogs(data.data);
      setTotal(data.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterClass, filterSev]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleExport = async () => {
    try {
      const response = await api.get("/admin/export", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "transaction_logs.csv";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Export failed");
    }
  };

  const pieData = stats
    ? [
        { name: "Legitimate", value: stats.legitimate },
        { name: "Suspicious", value: stats.suspicious },
      ]
    : [];

  const PIE_COLORS = ["#22c55e", "#ef4444"];

  const severityBadge = (c: string, sev: string) => {
    if (c === "suspicious") {
      if (sev === "high") return "bg-red-950/50 text-red-400 border border-red-800/40";
      return "bg-amber-950/50 text-amber-400 border border-amber-800/40";
    }
    return "bg-green-950/50 text-green-400 border border-green-800/40";
  };

  const totalPages = Math.ceil(total / 15);

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">System-wide transaction monitoring</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Stat cards */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-indigo-900/50 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-indigo-400" />
                </div>
                <span className="text-gray-500 text-sm">Total</span>
              </div>
              <p className="text-3xl font-bold text-white">{stats.total}</p>
              <p className="text-gray-600 text-xs mt-1">All transactions</p>
            </div>

            <div className="bg-gray-900 border border-red-900/30 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-red-900/30 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-gray-500 text-sm">Suspicious</span>
              </div>
              <p className="text-3xl font-bold text-red-400">{stats.suspicious}</p>
              <p className="text-gray-600 text-xs mt-1">{stats.risk_pct}% risk rate</p>
            </div>

            <div className="bg-gray-900 border border-amber-900/30 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-gray-500 text-sm">This Week</span>
              </div>
              <p className="text-3xl font-bold text-amber-400">{stats.recent_7_days}</p>
              <p className="text-gray-600 text-xs mt-1">Last 7 days</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-teal-900/30 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-teal-400" />
                </div>
                <span className="text-gray-500 text-sm">Users</span>
              </div>
              <p className="text-3xl font-bold text-teal-400">{stats.total_users}</p>
              <p className="text-gray-600 text-xs mt-1">Registered</p>
            </div>
          </div>
        )}

        {/* Charts row */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-medium mb-4 text-sm">Classification split</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
                    labelStyle={{ color: "#fff" }}
                    itemStyle={{ color: "#9ca3af" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-medium mb-4 text-sm">Risk overview</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={[
                    { name: "Legit", count: stats.legitimate },
                    { name: "Suspicious", count: stats.suspicious },
                    { name: "High Risk", count: stats.high_risk },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
                    labelStyle={{ color: "#fff" }}
                    cursor={{ fill: "rgba(99,102,241,0.1)" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    <Cell fill="#22c55e" />
                    <Cell fill="#ef4444" />
                    <Cell fill="#f97316" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Filters + Search */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex flex-wrap items-center gap-4">
            <h2 className="text-white font-semibold flex-1">Transaction Logs</h2>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sender, subject..."
                  className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-52 transition"
                />
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm transition"
              >
                Search
              </button>
            </form>
            <select
              value={filterClass}
              onChange={(e) => { setFilterClass(e.target.value); setPage(1); }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="">All classes</option>
              <option value="legitimate">Legitimate</option>
              <option value="suspicious">Suspicious</option>
            </select>
            <select
              value={filterSev}
              onChange={(e) => { setFilterSev(e.target.value); setPage(1); }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="">All severity</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wide">
                      <th className="text-left px-6 py-3 font-medium">Sender</th>
                      <th className="text-left px-6 py-3 font-medium">Recipient</th>
                      <th className="text-left px-6 py-3 font-medium">Subject</th>
                      <th className="text-left px-6 py-3 font-medium">File</th>
                      <th className="text-left px-6 py-3 font-medium">Status</th>
                      <th className="text-right px-6 py-3 font-medium">Risk %</th>
                      <th className="text-right px-6 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <>
                        <tr
                          key={log._id}
                          onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-3.5 text-gray-300">
                            <div className="font-medium">{log.sender_name}</div>
                            <div className="text-gray-600 text-xs truncate max-w-[140px]">
                              {log.sender_email}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-gray-400 max-w-[140px] truncate">
                            {log.recipient_email}
                          </td>
                          <td className="px-6 py-3.5 text-gray-300 max-w-[160px] truncate">
                            {log.subject}
                          </td>
                          <td className="px-6 py-3.5 text-gray-500 max-w-[100px] truncate">
                            {log.filename || "—"}
                          </td>
                          <td className="px-6 py-3.5">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityBadge(
                                log.classification,
                                log.severity
                              )}`}
                            >
                              {log.classification}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <span
                              className={`font-bold ${
                                log.risk_score >= 70
                                  ? "text-red-400"
                                  : log.risk_score >= 35
                                  ? "text-amber-400"
                                  : "text-green-400"
                              }`}
                            >
                              {log.risk_score}%
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right text-gray-500 text-xs">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                        </tr>
                        {expanded === log._id && (
                          <tr key={`${log._id}-detail`} className="bg-gray-800/20 border-b border-gray-800">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="text-sm space-y-2">
                                <p className="text-gray-400">
                                  <span className="text-gray-600">Severity: </span>
                                  <span className="capitalize font-medium text-gray-300">{log.severity}</span>
                                </p>
                                {log.suspicious_keywords?.length > 0 && (
                                  <div>
                                    <span className="text-gray-600 text-xs">Suspicious keywords: </span>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {log.suspicious_keywords.map((kw) => (
                                        <span
                                          key={kw}
                                          className="bg-red-950/40 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-900/50"
                                        >
                                          {kw}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <p className="text-gray-500 text-xs font-mono">ID: {log._id}</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 flex items-center justify-between text-sm text-gray-500 border-t border-gray-800">
                <span>Showing {logs.length} of {total} transactions</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition text-xs"
                  >
                    Previous
                  </button>
                  <span className="text-gray-400 text-xs">
                    {page} / {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}