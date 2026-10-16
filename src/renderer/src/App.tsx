import { useCallback, useEffect, useState } from "react";
import { api, type Status } from "./api";
import Connection from "./pages/Connection";
import Videos from "./pages/Videos";
import Weekly from "./pages/Weekly";
import { num } from "./format";
import { useI18n } from "./i18n";
import { LOCALES, type Locale } from "../../shared/i18n";

type Tab = "week" | "videos" | "connection";

export default function App() {
  const { t, locale, setLocale } = useI18n();
  const [tab, setTab] = useState<Tab>("week");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.status().then(setStatus).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, locale]);

  useEffect(() => {
    if (!status?.syncing) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [status?.syncing, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const openVideo = (id: string) => {
    setVideo(id);
    setTab("videos");
    window.scrollTo({ top: 0 });
  };

  const loadDemo = async () => {
    setError(null);
    try {
      await api.seedDemo();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error) return <div className="fatal">{t("app.fatal", { error })}</div>;
  if (!status) return <div className="loading">{t("app.loading")}</div>;

  const hasData = !!status.data_range;
  const tabs: { id: Tab; label: string }[] = [
    { id: "week", label: t("tab.week") },
    { id: "videos", label: t("tab.videos") },
    { id: "connection", label: t("tab.connection") },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 32 32"><path d="M8 22l6-7 4 4 6-9" /></svg>
          </span>
          <div>
            <div className="brand-name">{status.channel?.title ?? t("app.brand_fallback")}</div>
            <div className="muted small">
              {status.channel
                ? t("app.subscribers", { count: num(status.channel.subscribers, locale) })
                : t("app.no_channel")}
              {status.demo && <span className="badge">{t("app.demo")}</span>}
              {status.syncing && <span className="badge live">{t("app.syncing")}</span>}
            </div>
          </div>
        </div>
        <div className="top-actions">
          <label className="lang">
            <span className="muted small">{t("lang.label")}</span>
            <select value={locale} onChange={(e) => void setLocale(e.target.value as Locale)}>
              {LOCALES.map((code) => (
                <option key={code} value={code}>{t(code === "en" ? "lang.en" : "lang.es")}</option>
              ))}
            </select>
          </label>
          <nav className="tabs">
            {tabs.map((item) => (
              <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main>
        {!hasData && tab !== "connection" ? (
          <div className="onboarding">
            <h1>{t("onboard.title")}</h1>
            <p className="muted">{t("onboard.body")}</p>
            <div className="btn-row">
              <button className="btn" onClick={() => setTab("connection")}>{t("onboard.cta")}</button>
              <button className="btn ghost" onClick={() => void loadDemo()}>{t("onboard.demo")}</button>
            </div>
            <p className="muted small">{t("onboard.demo_hint")}</p>
          </div>
        ) : tab === "week" ? (
          <Weekly status={status} onOpenVideo={openVideo} />
        ) : tab === "videos" ? (
          <Videos status={status} selected={video} onSelect={setVideo} />
        ) : (
          <Connection status={status} refresh={refresh} notify={setToast} />
        )}
      </main>

      {toast && <div className="toast" onClick={() => setToast(null)}>{toast}</div>}
    </div>
  );
}
