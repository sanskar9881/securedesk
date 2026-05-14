import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import { Database, Loader2, RefreshCw, Copy, CheckCircle } from "lucide-react";

interface FP { _id:string; filename:string; owner_name:string; hash:string; file_size:number; risk_level:string; action_taken:string; created_at:string; last_accessed:string; reasons:string[]; actions_log:{action:string;by:string;at:string}[]; }

const riskCls = (r:string) => r==="HIGH"?"bg-red-900/40 text-red-400 border border-red-800/40":r==="MEDIUM"?"bg-amber-900/40 text-amber-400 border border-amber-800/40":"bg-green-900/40 text-green-400 border border-green-800/40";
const actCls  = (a:string) => a==="BLOCK"?"bg-red-900/40 text-red-400":a==="WARN"?"bg-amber-900/40 text-amber-400":"bg-green-900/40 text-green-400";

export default function FileFingerprintPage() {
  const [files, setFiles]     = useState<FP[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExp]    = useState<string|null>(null);
  const [copied, setCopied]   = useState<string|null>(null);

  const load = () => { setLoading(true); api.get("/dlp/files/logs?limit=100").then(({data})=>setFiles(data)).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(()=>{ load(); },[]);

  const copy = (hash:string) => { navigator.clipboard.writeText(hash); setCopied(hash); setTimeout(()=>setCopied(null),2000); };

  return (
    <div className="flex">
      <Navbar/>
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <div className="mb-8"><h1 className="text-2xl font-bold text-white">File Fingerprints</h1><p className="text-gray-500 text-sm mt-1">SHA-256 fingerprints of every scanned file</p></div>
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-indigo-950/40 border border-indigo-800/30 rounded-xl px-4 py-2 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400"/>
            <span className="text-indigo-300 text-sm font-medium">{files.length} files fingerprinted</span>
          </div>
          <button onClick={load} className="ml-auto flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-xl text-xs transition">
            <RefreshCw className="w-3.5 h-3.5"/> Refresh
          </button>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin"/></div>
          ) : files.length===0 ? (
            <div className="flex flex-col items-center py-16 text-gray-600"><Database className="w-10 h-10 mb-3"/><p className="text-sm">No fingerprints yet — scan a file to start</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wider">
                  {["File","Owner","SHA-256","Size","Risk","Decision","Created"].map(h=><th key={h} className="text-left px-5 py-3 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {files.map(f=>(
                    <>
                      <tr key={f._id} onClick={()=>setExp(expanded===f._id?null:f._id)} className="border-b border-gray-800/50 hover:bg-gray-800/20 cursor-pointer">
                        <td className="px-5 py-3 text-gray-200 max-w-[160px] truncate font-medium">{f.filename}</td>
                        <td className="px-5 py-3 text-gray-400">{f.owner_name}</td>
                        <td className="px-5 py-3">
                          <button onClick={e=>{e.stopPropagation();copy(f.hash);}} className="flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-indigo-400 transition">
                            {copied===f.hash?<><CheckCircle className="w-3 h-3 text-green-400"/><span className="text-green-400">Copied!</span></>:<><Copy className="w-3 h-3"/>{f.hash.slice(0,14)}...</>}
                          </button>
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{(f.file_size/1024).toFixed(1)} KB</td>
                        <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskCls(f.risk_level)}`}>{f.risk_level}</span></td>
                        <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actCls(f.action_taken)}`}>{f.action_taken}</span></td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{new Date(f.created_at).toLocaleDateString()}</td>
                      </tr>
                      {expanded===f._id && (
                        <tr key={`${f._id}-exp`} className="bg-gray-800/20 border-b border-gray-800">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div><p className="text-gray-500 font-semibold mb-1">Risk Reasons</p>
                                {f.reasons?.length ? f.reasons.map((r,i)=><p key={i} className="text-gray-400">• {r}</p>) : <p className="text-gray-600">None</p>}</div>
                              <div><p className="text-gray-500 font-semibold mb-1">Action History</p>
                                {f.actions_log?.slice(-4).map((a,i)=><p key={i} className="text-gray-400">• {a.action} by {a.by} at {a.at?.slice(0,16)}</p>)}
                                <p className="text-gray-600 mt-1">Last accessed: {new Date(f.last_accessed).toLocaleString()}</p></div>
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
