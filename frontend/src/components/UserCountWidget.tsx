import { useEffect, useState } from "react";
import api from "../api/axios";
import { Users, Shield, Activity, TrendingUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function UserCountWidget() {
  const { t } = useAuth();
  const [stats, setStats] = useState<{
    total_users: number; admin_count: number; user_count: number; total_transactions: number;
  } | null>(null);

  useEffect(() => {
    api.get("/profile/stats/public").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  if (!stats) return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-12" />)}
      </div>
    </div>
  );

  const items = [
    { label: t("total_users"), value: stats.total_users, icon: <Users className="w-4 h-4" />, color: "indigo" },
    { label: t("admins"), value: stats.admin_count, icon: <Shield className="w-4 h-4" />, color: "amber" },
    { label: "Regular Users", value: stats.user_count, icon: <Users className="w-4 h-4" />, color: "teal" },
    { label: t("transactions"), value: stats.total_transactions, icon: <Activity className="w-4 h-4" />, color: "green" },
  ];

  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-900/40 text-indigo-400",
    amber: "bg-amber-900/40 text-amber-400",
    teal: "bg-teal-900/40 text-teal-400",
    green: "bg-green-900/40 text-green-400",
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6 animate-fadeInUp">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-gray-500" />
        <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold">{t("platform_overview")}</p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 group">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${colorMap[item.color]}`}>
              {item.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-white">{item.value}</p>
              <p className="text-gray-500 text-xs">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}