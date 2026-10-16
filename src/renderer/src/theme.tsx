import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { THEMES, type ThemeChoice } from "../../shared/theme";
import { api } from "./api";

type ResolvedTheme = "light" | "dark";

type ThemeValue = {
  theme: ThemeChoice;
  resolved: ResolvedTheme;
  setTheme: (theme: ThemeChoice) => Promise<void>;
};

const ThemeContext = createContext<ThemeValue | null>(null);

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [osDark, setOsDark] = useState(systemDark);

  useEffect(() => {
    let pending: Promise<ThemeChoice>;
    try {
      pending = api.theme();
    } catch {
      return;
    }
    void pending.then((stored) => {
      if (THEMES.includes(stored)) setThemeState(stored);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setOsDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme = theme === "system" ? (osDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const value = useMemo<ThemeValue>(() => ({
    theme,
    resolved,
    setTheme: async (next) => {
      await api.setTheme(next);
      setThemeState(next);
    },
  }), [theme, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
