import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import { Activity, Upload, Share2, Download, Shield, Loader2, RefreshCw } from "lucide-react";

interface Log { _id:string; user_name:string; action:string; filename:string; risk_level:string; action_taken:string; timestamp:string; }

const riskCls = (r:string) => r==="HIGH"?"bg-red-900/40 text-red-400 border border-red-800/40":r==="MEDIUM"?"bg-amber-900/40 text-amber-400 border border-amber-800/40":"bg-green-900/40 text-green-400 border border-green-800/40";
const actCls  = (a:string) => a==="BLOCK"?"bg-red-900/40 text-red-400":a==="WARN"?"bg-amber-900/40 text-amber-400":"bg-green-900/40 text-green-400";
const icons: Record<string,React.ReactNode> = { upload:<Upload className="w-3.5 h-3.5"/>, share:<Share2 className="w-3.5 h-3.5"/>, download:<Download className="w-3.5 h-3.5"/>, analyze:<Shield className="w-3.5 h-3.5"/> };

export default function ActivityLogsPage() {
  const [logs, setLogs]       = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("all");

  const load = () => { setLoading(true); api.get("/dlp/activity?limit=100").then(({data})=>setLogs(data)).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(()=>{ load(); },[]);

  const filtered = filter==="all" ? logs : logs.filter(l=>l.risk_level===filter.toUpperCase()||l.action===filter);

  return (
    <div className="flex">
      <Navbar/>
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <div className="mb-8"><h1 className="text-2xl font-bold text-white">Activity Logs</h1><p className="text-gray-500 text-sm mt-1">Real-time audit trail of all file operations</p></div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[{l:"Total Events",v:logs.length,c:"text-white"},{l:"High Risk",v:logs.filter(l=>l.risk_level==="HIGH").length,c:"text-red-400"},
            {l:"Blocked",v:logs.filter(l=>l.action_taken==="BLOCK").length,c:"text-red-400"},{l:"Safe",v:logs.filter(l=>l.action_taken==="ALLOW").length,c:"text-green-400"}]
            .map(s=>(
            <div key={s.l} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-gray-500 text-xs">{s.l}</p><p className={`text-2xl font-bold mt-1 ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mb-4">
          {["all","HIGH","MEDIUM","LOW","upload","analyze"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter===f?"bg-indigo-600 text-white":"bg-gray-800 text-gray-400 hover:text-white"}`}>
              {f.toUpperCase()}
            </button>
          ))}
          <button onClick={load} className="ml-auto flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg text-xs transition">
            <RefreshCw className="w-3.5 h-3.5"/> Refresh
          </button>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin"/></div>
          ) : filtered.length===0 ? (
            <div className="flex flex-col items-center py-16 text-gray-600"><Activity className="w-10 h-10 mb-3"/><p className="text-sm">No logs yet</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-500 border-b border-gray-800 text-xs uppercase tracking-wider">
                  {["Action","User","File","Risk","Decision","Time"].map(h=><th key={h} className="text-left px-5 py-3 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {filtered.map(log=>(
                    <tr key={log._id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="px-5 py-3"><span className="flex items-center gap-1.5 text-gray-300 capitalize"><span className="text-gray-500">{icons[log.action]||<Activity className="w-3.5 h-3.5"/>}</span>{log.action}</span></td>
                      <td className="px-5 py-3 text-gray-300">{log.user_name}</td>
                      <td className="px-5 py-3 text-gray-400 max-w-[180px] truncate">{log.filename||"—"}</td>
                      <td className="px-5 py-3">{log.risk_level?<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskCls(log.risk_level)}`}>{log.risk_level}</span>:<span className="text-gray-700">—</span>}</td>
                      <td className="px-5 py-3">{log.action_taken?<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actCls(log.action_taken)}`}>{log.action_taken}</span>:<span className="text-gray-700">—</span>}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{new Date(log.timestamp).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
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
