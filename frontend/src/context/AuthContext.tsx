import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  name: string;
  role: string;   // "admin" | "manager" | "user"
  token: string;
  avatar_color: string;
  language: string;
  org_id?: string;
  org_name?: string;
}

interface AuthCtx {
  user: User | null;
  login: (token: string, role: string, name: string, userId?: string) => void;
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

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    dashboard:"Dashboard", send_file:"Send File", history:"My History",
    phishing:"Phishing Detector", ai_assistant:"AI Assistant", users:"Users",
    sign_out:"Sign out", profile:"Profile", settings:"Settings",
    language:"Language", privacy_center:"Privacy Center",
    total_sent:"Total Sent", legitimate:"Legitimate", suspicious:"Suspicious",
  },
  hi: {
    dashboard:"डैशबोर्ड", send_file:"फ़ाइल भेजें", history:"मेरा इतिहास",
    phishing:"फ़िशिंग डिटेक्टर", ai_assistant:"AI सहायक", users:"उपयोगकर्ता",
    sign_out:"साइन आउट", profile:"प्रोफ़ाइल", settings:"सेटिंग्स",
    language:"भाषा", privacy_center:"गोपनीयता केंद्र",
    total_sent:"कुल भेजा", legitimate:"वैध", suspicious:"संदिग्ध",
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<User | null>(null);
  const [loading, setLoad]  = useState(true);
  const [darkMode, setDark] = useState<boolean>(() => {
    return localStorage.getItem("darkMode") !== "false";
  });
  const [language, setLangState] = useState(() => localStorage.getItem("language") || "en");

  // Apply dark/light mode class
  useEffect(() => {
    document.documentElement.classList.toggle("light-mode", !darkMode);
    document.body.classList.toggle("light-mode", !darkMode);
  }, [darkMode]);

  // Restore session on page load
  useEffect(() => {
    const token  = localStorage.getItem("token");
    const role   = localStorage.getItem("role");
    const name   = localStorage.getItem("name");
    const id     = localStorage.getItem("user_id") || "";
    const color  = localStorage.getItem("avatar_color") || "#6366f1";
    const lang   = localStorage.getItem("language") || "en";
    const org_id = localStorage.getItem("org_id") || "";
    const org_name = localStorage.getItem("org_name") || "";

    if (token && role && name) {
      setUser({ id, token, role, name, avatar_color: color, language: lang, org_id, org_name });
    }
    setLoad(false);
  }, []);

  const login = (token: string, role: string, name: string, userId = "") => {
    const cleanRole = (role || "user").toLowerCase().trim();
    localStorage.setItem("token",     token);
    localStorage.setItem("role",      cleanRole);
    localStorage.setItem("name",      name);
    localStorage.setItem("user_id",   userId);
    localStorage.setItem("avatar_color", "#6366f1");
    setUser({ id: userId, token, role: cleanRole, name, avatar_color: "#6366f1", language: "en" });
  };

  const logout = () => {
    ["token","role","name","user_id","avatar_color","org_id","org_name"].forEach(k => localStorage.removeItem(k));
    setUser(null);
  };

  const updateUser = (fields: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...fields };
      if (fields.name)         localStorage.setItem("name", fields.name);
      if (fields.avatar_color) localStorage.setItem("avatar_color", fields.avatar_color);
      if (fields.language)     localStorage.setItem("language", fields.language);
      if (fields.org_id)       localStorage.setItem("org_id", fields.org_id);
      if (fields.org_name)     localStorage.setItem("org_name", fields.org_name);
      return next;
    });
  };

  const toggleDarkMode = () => {
    setDark(prev => {
      localStorage.setItem("darkMode", String(!prev));
      return !prev;
    });
  };

  const setLanguage = (lang: string) => {
    setLangState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string) =>
    TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"]?.[key] || key;

  return (
    <AuthContext.Provider value={{
      user, login, logout, loading, updateUser,
      darkMode, toggleDarkMode, language, setLanguage, t,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
