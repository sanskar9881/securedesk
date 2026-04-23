import { useState } from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  ShieldAlert, ShieldCheck, ShieldX, AlertTriangle,
  Link as LinkIcon, Search, Mail, Info, Copy, CheckCircle2
} from "lucide-react";

interface PhishingResult {
  verdict: string;
  severity: string;
  risk_score: number;
  suspicious_keywords: string[];
  suspicious_urls: { url: string; reason: string }[];
  urgency_signals: string[];
  spoof_sender_detected: boolean;
  threats: string[];
  url_count: number;
  recommendation: string;
  check_id: string;
}

const SOURCES = [
  { value: "manual", label: "📋 Paste Text" },
  { value: "email", label: "📧 Email" },
  { value: "teams", label: "💬 MS Teams" },
  { value: "slack", label: "🔵 Slack" },
  { value: "whatsapp", label: "📱 WhatsApp" },
];

const PHISHING_EXAMPLE = {
  sender: "security@paypa1-alert.com",
  subject: "URGENT: Your PayPal account has been suspended",
  content: `Dear Customer,

We detected unusual activity on your PayPal account. Your account has been temporarily suspended.

To restore access, you must verify your credentials IMMEDIATELY:
http://192.168.1.105/paypal/verify?token=abc123

Please provide:
- Your password
- Credit card CVV number  
- OTP / PIN
- Social Security Number

This is URGENT. Act now or your account will be permanently deleted within 24 hours.

Click here: http://paypa1-support.xyz/login

Regards,
PayPal Security Team`,
};

