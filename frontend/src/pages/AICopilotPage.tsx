import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import { Send, Bot, User, Sparkles, Clock, Loader2 } from "lucide-react";

interface Q { _id:string; question:string; answer:string; timestamp:string; }

const EXAMPLES = [
  "Show all high-risk files this week",
  "What files were uploaded today?",
  "List all blocked files",
  "Show suspicious activity logs",
  "What sensitive data was detected recently?",
  "Who uploaded the most files?",
];

export default function AICopilotPage() {
  const [q, setQ]             = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Q[]>([]);
  const [active, setActive]   = useState<Q|null>(null);
  const inputRef              = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.get("/ai/query/history").then(({data}) => setHistory(data)).catch(()=>{});
  }, []);

  const submit = async () => {
    const question = q.trim();
    if (!question || loading) return;
    setQ(""); setLoading(true);
    try {
      const { data } = await api.post("/ai/query", { question });
      const rec: Q = { _id: data.timestamp, question, answer: data.answer, timestamp: data.timestamp };
      setHistory(p => [rec, ...p]);
      setActive(rec);
    } catch { toast.error("Query failed"); setQ(question); }
    finally { setLoading(false); setTimeout(()=>inputRef.current?.focus(),50); }
  };

  return (
    <div className="flex">
      <Navbar/>
      <main className="ml-0 lg:ml-64 flex-1 min-h-screen bg-gray-950 p-3 md:p-8 transition-all duration-300">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">AI Copilot</h1>
          <p className="text-gray-500 text-sm mt-1">Ask anything about your security data in natural language</p>
        </div>
        <div className="max-w-5xl grid grid-cols-3 gap-6">
          <div className="col-span-1 space-y-3">
            <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Recent Queries</p>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {history.length === 0
                ? <p className="text-gray-600 text-xs text-center py-8 px-4">No queries yet</p>
                : history.slice(0,12).map(h => (
                  <button key={h._id} onClick={() => setActive(h)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-800 last:border-0 transition group
                      ${active?._id===h._id ? "bg-indigo-600/15 border-l-2 border-l-indigo-500" : "hover:bg-gray-800/40"}`}>
                    <p className={`text-xs font-medium truncate ${active?._id===h._id?"text-indigo-300":"text-gray-300"}`}>{h.question}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-gray-600"/>
                      <span className="text-gray-600 text-xs">{new Date(h.timestamp).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                    </div>
                  </button>
                ))}
            </div>
            <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mt-4">Try Asking</p>
            <div className="space-y-1.5">
              {EXAMPLES.map(e => (
                <button key={e} onClick={() => setQ(e)}
                  className="w-full text-left bg-gray-900/60 hover:bg-gray-800 border border-gray-800 hover:border-indigo-600/40 rounded-xl px-3 py-2 text-xs text-gray-400 hover:text-white transition">
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2 flex flex-col gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex-1 min-h-[420px] flex flex-col">
              {!active && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-14 h-14 bg-indigo-600/15 border border-indigo-600/20 rounded-2xl flex items-center justify-center mb-4">
                    <Sparkles className="w-7 h-7 text-indigo-400"/>
                  </div>
                  <h3 className="text-white font-semibold mb-1">Manager AI Copilot</h3>
                  <p className="text-gray-500 text-sm max-w-sm">Ask questions about files, risks, activity logs in natural language.</p>
                </div>
              )}
              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin"/>
                  <p className="text-gray-400 text-sm">Querying security data...</p>
                </div>
              )}
              {active && !loading && (
                <div className="flex-1 p-6 overflow-y-auto space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-white"/></div>
                    <div className="bg-indigo-600 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                      <p className="text-white text-sm">{active.question}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-700 flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-gray-300"/></div>
                    <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex-1">
                      <ReactMarkdown components={{
                        p: ({children}) => <p className="text-gray-200 text-sm mb-2 last:mb-0">{children}</p>,
                        strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
                        ul: ({children}) => <ul className="my-1 space-y-0.5">{children}</ul>,
                        li: ({children}) => <li className="flex items-start gap-1.5 text-sm text-gray-300"><span className="text-gray-600 mt-0.5">•</span><span>{children}</span></li>,
                        code: ({children}) => <code className="bg-gray-900 text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                      }}>{active.answer}</ReactMarkdown>
                      <p className="text-gray-700 text-xs mt-3">{new Date(active.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex items-end gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus-within:border-indigo-500/60 transition">
                <textarea ref={inputRef} value={q} onChange={e=>setQ(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit();}}}
                  placeholder="Ask about files, risks, users... (Enter to send)" rows={2} disabled={loading}
                  className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm resize-none focus:outline-none"/>
                <button onClick={submit} disabled={loading||!q.trim()}
                  className="w-9 h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl flex items-center justify-center flex-shrink-0 transition">
                  <Send className="w-4 h-4 text-white"/>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
