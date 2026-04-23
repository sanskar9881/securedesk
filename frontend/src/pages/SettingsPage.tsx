import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { User, Globe, ShieldCheck, Moon, Sun, ChevronRight, Bell, Lock, Monitor } from "lucide-react";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, language, t } = useAuth();

  const currentLangName: Record<string, string> = {
    en: "English 🇺🇸", hi: "हिन्दी 🇮🇳", mr: "मराठी 🇮🇳",
    gu: "ગુજરાતી 🇮🇳", ta: "தமிழ் 🇮🇳", te: "తెలుగు 🇮🇳",
  };

  const sections = [
    {
      title: "Account",
      items: [
        { icon: <User className="w-4 h-4" />, label: t("profile"), sub: "Name, DOB, avatar color", action: () => navigate("/profile"), color: "indigo" },
        { icon: <Lock className="w-4 h-4" />, label: "Change Password", sub: "Update your login credentials", action: () => navigate("/forgot-password"), color: "purple" },
        { icon: <Bell className="w-4 h-4" />, label: "Notifications", sub: "Alert preferences (coming soon)", action: () => toast("Coming in v3.0!"), color: "amber", disabled: true },
      ]
    },
    {
      title: "Appearance",
      items: [
        {
          icon: darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />,
          label: t("dark_mode"),
          sub: darkMode ? "Currently in dark mode" : "Currently in light mode",
          action: toggleDarkMode,
          color: "blue",
          badge: darkMode ? "ON" : "OFF",
          badgeColor: darkMode ? "bg-indigo-600/20 text-indigo-400" : "bg-amber-600/20 text-amber-400",
        },
        {
          icon: <Monitor className="w-4 h-4" />,
          label: "Display Density",
          sub: "Compact / Comfortable (coming soon)",
          action: () => toast("Coming in v3.0!"),
          color: "teal",
          disabled: true,
        },
      ]
    },
    {
      title: "Preferences",
      items: [
        {
          icon: <Globe className="w-4 h-4" />,
          label: t("language"),
          sub: currentLangName[language] || "English 🇺🇸",
          action: () => navigate("/settings/language"),
          color: "teal",
          hasArrow: true,
        },
      ]
    },
    {
      title: "Privacy & Legal",
      items: [
        { icon: <ShieldCheck className="w-4 h-4" />, label: t("privacy_center"), sub: "Data privacy & FAQ", action: () => navigate("/settings/privacy"), color: "green", hasArrow: true },
      ]
    }
  ];

  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-900/40 text-indigo-400",
    purple: "bg-purple-900/40 text-purple-400",
    amber: "bg-amber-900/40 text-amber-400",
    blue: "bg-blue-900/40 text-blue-400",
    teal: "bg-teal-900/40 text-teal-400",
    green: "bg-green-900/40 text-green-400",
  };

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <Header title={t("settings")} subtitle="Configure your SecureDesk experience" />

        <div className="max-w-lg space-y-5 animate-fadeInUp">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2 px-1">{section.title}</p>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {section.items.map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    disabled={"disabled" in item && item.disabled === true}
                    className={`w-full flex items-center gap-4 px-5 py-4 transition-all text-left group
                      ${"disabled" in item && item.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/[0.03] cursor-pointer"}
                      ${i < section.items.length - 1 ? "border-b border-gray-800" : ""}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${colorMap[item.color]}`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{item.label}</p>
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{item.sub}</p>
                    </div>
                    {"badge" in item && item.badge && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${"badgeColor" in item ? item.badgeColor : "bg-gray-700 text-gray-400"}`}>
                        {item.badge}
                      </span>
                    )}
                    {"hasArrow" in item && item.hasArrow && (
                      <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800/50 rounded-2xl p-5 text-center">
            <div className="w-8 h-8 bg-indigo-600/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-gray-400 text-sm font-medium">SecureDesk v2.0</p>
            <p className="text-gray-600 text-xs mt-1">Built with love from Sanskar Hadole ❤️</p>
          </div>
        </div>
      </main>
    </div>
  );
}