export default function PhishingPage() {
  const [content, setContent] = useState("");
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [source, setSource] = useState("manual");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhishingResult | null>(null);
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCheck = async () => {
    if (!content.trim()) { toast.error("Paste message content to check"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/phishing/check", { content, sender, subject, source });
      setResult(data);
      if (data.verdict === "phishing") toast.error("⚠️ PHISHING DETECTED!");
      else if (data.verdict === "suspicious") toast("⚠️ Suspicious content found", { icon: "⚠️" });
      else toast.success("✅ Content appears safe");
    } catch {
      toast.error("Check failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    setSender(PHISHING_EXAMPLE.sender);
    setSubject(PHISHING_EXAMPLE.subject);
    setContent(PHISHING_EXAMPLE.content);
    setSource("email");
    toast("Example phishing email loaded! Hit 'Check for Threats'", { icon: "📧" });
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText("http://localhost:8000/api/phishing/check");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const verdictConfig: Record<string, { bg: string; icon: JSX.Element; color: string; label: string }> = {
    phishing: {
      bg: "border-red-800/50 bg-red-950/20",
      icon: <ShieldX className="w-6 h-6 text-red-400" />,
      color: "text-red-400",
      label: "⚠ PHISHING DETECTED",
    },
    suspicious: {
      bg: "border-amber-800/50 bg-amber-950/20",
      icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
      color: "text-amber-400",
      label: "SUSPICIOUS",
    },
    safe: {
      bg: "border-green-800/50 bg-green-950/20",
      icon: <ShieldCheck className="w-6 h-6 text-green-400" />,
      color: "text-green-400",
      label: "✓ SAFE",
    },
  };

  const vc = verdictConfig[result?.verdict || "safe"];

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <Header title="Phishing Detector" subtitle="Instantly check any email or message for threats" />

        {/* Email Connect Banner */}
        <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-2xl p-4 mb-6 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-medium">Connect your email for auto-scanning</p>
            <p className="text-gray-400 text-xs mt-0.5">Forward suspicious emails to our API or use the manual checker below</p>
          </div>
          <button
            onClick={() => setShowEmailSetup(!showEmailSetup)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex-shrink-0"
          >
            <Mail className="w-4 h-4" />
            {showEmailSetup ? "Hide Setup" : "Setup Guide"}
          </button>
        </div>

        {/* Email Setup Guide */}
        {showEmailSetup && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400" />
              How to Connect Your Email for Auto-Scanning
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Gmail Setup */}
                <div className="bg-gray-800/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">📧</span>
                    <p className="text-white font-medium text-sm">Gmail Setup</p>
                  </div>
                  <ol className="space-y-2 text-xs text-gray-400">
                    <li className="flex gap-2"><span className="text-indigo-400 font-bold">1.</span> Open Gmail → Settings → Filters</li>
                    <li className="flex gap-2"><span className="text-indigo-400 font-bold">2.</span> Create filter: "From: *" (all emails)</li>
                    <li className="flex gap-2"><span className="text-indigo-400 font-bold">3.</span> Forward to your SecureDesk webhook</li>
                    <li className="flex gap-2"><span className="text-indigo-400 font-bold">4.</span> Or manually paste suspicious emails below</li>
                  </ol>
                </div>
                {/* Outlook Setup */}
                <div className="bg-gray-800/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">📨</span>
                    <p className="text-white font-medium text-sm">Outlook / MS Teams</p>
                  </div>
                  <ol className="space-y-2 text-xs text-gray-400">
                    <li className="flex gap-2"><span className="text-indigo-400 font-bold">1.</span> Open Outlook → Rules → Create Rule</li>
                    <li className="flex gap-2"><span className="text-indigo-400 font-bold">2.</span> Add condition: "Subject contains urgent/verify"</li>
                    <li className="flex gap-2"><span className="text-indigo-400 font-bold">3.</span> Action: Forward to SecureDesk webhook</li>
                    <li className="flex gap-2"><span className="text-indigo-400 font-bold">4.</span> Or copy-paste from Teams/Outlook below</li>
                  </ol>
                </div>
              </div>
              {/* API Endpoint */}
              <div className="bg-gray-800/60 rounded-xl p-4">
                <p className="text-gray-400 text-xs font-medium mb-2">Your SecureDesk API Endpoint (for integrations):</p>
                <div className="flex items-center gap-3 bg-gray-900 rounded-lg px-3 py-2">
                  <code className="text-indigo-300 text-xs flex-1">POST http://localhost:8000/api/phishing/check</code>
                  <button onClick={handleCopyWebhook} className="text-gray-400 hover:text-white transition">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-gray-600 text-xs mt-2">Body: {"{ content, sender, subject, source }"} · Auth: Bearer token required</p>
              </div>
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3">
                <p className="text-amber-400 text-xs font-medium">💡 Current Version:</p>
                <p className="text-gray-400 text-xs mt-1">Full email plugin integration (Outlook add-in, Gmail extension) is coming in the next release. For now, copy-paste any suspicious email content into the checker below — it works exactly the same way.</p>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-5xl grid grid-cols-5 gap-6">
          {/* Input Panel */}
          <div className="col-span-3 space-y-4">
            {/* Source tabs */}
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSource(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    source === s.value ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Sender / From Address
                </label>
                <input
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="sender@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Subject / Title
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject or message title"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Message Content <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste the full email body, message, or suspicious text here..."
                  rows={9}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCheck}
                  disabled={loading || !content.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition"
                >
                  {loading ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {loading ? "Analyzing Threats..." : "Check for Threats"}
                </button>
                <button
                  onClick={() => { setContent(""); setSender(""); setSubject(""); setResult(null); }}
                  className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl text-sm transition"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Load example */}
            <button
              onClick={loadExample}
              className="w-full bg-gray-900/60 hover:bg-gray-800 border border-dashed border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-400 hover:text-indigo-400 transition flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              Load a phishing example to test the detector
            </button>
          </div>

          {/* Result Panel */}
          <div className="col-span-2">
            {!result ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center h-full text-center min-h-[400px]">
                <ShieldAlert className="w-12 h-12 text-gray-700 mb-4" />
                <p className="text-gray-500 text-sm font-medium mb-1">No analysis yet</p>
                <p className="text-gray-700 text-xs">Paste email content and click<br />"Check for Threats" to start</p>
              </div>
            ) : (
              <div className={`border rounded-2xl p-5 ${vc.bg}`}>
                {/* Verdict header */}
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-800/50">
                  {vc.icon}
                  <div>
                    <p className={`font-bold text-lg ${vc.color}`}>{vc.label}</p>
                    <p className="text-gray-500 text-xs">ID: {result.check_id.slice(0, 8)}...</p>
                  </div>
                </div>

                {/* Risk score bar */}
                <div className="mb-5">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-400 font-medium">Risk Score</span>
                    <span className={`font-bold text-base ${result.risk_score >= 70 ? "text-red-400" : result.risk_score >= 40 ? "text-amber-400" : "text-green-400"}`}>
                      {result.risk_score}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        result.risk_score >= 70 ? "bg-gradient-to-r from-red-600 to-red-400"
                        : result.risk_score >= 40 ? "bg-gradient-to-r from-amber-600 to-amber-400"
                        : "bg-gradient-to-r from-green-600 to-green-400"
                      }`}
                      style={{ width: `${result.risk_score}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-700 mt-1">
                    <span>Safe</span><span>Suspicious</span><span>Phishing</span>
                  </div>
                </div>

                {/* Threats list */}
                {result.threats.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Threats Found ({result.threats.length})</p>
                    <div className="space-y-2">
                      {result.threats.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 bg-red-950/20 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-300 text-xs">{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suspicious URLs */}
                {result.suspicious_urls.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Suspicious URLs</p>
                    {result.suspicious_urls.map((u, i) => (
                      <div key={i} className="bg-red-950/30 border border-red-900/40 rounded-lg p-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <LinkIcon className="w-3 h-3 text-red-400 flex-shrink-0" />
                          <span className="text-red-300 text-xs truncate">{u.url.slice(0, 40)}...</span>
                        </div>
                        <p className="text-red-500/80 text-xs mt-0.5 pl-4">↳ {u.reason}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Keywords */}
                {result.suspicious_keywords.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">Flagged Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.suspicious_keywords.slice(0, 10).map((kw) => (
                        <span key={kw} className="bg-red-900/40 text-red-300 text-xs px-2 py-0.5 rounded-full border border-red-800/50">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendation box */}
                <div className={`rounded-xl p-3 text-xs ${
                  result.verdict === "phishing" ? "bg-red-950/50 border border-red-800/40 text-red-200"
                  : result.verdict === "suspicious" ? "bg-amber-950/50 border border-amber-800/40 text-amber-200"
                  : "bg-green-950/50 border border-green-800/40 text-green-200"
                }`}>
                  <p className="font-semibold mb-1">Recommendation</p>
                  <p className="leading-relaxed">{result.recommendation}</p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                    <p className="text-white font-bold text-sm">{result.url_count}</p>
                    <p className="text-gray-500 text-xs">URLs</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                    <p className="text-white font-bold text-sm">{result.suspicious_keywords.length}</p>
                    <p className="text-gray-500 text-xs">Keywords</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-2 text-center">
                    <p className={`font-bold text-sm capitalize ${result.severity === "high" ? "text-red-400" : result.severity === "medium" ? "text-amber-400" : "text-green-400"}`}>
                      {result.severity}
                    </p>
                    <p className="text-gray-500 text-xs">Severity</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}