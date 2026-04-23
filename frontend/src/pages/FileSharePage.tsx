import { useState, useRef } from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Send, Paperclip, X, AlertTriangle, CheckCircle, AlertCircle,
  Shield, FileWarning, Eye, CreditCard, Phone, Mail,
} from "lucide-react";

interface ContentFinding { type: string; count: number; severity: string; description: string; }
interface ContentAnalysis {
  sensitive_data: ContentFinding[];
  malware_patterns: string[];
  sensitive_keywords: string[];
  pii_detected: boolean;
  content_risk_score: number;
}
interface Result {
  classification: string; risk_score: number; severity: string;
  suspicious_keywords: string[]; transaction_id: string;
  content_analysis?: ContentAnalysis;
}

const severityIcon: Record<string, string> = {
  critical: "🔴", high: "🔴", medium: "🟡", low: "🟢",
};
const findingIcon: Record<string, React.ReactNode> = {
  "PAN Card": <CreditCard className="w-3.5 h-3.5" />,
  "Aadhaar Number": <Eye className="w-3.5 h-3.5" />,
  "Credit/Debit Card": <CreditCard className="w-3.5 h-3.5" />,
  "Phone Numbers": <Phone className="w-3.5 h-3.5" />,
  "Email Addresses": <Mail className="w-3.5 h-3.5" />,
};

