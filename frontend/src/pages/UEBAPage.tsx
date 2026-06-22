import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import { Brain, AlertTriangle, Users, Activity, TrendingUp, Loader2, RefreshCw } from "lucide-react";

interface UEBAData {
  week_activities: number;
  open_anomaly_alerts: number;
  high_risk_users: { user: string; high_risk_actions: number }[];
}
interface Alert {
  _id: string; type: string; user_name: string; message: string;
  detail: string; severity: string; timestamp: string;
}

export default function UEBAPage() {
  const [ueba, setUeba]       = useState<UEBAData | null>(null);
  const [alerts, setAlerts]   = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [uebaRes, alertsRes] = await Promise.all([
        api.get("/dlp/ueba"),
        api.get("/dlp/alerts"),
      ]);
      setUeba(uebaRes.data);
      setAlerts(alertsRes.data.filter((a: Alert) => a.type === "UEBA_ANOMALY" || a.severity === "HIGH" || a.severity === "MEDIUM"));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await api.post(`/dlp/alerts/${id}/read`).catch(() => {});
    setAlerts(prev => prev.filter(a => a._id !== id));
  };

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-0 md:ml-64 flex-1 min-h-screen bg-gray-950 p-3 md:p-8 transition-all duration-300">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Behavior Analytics (UEBA)</h1>
            <p className="text-gray-500 text-sm mt-1">User and Entity Behavior Analytics — detect anomalies before damage happens</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm transition">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin" /></div>
        ) : (
          <div className="space-y-6 max-w-5xl">

            {/* Info banner */}
            <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-2xl p-5 flex items-start gap-4">
              <Brain className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium text-sm">What is UEBA?</p>
                <p className="text-gray-400 text-sm mt-1">
                  UEBA learns what is <em>normal</em> for each employee — typical hours, file volume, actions.
                  When someone deviates (downloads 200 files at midnight, shares data externally),
                  the system flags it automatically. Varonis charges ₹50 lakh/year for this. You have it built in.
                </p>
              </div>
            </div>

            {/* Stats */}
            {ueba && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <p className="text-gray-500 text-xs">This Week's Events</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{ueba.week_activities}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <p className="text-gray-500 text-xs">Open Anomaly Alerts</p>
                  </div>
                  <p className="text-3xl font-bold text-amber-400">{ueba.open_anomaly_alerts}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-red-400" />
                    <p className="text-gray-500 text-xs">High Risk Users (7d)</p>
                  </div>
                  <p className="text-3xl font-bold text-red-400">{ueba.high_risk_users?.length || 0}</p>
                </div>
              </div>
            )}

            {/* High risk users */}
            {ueba && ueba.high_risk_users && ueba.high_risk_users.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-red-400" /> High Activity Users This Week
                </h3>
                <div className="space-y-3">
                  {ueba.high_risk_users.map((u, i) => (
                    <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-800 last:border-0">
                      <div className="w-9 h-9 bg-red-900/40 border border-red-800/40 rounded-xl flex items-center justify-center text-red-400 font-bold text-sm flex-shrink-0">
                        {u.user?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{u.user}</p>
                        <p className="text-gray-500 text-xs">{u.high_risk_actions} high-risk actions this week</p>
                      </div>
                      <div className="h-2 w-32 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, u.high_risk_actions * 20)}%` }} />
                      </div>
                      <span className="text-red-400 text-sm font-bold">{u.high_risk_actions}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Anomaly alerts */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Anomaly Alerts
                {alerts.length > 0 && (
                  <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length}</span>
                )}
              </h3>
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-gray-600">
                  <Brain className="w-10 h-10 mb-3" />
                  <p className="text-sm">No anomalies detected — all behavior looks normal</p>
                  <p className="text-xs mt-1">UEBA is actively monitoring all user activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map(alert => (
                    <div key={alert._id}
                      className={`flex items-start gap-4 p-4 rounded-xl border ${alert.severity === "HIGH" ? "bg-red-950/20 border-red-800/40" : "bg-amber-950/20 border-amber-800/40"}`}>
                      <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${alert.severity === "HIGH" ? "text-red-400" : "text-amber-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{alert.user_name}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{alert.detail}</p>
                        <p className="text-gray-600 text-xs mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                      </div>
                      <button onClick={() => markRead(alert._id)}
                        className="text-xs text-gray-600 hover:text-white transition flex-shrink-0 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg">
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* How it works */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">How Anomaly Detection Works</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["🌙 After-Hours Detection", "Flags activity outside 7am–9pm — common sign of insider threats or compromised accounts"],
                  ["📊 Volume Anomaly", "Alerts when an employee performs 30+ actions in one hour or 50+ in a day vs their baseline"],
                  ["🔴 High-Risk File Access", "Immediately flags when a user uploads or accesses a HIGH-risk file"],
                  ["📈 Behavioral Baseline", "Learns each employee's normal patterns over 30 days then compares daily"],
                ].map(([title, desc]) => (
                  <div key={title as string} className="bg-gray-800/50 rounded-xl p-4">
                    <p className="text-white text-sm font-medium mb-1">{title}</p>
                    <p className="text-gray-500 text-xs">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
