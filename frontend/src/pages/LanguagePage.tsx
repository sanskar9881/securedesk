import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { Check, Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", name: "English", native: "English", flag: "🇺🇸", region: "International" },
  { code: "hi", name: "Hindi", native: "हिन्दी", flag: "🇮🇳", region: "India" },
  { code: "mr", name: "Marathi", native: "मराठी", flag: "🇮🇳", region: "India" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳", region: "India" },
  { code: "ta", name: "Tamil", native: "தமிழ்", flag: "🇮🇳", region: "India" },
  { code: "te", name: "Telugu", native: "తెలుగు", flag: "🇮🇳", region: "India" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", flag: "🇮🇳", region: "India" },
  { code: "bn", name: "Bengali", native: "বাংলা", flag: "🇮🇳", region: "India" },
];

export default function LanguagePage() {
  const { language: currentLang, setLanguage, t } = useAuth();
  const [selected, setSelected] = useState(currentLang);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleSelect = async (code: string) => {
    setSelected(code);
    setSaving(true);
    try {
      // Save to backend profile
      await api.put("/profile/me", { language: code });
      // Apply language immediately via context
      setLanguage(code);
      const lang = LANGUAGES.find(l => l.code === code);
      toast.success(`Language changed to ${lang?.name} ${lang?.flag}`);
      // Navigate back to settings after short delay
      setTimeout(() => navigate("/settings"), 800);
    } catch {
      // Still apply locally even if backend save fails
      setLanguage(code);
      const lang = LANGUAGES.find(l => l.code === code);
      toast.success(`Language changed to ${lang?.name} ${lang?.flag}`);
      setTimeout(() => navigate("/settings"), 800);
    } finally {
      setSaving(false);
    }
  };

  const grouped = LANGUAGES.reduce((acc, lang) => {
    if (!acc[lang.region]) acc[lang.region] = [];
    acc[lang.region].push(lang);
    return acc;
  }, {} as Record<string, typeof LANGUAGES>);

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8">
        <Header title={t("language")} subtitle="Choose your preferred language — changes apply immediately" />

        <div className="max-w-md">
          {saving && (
            <div className="mb-4 bg-indigo-900/30 border border-indigo-700/40 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-indigo-400" />
              <p className="text-indigo-300 text-sm">Applying language...</p>
            </div>
          )}

          {Object.entries(grouped).map(([region, langs]) => (
            <div key={region} className="mb-6">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Globe className="w-3.5 h-3.5 text-gray-600" />
                <p className="text-gray-500 text-xs uppercase tracking-wider font-medium">{region}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {langs.map((lang, i) => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelect(lang.code)}
                    disabled={saving}
                    className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-800/60 transition-all text-left group disabled:opacity-60
                      ${i < langs.length - 1 ? "border-b border-gray-800" : ""}
                      ${selected === lang.code ? "bg-indigo-950/30" : ""}`}
                  >
                    <span className="text-2xl transition-transform duration-200 group-hover:scale-110">{lang.flag}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-medium transition-colors ${selected === lang.code ? "text-indigo-300" : "text-white"}`}>
                        {lang.name}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">{lang.native}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                      selected === lang.code ? "bg-indigo-600 scale-100" : "border border-gray-700 scale-90 opacity-0 group-hover:opacity-50 group-hover:scale-95"
                    }`}>
                      {selected === lang.code && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-indigo-950/20 border border-indigo-800/30 rounded-xl p-4">
            <p className="text-indigo-400 text-xs font-medium mb-1">ℹ️ Translation Note</p>
            <p className="text-gray-400 text-xs">Navigation labels, buttons, and key UI elements are translated. Full content translation for all pages coming in v3.0.</p>
          </div>
        </div>
      </main>
    </div>
  );
}