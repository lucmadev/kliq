import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Locale, type MessageKey } from "../../shared/i18n";
import { api } from "./api";

type I18nValue = {
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => Promise<void>;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    api.locale().then(setLocaleState).catch(() => setLocaleState("en"));
  }, []);

  const value = useMemo<I18nValue>(() => ({
    locale,
    t: (key, vars) => translate(locale, key, vars),
    setLocale: async (next) => {
      await api.setLocale(next);
      setLocaleState(next);
    },
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
