import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import {
  Shield, LayoutDashboard, Send, LogOut, Users, History,
  ShieldAlert, MessageSquare, Moon, Sun, ScanLine, Brain,
  Activity, Database, FileCheck, TrendingUp, Building2,
  MessageCircle, CreditCard, Bell,
} from "lucide-react";

export default function Navbar() {
  const { user, logout, darkMode, toggleDarkMode, t } = useAuth();
  const navigate  = useNavigate();
  const loc       = useLocation();
  const active    = (p: string) => loc.pathname === p;
  const [notifCount, setNotifCount] = useState(0);

  // Poll notifications every 30 seconds
  useEffect(() => {
    const fetchCount = () => {
      api.get("/notifications/count")
        .then(({ data }) => setNotifCount(data.count || 0))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const L = ({ to, icon, label, badge }: { to:string; icon:React.ReactNode; label:string; badge?:string }) => (
    <Link to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative
      ${active(to)
        ? darkMode ? "bg-indigo-600/20 text-indigo-300 border border-indigo-600/30" : "bg-indigo-50 text-indigo-700 border border-indigo-200"
        : darkMode ? "text-gray-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
      {active(to) && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-r-full"/>}
      <span className={`transition-transform group-hover:scale-110 ${active(to) ? (darkMode?"text-indigo-400":"text-indigo-600") : ""}`}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
    </Link>
  );

  const S = ({ title }: { title: string }) => (
    <p className={`text-xs uppercase tracking-wider font-semibold px-3 mt-4 mb-1 ${darkMode?"text-gray-600":"text-slate-400"}`}>{title}</p>
  );

  const isAdmin   = user?.role === "admin";
  const isManager = user?.role === "manager";

  return (
    <div className={`fixed left-0 top-0 h-screen w-64 flex flex-col z-50 shadow-xl transition-colors duration-300
      ${darkMode ? "bg-gray-950 border-r border-gray-800/60" : "bg-white border-r border-slate-200"}`}>

      {/* Brand */}
      <div className={`p-5 border-b ${darkMode?"border-gray-800/60":"border-slate-200"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Shield className="w-5 h-5 text-white"/>
            </div>
            <div>
              <h1 className={`font-bold text-base tracking-tight ${darkMode?"text-white":"text-slate-900"}`}>SecureDesk</h1>
              <p className={`text-xs ${darkMode?"text-gray-500":"text-slate-400"}`}>DLP v4.0</p>
            </div>
          </div>
          {/* Notification bell */}
          <div className="relative">
            <Bell className={`w-5 h-5 cursor-pointer ${darkMode?"text-gray-500 hover:text-white":"text-slate-400 hover:text-slate-700"} transition`}
              onClick={() => navigate("/activity")}/>
            {notifCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* User card */}
      <Link to="/profile" className={`p-4 border-b transition-colors group ${darkMode?"border-gray-800/60 hover:bg-white/[0.02]":"border-slate-200 hover:bg-slate-50"}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md"
            style={{background:`linear-gradient(135deg,${user?.avatar_color||"#6366f1"},${user?.avatar_color||"#6366f1"}cc)`}}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${darkMode?"text-white":"text-slate-800"}`}>{user?.name}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              user?.role==="admin"   ? (darkMode?"bg-amber-500/15 text-amber-400 border border-amber-500/20":"bg-amber-100 text-amber-700") :
              user?.role==="manager" ? (darkMode?"bg-purple-500/15 text-purple-400 border border-purple-500/20":"bg-purple-100 text-purple-700") :
                                       (darkMode?"bg-teal-500/15 text-teal-400 border border-teal-500/20":"bg-teal-100 text-teal-700")}`}>
              {user?.role}
            </span>
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">

        {/* ADMIN */}
        {isAdmin && (<>
          <S title="Overview"/>
          <L to="/admin"         icon={<LayoutDashboard className="w-4 h-4"/>} label={t("dashboard")}/>
          <L to="/admin/users"   icon={<Users className="w-4 h-4"/>}           label={t("users")}/>
          <L to="/organization"  icon={<Building2 className="w-4 h-4"/>}       label="Organization"/>
          <S title="DLP Engine"/>
          <L to="/dlp"           icon={<ScanLine className="w-4 h-4"/>}        label="DLP Scanner"   badge="AI"/>
          <L to="/activity"      icon={<Activity className="w-4 h-4"/>}        label="Activity Logs"/>
          <L to="/fingerprints"  icon={<Database className="w-4 h-4"/>}        label="Fingerprints"/>
          <L to="/whatsapp-logs" icon={<MessageCircle className="w-4 h-4"/>}   label="WhatsApp DLP"  badge="NEW"/>
          <L to="/ueba"          icon={<TrendingUp className="w-4 h-4"/>}      label="Behavior UEBA" badge="AI"/>
          <S title="Intelligence"/>
          <L to="/ai-copilot"    icon={<Brain className="w-4 h-4"/>}           label="AI Copilot"/>
          <L to="/compliance"    icon={<FileCheck className="w-4 h-4"/>}       label="Compliance"    badge="DPDP"/>
          <S title="Security"/>
          <L to="/phishing"      icon={<ShieldAlert className="w-4 h-4"/>}     label={t("phishing")}/>
          <L to="/chat"          icon={<MessageSquare className="w-4 h-4"/>}   label="AI Chat"/>
          <S title="Account"/>
          <L to="/pricing"       icon={<CreditCard className="w-4 h-4"/>}      label="Billing & Plans"/>
        </>)}

        {/* MANAGER */}
        {isManager && (<>
          <S title="Overview"/>
          <L to="/admin"         icon={<LayoutDashboard className="w-4 h-4"/>} label="Dashboard"/>
          <L to="/organization"  icon={<Building2 className="w-4 h-4"/>}       label="Organization"/>
          <S title="DLP Engine"/>
          <L to="/dlp"           icon={<ScanLine className="w-4 h-4"/>}        label="DLP Scanner"   badge="AI"/>
          <L to="/activity"      icon={<Activity className="w-4 h-4"/>}        label="Activity Logs"/>
          <L to="/whatsapp-logs" icon={<MessageCircle className="w-4 h-4"/>}   label="WhatsApp DLP"  badge="NEW"/>
          <L to="/ueba"          icon={<TrendingUp className="w-4 h-4"/>}      label="Behavior UEBA"/>
          <S title="Intelligence"/>
          <L to="/ai-copilot"    icon={<Brain className="w-4 h-4"/>}           label="AI Copilot"/>
          <L to="/compliance"    icon={<FileCheck className="w-4 h-4"/>}       label="Compliance"/>
          <S title="Security"/>
          <L to="/phishing"      icon={<ShieldAlert className="w-4 h-4"/>}     label={t("phishing")}/>
          <L to="/chat"          icon={<MessageSquare className="w-4 h-4"/>}   label="AI Chat"/>
          <L to="/pricing"       icon={<CreditCard className="w-4 h-4"/>}      label="Billing & Plans"/>
        </>)}

        {/* EMPLOYEE */}
        {!isAdmin && !isManager && (<>
          <S title="Overview"/>
          <L to="/dashboard"    icon={<LayoutDashboard className="w-4 h-4"/>} label={t("dashboard")}/>
          <L to="/share"        icon={<Send className="w-4 h-4"/>}             label={t("send_file")}/>
          <L to="/history"      icon={<History className="w-4 h-4"/>}          label={t("history")}/>
          <S title="DLP Tools"/>
          <L to="/dlp"          icon={<ScanLine className="w-4 h-4"/>}         label="DLP Scanner"  badge="AI"/>
          <L to="/activity"     icon={<Activity className="w-4 h-4"/>}         label="My Activity"/>
          <L to="/ai-copilot"   icon={<Brain className="w-4 h-4"/>}            label="AI Copilot"/>
          <S title="Security"/>
          <L to="/phishing"     icon={<ShieldAlert className="w-4 h-4"/>}      label={t("phishing")}/>
          <L to="/chat"         icon={<MessageSquare className="w-4 h-4"/>}    label={t("ai_assistant")}/>
          <L to="/pricing"      icon={<CreditCard className="w-4 h-4"/>}       label="Upgrade Plan"/>
        </>)}
      </nav>

      {/* Bottom */}
      <div className={`p-3 border-t space-y-0.5 ${darkMode?"border-gray-800/60":"border-slate-200"}`}>
        <button onClick={toggleDarkMode}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition group ${darkMode?"text-gray-400 hover:bg-white/5 hover:text-white":"text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
          <span className="transition-transform group-hover:rotate-12">{darkMode?<Sun className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}</span>
          <span className="flex-1 text-left">{darkMode?"Light Mode":"Dark Mode"}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${darkMode?"bg-gray-800 text-gray-500":"bg-indigo-100 text-indigo-600"}`}>{darkMode?"OFF":"ON"}</span>
        </button>
        <button onClick={()=>{logout();navigate("/login");}}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition group ${darkMode?"text-gray-400 hover:bg-red-500/10 hover:text-red-400":"text-slate-500 hover:bg-red-50 hover:text-red-600"}`}>
          <LogOut className="w-4 h-4"/>
          {t("sign_out")}
        </button>
      </div>
    </div>
  );
}
