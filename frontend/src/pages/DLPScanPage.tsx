import { useState, useRef } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Upload, Shield, ShieldAlert, ShieldCheck, ShieldX, FileText, AlertTriangle, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Result {
  risk_level: "LOW"|"MEDIUM"|"HIGH";
  recommended_action: "ALLOW"|"WARN"|"BLOCK";
  reasons: string[];
  regex_findings: Record<string, number|string[]>;
  llm_analysis: { sensitivity_reason?: string; confidence?: string };
  file_hash?: string; filename?: string; is_duplicate?: boolean;
}

const RC = {
  HIGH:   { color:"text-red-400",   bg:"bg-red-950/30 border-red-800/50",   icon:<ShieldX className="w-6 h-6 text-red-400"/>,   bar:"bg-red-500" },
  MEDIUM: { color:"text-amber-400", bg:"bg-amber-950/30 border-amber-800/50",icon:<ShieldAlert className="w-6 h-6 text-amber-400"/>,bar:"bg-amber-500"},
  LOW:    { color:"text-green-400", bg:"bg-green-950/30 border-green-800/50",icon:<ShieldCheck className="w-6 h-6 text-green-400"/>,bar:"bg-green-500"},
};
const AC = {
  BLOCK: { color:"text-red-400",   bg:"bg-red-900/40 border border-red-700",   label:"🚫 BLOCKED" },
  WARN:  { color:"text-amber-400", bg:"bg-amber-900/40 border border-amber-700",label:"⚠️ WARNING" },
  ALLOW: { color:"text-green-400", bg:"bg-green-900/40 border border-green-700",label:"✅ ALLOWED" },
};

