import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  name: string;
  role: "admin" | "manager" | "user";
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
  updateUser: (f: Partial<User>) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  language: string;
  setLanguage: (l: string) => void;
  t: (k: string) => string;
}

const AuthContext = createContext<AuthCtx | null>(null);

const TR: Record<string, Record<string, string>> = {
  en: {
    dashboard: "Dashboard", send_file: "Send File", history: "My History",
    phishing: "Phishing Detector", ai_assistant: "AI Assistant", users: "Users",
    sign_out: "Sign out", profile: "Profile", settings: "Settings",
    language: "Language", privacy_center: "Privacy Center",
    total_sent: "Total Sent", legitimate: "Legitimate", suspicious: "Suspicious",
    platform_overview: "Platform Overview", recent_transactions: "Recent Transactions",
    no_transactions: "No transactions yet", total_users: "Total Users",
    admins: "Admins", transactions: "Transactions", avg_risk: "Avg Risk",
    regular_users: "Regular Users", send_first: "Send your first file →",
    welcome_back: "Welcome back",
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]   = useState<User | null>(null);
  const [loading, setLoad]= useState(true);
  const [darkMode, setDark]= useState(() => localStorage.getItem("darkMode") !== "false");
  const [language, setLang]= useState(() => localStorage.getItem("language") || "en");

  useEffect(() => {
    document.documentElement.classList.toggle("light-mode", !darkMode);
    document.body.classList.toggle("light-mode", !darkMode);
  }, [darkMode]);

  useEffect(() => {
    const token  = localStorage.getItem("token");
    const role   = (localStorage.getItem("role") || "user") as User["role"];
    const name   = localStorage.getItem("name");
    const id     = localStorage.getItem("user_id") || "";
    const color  = localStorage.getItem("avatar_color") || "#1657C4";
    const lang   = localStorage.getItem("language") || "en";

    if (token && name) {
      setUser({ id, token, role, name, avatar_color: color, language: lang });
    }
    setLoad(false);
  }, []);

  const login = (token: string, role: string, name: string, userId = "") => {
    // Sanitize role — must be one of three valid values
    const validRoles = ["admin", "manager", "user"];
    const cleanRole  = validRoles.includes(role?.toLowerCase())
      ? (role.toLowerCase() as User["role"])
      : "user";

    localStorage.setItem("token",        token);
    localStorage.setItem("role",         cleanRole);
    localStorage.setItem("name",         name);
    localStorage.setItem("user_id",      userId);
    localStorage.setItem("avatar_color", "#1657C4");

    setUser({
      id:           userId,
      token,
      role:         cleanRole,
      name,
      avatar_color: "#1657C4",
      language:     "en",
    });
  };

  const logout = () => {
    ["token","role","name","user_id","avatar_color","org_id","org_name"]
      .forEach(k => localStorage.removeItem(k));
    setUser(null);
  };

  const updateUser = (fields: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...fields };
      if (fields.name)         localStorage.setItem("name",         fields.name);
      if (fields.avatar_color) localStorage.setItem("avatar_color", fields.avatar_color);
      if (fields.language)     localStorage.setItem("language",     fields.language);
      if (fields.org_id)       localStorage.setItem("org_id",       fields.org_id!);
      if (fields.org_name)     localStorage.setItem("org_name",     fields.org_name!);
      return next;
    });
  };

  const toggleDarkMode = () =>
    setDark(p => { localStorage.setItem("darkMode", String(!p)); return !p; });

  const setLanguage = (l: string) => {
    setLang(l);
    localStorage.setItem("language", l);
  };

  const t = (k: string) => TR[language]?.[k] ?? TR["en"]?.[k] ?? k;

  return (
    <AuthContext.Provider value={{
      user, login, logout, loading, updateUser,
      darkMode, toggleDarkMode, language, setLanguage, t,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// `useAuth` ships beside its provider by design; splitting it would mean
// touching every import for no runtime benefit. Fast-refresh only loses
// state for this one file during development.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
