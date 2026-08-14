import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useSidebar } from "../context/SidebarContext";
import api from "../api/axios";
import toast from "react-hot-toast";
import { apiErrorMessage } from "../api/errors";
import { ShieldCheck, AlertTriangle, FileText, ExternalLink, Loader2, RefreshCw, Download } from "lucide-react";

interface Score {
  score: number; label: string; total_files: number;
  high_risk: number; blocked: number; total_events: number; alerts: number;
}

export default function CompliancePage() {
  const { collapsed } = useSidebar();
  const [score, setScore]     = useState<Score | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/compliance/score")
      .then(({ data }) => setScore(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openReport = async () => {
    // window.open() sends no Authorization header, so hitting the endpoint
    // directly returns 401. Fetch it through the authenticated client and
    // hand the browser the HTML we got back.
    try {
      const { data } = await api.get("/compliance/report", { responseType: "text" });
      const url = URL.createObjectURL(new Blob([data], { type: "text/html" }));
      const tab = window.open(url, "_blank");
      if (!tab) toast.error("Allow pop-ups to view the report.");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, "Couldn't generate the report."));
    }
  };

  const scoreColor = !score ? "#1657C4"
    : score.score >= 80 ? "#22c55e"
    : score.score >= 60 ? "#f59e0b" : "#ef4444";

  const scoreLabel = !score ? "" : score.score >= 80 ? "COMPLIANT" : score.score >= 60 ? "NEEDS ATTENTION" : "AT RISK";

  return (
    <div className="flex">
      <Navbar />
      <main className={`ml-0 flex-1 min-w-0 min-h-screen bg-gray-950 p-3 md:p-8 transition-all duration-300 ${collapsed ? "lg:ml-[72px]" : "lg:ml-64"}`}>
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">DPDP Compliance</h1>
            <p className="text-gray-500 text-sm mt-1">Digital Personal Data Protection Act 2023 — compliance posture</p>
          </div>
          <div className="flex gap-3">
            <button onClick={load} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm transition">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={openReport}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shadow-lg shadow-indigo-500/20">
              <Download className="w-4 h-4" /> Download Report
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        ) : score ? (
          <div className="space-y-6 max-w-4xl">

            {/* Score card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex items-center gap-8">
              <div className="relative flex-shrink-0">
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="58" fill="none" stroke="#1f2937" strokeWidth="12"/>
                  <circle cx="70" cy="70" r="58" fill="none" stroke={scoreColor} strokeWidth="12"
                    strokeDasharray={`${(score.score / 100) * 364} 364`}
                    strokeLinecap="round" transform="rotate(-90 70 70)" style={{ transition: "stroke-dasharray 1s ease" }}/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white">{score.score}</span>
                  <span className="text-xs text-gray-500">/ 100</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
                  {score.score >= 80
                    ? <ShieldCheck className="w-6 h-6 text-green-400" />
                    : <AlertTriangle className="w-6 h-6 text-amber-400" />}
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Your organization's DPDP Act 2023 compliance score based on file risk levels,
                  blocked events, and security alerts over the last 30 days.
                </p>
                <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3">
                  <p className="text-amber-400 text-xs font-medium">
                    ⚖️ Non-compliance with DPDP Act 2023 can result in penalties up to <strong>₹250 Crore</strong>.
                    This report demonstrates your security posture to auditors and clients.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {[
                { label:"Files Scanned", val: score.total_files, color:"text-white", icon:"📁" },
                { label:"High Risk Files", val: score.high_risk, color:"text-red-400", icon:"🔴" },
                { label:"Files Blocked", val: score.blocked, color:"text-green-400", icon:"🚫" },
                { label:"Total Events Logged", val: score.total_events, color:"text-white", icon:"📋" },
                { label:"Security Alerts", val: score.alerts, color:"text-amber-400", icon:"⚠️" },
                { label:"Compliance Score", val: `${score.score}/100`, color: score.score >= 80 ? "text-green-400" : "text-amber-400", icon:"🛡️" },
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

            {/* Controls checklist */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Compliance Controls
              </h3>
              <div className="space-y-3">
                {[
                  ["Data Discovery & AI Classification", "Scans all files for PAN, Aadhaar, credit cards"],
                  ["Role-Based Access Control", "Admin / Manager / User permissions enforced via JWT"],
                  ["Full Audit Trail", "Every file action logged with timestamp and user identity"],
                  ["File Fingerprinting", "SHA-256 hash tracking — duplicate detection active"],
                  ["High-Risk File Blocking", "Automatic blocking of files above risk threshold"],
                  ["Real-Time Anomaly Detection", "UEBA monitors unusual employee behavior patterns"],
                  ["Phishing Detection", "AI-powered email and URL threat analysis"],
                  ["File Watermarking", "Invisible metadata embedded in all uploaded documents"],
                  ["Security Alerts", "Instant notifications for high-risk events"],
                  ["Compliance Reporting", "One-click DPDP compliance report generation"],
                ].map(([ctrl, desc]) => (
                  <div key={ctrl} className="flex items-start gap-3 py-2.5 border-b border-gray-800 last:border-0">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    <div>
                      <p className="text-white text-sm font-medium">{ctrl}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Download button */}
            <button onClick={openReport}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-3 transition shadow-xl shadow-indigo-500/20">
              <ExternalLink className="w-5 h-5" />
              Generate & Download Full DPDP Compliance Report (PDF-ready)
            </button>
          </div>
        ) : (
          <p className="text-gray-500">Failed to load compliance data.</p>
        )}
      </main>
    </div>
  );
}