export default function DLPScanPage() {
  const [mode, setMode]       = useState<"file"|"text">("file");
  const [file, setFile]       = useState<File|null>(null);
  const [text, setText]       = useState("");
  const [fname, setFname]     = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<Result|null>(null);
  const fileRef               = useRef<HTMLInputElement>(null);

  const scanFile = async () => {
    if (!file) return toast.error("Select a file");
    setLoading(true); setResult(null);
    const form = new FormData();
    form.append("file", file); form.append("use_llm", "true");
    try {
      const { data } = await api.post("/dlp/analyze-upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(data);
      if (data.recommended_action === "BLOCK") toast.error("🚫 File BLOCKED — high risk!");
      else if (data.recommended_action === "WARN") toast("⚠️ Review before sharing", { icon: "⚠️" });
      else toast.success("✅ File is safe");
    } catch { toast.error("Scan failed"); } finally { setLoading(false); }
  };

  const scanText = async () => {
    if (!text.trim()) return toast.error("Paste some text");
    setLoading(true); setResult(null);
    try {
      const { data } = await api.post("/dlp/analyze-file", { text, filename: fname || "pasted.txt", use_llm: true });
      setResult(data);
      if (data.recommended_action === "BLOCK") toast.error("🚫 Content BLOCKED!");
      else if (data.recommended_action === "WARN") toast("⚠️ Content flagged", { icon: "⚠️" });
      else toast.success("✅ Content is safe");
    } catch { toast.error("Scan failed"); } finally { setLoading(false); }
  };

  const rc = result ? RC[result.risk_level] : null;
  const ac = result ? AC[result.recommended_action] : null;
  const pct = result ? (result.risk_level === "HIGH" ? 90 : result.risk_level === "MEDIUM" ? 55 : 15) : 0;

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-0 lg:ml-64 flex-1 min-h-screen bg-gray-950 p-3 md:p-8 transition-all duration-300">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">DLP Scanner</h1>
          <p className="text-gray-500 text-sm mt-1">Scan files or text for sensitive data before sharing</p>
        </div>
        <div className="max-w-5xl grid grid-cols-2 gap-6">
          {/* Input */}
          <div className="space-y-4">
            <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
              {(["file","text"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode===m?"bg-indigo-600 text-white":"text-gray-400 hover:text-white"}`}>
                  {m === "file" ? "📁 Upload File" : "📝 Paste Text"}
                </button>
              ))}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
              {mode === "file" ? (
                <>
                  <input type="file" ref={fileRef} onChange={e => setFile(e.target.files?.[0]||null)} className="hidden"/>
                  {file ? (
                    <div className="flex items-center gap-3 bg-gray-800 border border-indigo-600/30 rounded-xl px-4 py-3">
                      <FileText className="w-5 h-5 text-indigo-400 flex-shrink-0"/>
                      <div className="flex-1 min-w-0"><p className="text-white text-sm font-medium truncate">{file.name}</p>
                        <p className="text-gray-500 text-xs">{(file.size/1024).toFixed(1)} KB</p></div>
                      <button onClick={() => setFile(null)}><XCircle className="w-4 h-4 text-gray-500 hover:text-red-400"/></button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full flex flex-col items-center gap-3 bg-gray-800/50 border-2 border-dashed border-gray-700 hover:border-indigo-500/60 rounded-xl py-10 text-gray-400 hover:text-indigo-400 transition">
                      <Upload className="w-8 h-8"/><div className="text-center">
                        <p className="text-sm font-medium">Click to upload</p>
                        <p className="text-xs text-gray-600 mt-1">PDF · DOCX · TXT · CSV</p></div>
                    </button>
                  )}
                  <button onClick={scanFile} disabled={loading||!file}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Shield className="w-4 h-4"/>}
                    {loading ? "Scanning..." : "Scan File"}
                  </button>
                </>
              ) : (
                <>
                  <input value={fname} onChange={e => setFname(e.target.value)} placeholder="Filename (optional)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"/>
                  <textarea value={text} onChange={e => setText(e.target.value)}
                    placeholder="Paste email, document content, or any text to scan..." rows={9}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"/>
                  <button onClick={scanText} disabled={loading||!text.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Shield className="w-4 h-4"/>}
                    {loading ? "Scanning..." : "Scan Text"}
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Result */}
          <div>
            {!result && !loading && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center h-full min-h-[420px] text-center">
                <Shield className="w-12 h-12 text-gray-700 mb-4"/>
                <p className="text-gray-500 text-sm">Scan Results will appear here</p>
              </div>
            )}
            {loading && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center h-full min-h-[420px]">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4"/>
                <p className="text-white text-sm font-medium">Analyzing content...</p>
                <p className="text-gray-500 text-xs mt-1">Running regex + AI classification</p>
              </div>
            )}
            {result && rc && ac && (
              <div className={`border rounded-2xl p-6 space-y-5 ${rc.bg}`}>
                <div className="flex items-center gap-4 pb-4 border-b border-gray-800/50">
                  {rc.icon}
                  <div className="flex-1">
                    <p className={`text-lg font-bold ${rc.color}`}>{result.risk_level} RISK</p>
                    <p className="text-gray-500 text-xs">{result.filename}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${ac.bg} ${ac.color}`}>{ac.label}</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-400">Risk Score</span>
                    <span className={`font-bold ${rc.color}`}>{pct}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${rc.bar}`} style={{ width: `${pct}%` }}/>
                  </div>
                </div>
                {result.reasons.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Why Flagged</p>
                    {result.reasons.map((r,i) => (
                      <div key={i} className="flex items-start gap-2 text-xs mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5"/>
                        <span className="text-gray-300">{r}</span>
                      </div>
                    ))}
                  </div>
                )}
                {Object.keys(result.regex_findings).length > 0 && (
                  <div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Data Types Detected</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(result.regex_findings).map(([k,v]) => (
                        <span key={k} className="bg-red-900/40 text-red-300 text-xs px-2.5 py-1 rounded-full border border-red-800/50">
                          {k.replace(/_/g," ")} ({Array.isArray(v)?v.length:v})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.llm_analysis?.sensitivity_reason && (
                  <div className="bg-gray-900/60 rounded-xl p-3">
                    <p className="text-gray-400 text-xs font-semibold mb-1">AI Assessment</p>
                    <p className="text-gray-300 text-xs">{result.llm_analysis.sensitivity_reason}</p>
                  </div>
                )}
                {result.file_hash && (
                  <div className="flex items-center gap-2 text-xs">
                    {result.is_duplicate
                      ? <><AlertTriangle className="w-3.5 h-3.5 text-amber-400"/><span className="text-amber-400">Duplicate file detected</span></>
                      : <><CheckCircle className="w-3.5 h-3.5 text-green-400"/><span className="text-green-400">File fingerprinted</span></>}
                    <span className="text-gray-700 font-mono ml-auto">{result.file_hash.slice(0,14)}...</span>
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
