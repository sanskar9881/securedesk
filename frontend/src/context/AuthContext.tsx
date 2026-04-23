import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  name: string;
  role: string;
  token: string;
  avatar_color?: string;
  language?: string;
}

interface AuthCtx {
  user: User | null;
  login: (token: string, role: string, name: string) => void;
  logout: () => void;
  loading: boolean;
  updateUser: (fields: Partial<User>) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}

const AuthContext = createContext<AuthCtx | null>(null);

// ── Translation dictionary ─────────────────────────────────────
const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    dashboard: "Dashboard", send_file: "Send File", history: "My History",
    phishing: "Phishing Detector", ai_assistant: "AI Assistant", users: "Users",
    sign_out: "Sign out", welcome_back: "Welcome back", total_sent: "Total Sent",
    legitimate: "Legitimate", suspicious: "Suspicious", recent_transactions: "Recent Transactions",
    no_transactions: "No transactions yet", send_first: "Send your first file →",
    recipient: "Recipient", subject: "Subject", file: "File", status: "Status",
    risk: "Risk", date: "Date", settings: "Settings", profile: "Profile",
    language: "Language", privacy_center: "Privacy Center", dark_mode: "Dark Mode",
    save: "Save", cancel: "Cancel", edit_profile: "Edit Profile", loading: "Loading...",
    platform_overview: "Platform Overview", total_users: "Total Users",
    transactions: "Transactions", admins: "Admins",
  },
  hi: {
    dashboard: "डैशबोर्ड", send_file: "फ़ाइल भेजें", history: "मेरा इतिहास",
    phishing: "फ़िशिंग डिटेक्टर", ai_assistant: "AI सहायक", users: "उपयोगकर्ता",
    sign_out: "साइन आउट", welcome_back: "वापसी पर स्वागत है", total_sent: "कुल भेजा",
    legitimate: "वैध", suspicious: "संदिग्ध", recent_transactions: "हाल के लेनदेन",
    no_transactions: "अभी तक कोई लेनदेन नहीं", send_first: "पहली फ़ाइल भेजें →",
    recipient: "प्राप्तकर्ता", subject: "विषय", file: "फ़ाइल", status: "स्थिति",
    risk: "जोखिम", date: "तारीख", settings: "सेटिंग्स", profile: "प्रोफ़ाइल",
    language: "भाषा", privacy_center: "गोपनीयता केंद्र", dark_mode: "डार्क मोड",
    save: "सहेजें", cancel: "रद्द करें", edit_profile: "प्रोफ़ाइल संपादित करें", loading: "लोड हो रहा है...",
    platform_overview: "प्लेटफ़ॉर्म अवलोकन", total_users: "कुल उपयोगकर्ता",
    transactions: "लेनदेन", admins: "व्यवस्थापक",
  },
  mr: {
    dashboard: "डॅशबोर्ड", send_file: "फाइल पाठवा", history: "माझा इतिहास",
    phishing: "फिशिंग डिटेक्टर", ai_assistant: "AI सहाय्यक", users: "वापरकर्ते",
    sign_out: "साइन आउट", welcome_back: "परत स्वागत आहे", total_sent: "एकूण पाठवले",
    legitimate: "वैध", suspicious: "संशयास्पद", recent_transactions: "अलीकडील व्यवहार",
    no_transactions: "अद्याप कोणतेही व्यवहार नाहीत", send_first: "पहिली फाइल पाठवा →",
    recipient: "प्राप्तकर्ता", subject: "विषय", file: "फाइल", status: "स्थिती",
    risk: "धोका", date: "तारीख", settings: "सेटिंग्ज", profile: "प्रोफाइल",
    language: "भाषा", privacy_center: "गोपनीयता केंद्र", dark_mode: "डार्क मोड",
    save: "जतन करा", cancel: "रद्द करा", edit_profile: "प्रोफाइल संपादित करा", loading: "लोड होत आहे...",
    platform_overview: "प्लॅटफॉर्म आढावा", total_users: "एकूण वापरकर्ते",
    transactions: "व्यवहार", admins: "प्रशासक",
  },
  gu: {
    dashboard: "ડૅશબોર્ડ", send_file: "ફાઇલ મોકલો", history: "મારો ઇતિહાસ",
    phishing: "ફિશિંગ ડિટેક્ટર", ai_assistant: "AI સહાયક", users: "વપરાશકર્તાઓ",
    sign_out: "સાઇન આઉટ", welcome_back: "પાછા સ્વાગત છે", total_sent: "કુલ મોકલ્યું",
    legitimate: "કાનૂની", suspicious: "શંકાસ્પદ", recent_transactions: "તાજેતરના વ્યવહારો",
    no_transactions: "હજી કોઈ વ્યવહારો નથી", send_first: "પ્રથમ ફાઇલ મોકલો →",
    recipient: "પ્રાપ્તકર્તા", subject: "વિષય", file: "ફાઇલ", status: "સ્થિતિ",
    risk: "જોખમ", date: "તારીખ", settings: "સેટિંગ્સ", profile: "પ્રોફાઇલ",
    language: "ભાષા", privacy_center: "ગોપનીયતા કેન્દ્ર", dark_mode: "ડાર્ક મોડ",
    save: "સાચવો", cancel: "રદ કરો", edit_profile: "પ્રોફાઇલ સંપાદિત કરો", loading: "લોડ થઈ રહ્યું છે...",
    platform_overview: "પ્લેટફોર્મ ઝાંખી", total_users: "કુલ વપરાશકર્તાઓ",
    transactions: "વ્યવહારો", admins: "એડમિન",
  },
  ta: {
    dashboard: "டாஷ்போர்டு", send_file: "கோப்பு அனுப்பு", history: "என் வரலாறு",
    phishing: "ஃபிஷிங் கண்டறிவி", ai_assistant: "AI உதவியாளர்", users: "பயனர்கள்",
    sign_out: "வெளியேறு", welcome_back: "மீண்டும் வரவேற்கிறோம்", total_sent: "மொத்தம் அனுப்பியது",
    legitimate: "சட்டபூர்வமான", suspicious: "சந்தேகாஸ்பதமான", recent_transactions: "சமீபத்திய பரிவர்த்தனைகள்",
    no_transactions: "இன்னும் பரிவர்த்தனைகள் இல்லை", send_first: "முதல் கோப்பை அனுப்பு →",
    recipient: "பெறுநர்", subject: "தலைப்பு", file: "கோப்பு", status: "நிலை",
    risk: "ஆபத்து", date: "தேதி", settings: "அமைப்புகள்", profile: "சுயவிவரம்",
    language: "மொழி", privacy_center: "தனியுரிமை மையம்", dark_mode: "இருண்ட பயன்முறை",
    save: "சேமி", cancel: "ரத்து செய்", edit_profile: "சுயவிவரம் திருத்து", loading: "ஏற்றுகிறது...",
    platform_overview: "தளம் மேலோட்டம்", total_users: "மொத்த பயனர்கள்",
    transactions: "பரிவர்த்தனைகள்", admins: "நிர்வாகிகள்",
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("darkMode") !== "false";
  });
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem("language") || "en";
  });

  // Apply dark/light mode to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.remove("light-mode");
    } else {
      document.documentElement.classList.add("light-mode");
    }
  }, [darkMode]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");
    const avatar_color = localStorage.getItem("avatar_color") || "#6366f1";
    const lang = localStorage.getItem("language") || "en";
    if (token && role && name) {
      setUser({ token, role, name, avatar_color, language: lang });
    }
    setLoading(false);
  }, []);

  const login = (token: string, role: string, name: string) => {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("name", name);
    setUser({ token, role, name, avatar_color: "#6366f1", language: "en" });
  };

  const logout = () => { localStorage.clear(); setUser(null); };

  const updateUser = (fields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...fields };
      if (fields.name) localStorage.setItem("name", fields.name);
      if (fields.avatar_color) localStorage.setItem("avatar_color", fields.avatar_color);
      if (fields.language) localStorage.setItem("language", fields.language);
      return updated;
    });
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      localStorage.setItem("darkMode", String(!prev));
      return !prev;
    });
  };

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
    updateUser({ language: lang });
  };

  const t = (key: string): string => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"]?.[key] || key;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser, darkMode, toggleDarkMode, language, setLanguage, t }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};