export default function FileSharePage() {
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const form = new FormData();
    form.append("recipient_email", recipient);
    form.append("subject", subject);
    form.append("body", body);
    if (file) form.append("file", file);
    try {
      const { data } = await api.post("/files/send", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      if (data.classification === "suspicious") {
        toast.error("⚠️ Transaction flagged as suspicious!");
      } else {
        toast.success("✅ File sent & analyzed");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail || "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (score: number) =>
    score >= 70 ? "text-red-400" : score >= 35 ? "text-amber-400" : "text-green-400";
  const riskBarColor = (score: number) =>
    score >= 70 ? "bg-gradient-to-r from-red-700 to-red-400"
    : score >= 35 ? "bg-gradient-to-r from-amber-700 to-amber-400"
    : "bg-gradient-to-r from-green-700 to-green-400";
  const cardBorder = (sev: string) =>
    sev === "high" ? "border-red-800/50 bg-red-950/10"
    : sev === "medium" ? "border-amber-800/50 bg-amber-950/10"
    : "border-green-800/50 bg-green-950/10";

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <Header title="Send File" subtitle="AI analyzes every transaction for threats and sensitive data" />

        <div className="grid grid-cols-2 gap-6 max-w-5xl">
          {/* Form */}
          <div className="animate-fadeInUp">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recipient Email</label>
                  <input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)}
                    placeholder="recipient@company.com" required
                    className="input-field w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Subject</label>
                  <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject..." required
                    className="input-field w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Message</label>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your message..." rows={5} required
                    className="input-field w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm resize-none" />
                </div>

                {/* File upload */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Attachment (optional)</label>
                  <input type="file" ref={fileRef} onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
                  {file ? (
                    <div className="flex items-center gap-3 bg-gray-800 border border-indigo-600/30 rounded-xl px-4 py-3 group">
                      <Paperclip className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <span className="text-white text-sm flex-1 truncate">{file.name}</span>
                      <span className="text-gray-500 text-xs">{(file.size / 1024).toFixed(0)} KB</span>
                      <button type="button" onClick={() => setFile(null)}
                        className="text-gray-500 hover:text-red-400 transition ml-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 bg-gray-800/60 border border-dashed border-gray-700 hover:border-indigo-500/60 hover:bg-gray-800 rounded-xl px-4 py-5 text-gray-400 hover:text-indigo-400 transition-all duration-200 text-sm group">
                      <Paperclip className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Click to attach · AI will scan content for sensitive data
                    </button>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="btn-primary w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                  {loading ? (
                    <><span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" /> Analyzing & Sending...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send & Analyze</>
                  )}
                </button>
              </form>
            </div>

            {/* Info box */}
            <div className="mt-4 bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 flex items-start gap-3">
              <Shield className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <p className="text-gray-500 text-xs leading-relaxed">
                Every file is scanned for <strong className="text-gray-400">PAN cards, Aadhaar numbers, credit card data, malware patterns</strong>, and 30+ suspicious keywords. Risk score is calculated in real-time.
              </p>
            </div>
          </div>

          {/* Results */}
          <div className="animate-fadeInUp" style={{ animationDelay: "100ms" }}>
            {!result ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center mb-4 border border-indigo-600/20">
                  <Shield className="w-8 h-8 text-indigo-600/40" />
                </div>
                <p className="text-gray-500 text-sm font-medium">AI Analysis Results</p>
                <p className="text-gray-700 text-xs mt-1">Send a file to see the risk report here</p>
              </div>
            ) : (
              <div className={`border rounded-2xl p-6 animate-fadeIn ${cardBorder(result.severity)}`}>
                {/* Header */}
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-800/40">
                  {result.severity === "high" ? (
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  ) : result.severity === "medium" ? (
                    <AlertCircle className="w-6 h-6 text-amber-400" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  )}
                  <div>
                    <p className="text-white font-bold text-base">
                      AI:{" "}
                      <span className={result.classification === "suspicious" ? "text-red-400" : "text-green-400"}>
                        {result.classification.toUpperCase()}
                      </span>
                    </p>
                    <p className="text-gray-500 text-xs">ID: {result.transaction_id.slice(0, 12)}...</p>
                  </div>
                </div>

                {/* Risk Score */}
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Risk Score</span>
                    <span className={`text-2xl font-bold ${riskColor(result.risk_score)}`}>{result.risk_score}%</span>
                  </div>
                  <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full risk-bar-fill ${riskBarColor(result.risk_score)}`}
                      style={{ width: `${result.risk_score}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-700 mt-1">
                    <span>Safe</span><span>Suspicious</span><span>Dangerous</span>
                  </div>
                </div>

                {/* Content Analysis */}
                {result.content_analysis && (
                  <div className="mb-5 space-y-3">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                      <FileWarning className="w-3.5 h-3.5" /> File Content Scan
                    </p>

                    {result.content_analysis.sensitive_data.length > 0 ? (
                      <div className="space-y-2">
                        {result.content_analysis.sensitive_data.map((item, i) => (
                          <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                            item.severity === "critical" ? "bg-red-950/40 border-red-800/40"
                            : item.severity === "high" ? "bg-red-950/20 border-red-900/30"
                            : "bg-amber-950/20 border-amber-900/30"
                          }`}>
                            <span className="text-gray-400">{findingIcon[item.type] || <Eye className="w-3.5 h-3.5" />}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold ${item.severity === "critical" || item.severity === "high" ? "text-red-300" : "text-amber-300"}`}>
                                {severityIcon[item.severity]} {item.type}
                              </p>
                              <p className="text-gray-500 text-xs truncate">{item.description}</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              item.severity === "critical" ? "bg-red-900/50 text-red-400"
                              : item.severity === "high" ? "bg-red-900/30 text-red-400"
                              : "bg-amber-900/30 text-amber-400"
                            }`}>{item.count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-400 bg-green-950/20 border border-green-900/30 rounded-xl px-3 py-2.5">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs">No sensitive data detected in file</span>
                      </div>
                    )}

                    {result.content_analysis.malware_patterns.length > 0 && (
                      <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-3">
                        <p className="text-red-400 text-xs font-semibold mb-1">⚠️ Malware Patterns Detected</p>
                        {result.content_analysis.malware_patterns.map((p, i) => (
                          <code key={i} className="block text-red-300 text-xs font-mono bg-red-950/40 px-2 py-0.5 rounded mt-1">{p}</code>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Suspicious keywords */}
                {result.suspicious_keywords.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Suspicious Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.suspicious_keywords.map((kw) => (
                        <span key={kw} className="badge bg-red-900/40 text-red-300 text-xs px-2.5 py-1 rounded-full border border-red-800/50">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}