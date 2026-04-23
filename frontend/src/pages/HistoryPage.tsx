import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import { FileText } from "lucide-react";
import { Link } from "react-router-dom";

interface Transaction {
  _id: string;
  recipient_email: string;
  subject: string;
  body: string;
  filename: string;
  classification: string;
  risk_score: number;
  severity: string;
  suspicious_keywords: string[];
  timestamp: string;
}

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.get("/files/my-history").then(({ data }) => {
      setTransactions(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const badgeClass = (c: string, sev: string) => {
    if (c === "suspicious") {
      if (sev === "high") return "bg-red-950/50 text-red-400 border border-red-800/50";
      return "bg-amber-950/50 text-amber-400 border border-amber-800/50";
    }
    return "bg-green-950/50 text-green-400 border border-green-800/50";
  };

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">My History</h1>
          <p className="text-gray-500 text-sm mt-1">All your file transactions</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-semibold">All Transactions ({transactions.length})</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <FileText className="w-12 h-12 mb-3" />
              <p>No transactions yet</p>
              <Link to="/share" className="text-indigo-400 text-sm mt-2">
                Send your first file →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3 font-medium">Recipient</th>
                    <th className="text-left px-6 py-3 font-medium">Subject</th>
                    <th className="text-left px-6 py-3 font-medium">File</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                    <th className="text-right px-6 py-3 font-medium">Risk %</th>
                    <th className="text-right px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <>
                      <tr
                        key={t._id}
                        onClick={() => setExpanded(expanded === t._id ? null : t._id)}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 text-gray-300 max-w-[160px] truncate">
                          {t.recipient_email}
                        </td>
                        <td className="px-6 py-4 text-gray-300 max-w-[160px] truncate">
                          {t.subject}
                        </td>
                        <td className="px-6 py-4 text-gray-500 max-w-[120px] truncate">
                          {t.filename || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${badgeClass(
                              t.classification,
                              t.severity
                            )}`}
                          >
                            {t.classification}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`font-bold ${
                              t.risk_score >= 70
                                ? "text-red-400"
                                : t.risk_score >= 35
                                ? "text-amber-400"
                                : "text-green-400"
                            }`}
                          >
                            {t.risk_score}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-500">
                          {new Date(t.timestamp).toLocaleString()}
                        </td>
                      </tr>
                      {expanded === t._id && (
                        <tr key={`${t._id}-detail`} className="bg-gray-800/20 border-b border-gray-800">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="text-sm space-y-2">
                              <p className="text-gray-400">
                                <span className="text-gray-600">Severity: </span>
                                <span className="capitalize font-medium text-gray-300">{t.severity}</span>
                              </p>
                              {t.body && (
                                <p className="text-gray-500 text-xs">
                                  <span className="text-gray-600">Body: </span>{t.body}
                                </p>
                              )}
                              {t.suspicious_keywords?.length > 0 && (
                                <div>
                                  <span className="text-gray-600 text-xs">Suspicious keywords: </span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {t.suspicious_keywords.map((kw) => (
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
                              <p className="text-gray-600 text-xs font-mono">ID: {t._id}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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