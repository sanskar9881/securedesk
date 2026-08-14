import { createContext, useContext, useEffect, useState } from "react";

/**
 * Whether the desktop nav rail is collapsed to icons-only. Shared between
 * Navbar (which renders the rail) and Header's <Console> frame (which has to
 * reserve the matching amount of left margin) — two components with no
 * common layout ancestor per-page, so this is a small global instead of a
 * prop threaded through every page.
 */
interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

const STORAGE_KEY = "sidebar_collapsed";
const SidebarContext = createContext<SidebarState | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "true"
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed((v) => !v) }}>
      {children}
    </SidebarContext.Provider>
  );
}

// `useSidebar` ships beside its provider by design, same as useAuth — fast
// refresh only loses state for this one file during development.
// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return ctx;
}
