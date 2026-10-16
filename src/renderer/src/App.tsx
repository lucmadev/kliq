import { useCallback, useEffect, useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Badge } from "@/components/ui/badge";
import { api, type Status } from "./api";
import Settings from "./pages/Settings";
import Videos from "./pages/Videos";
import Weekly from "./pages/Weekly";
import { num } from "./format";
import { useI18n } from "./i18n";
import { LOCALES, type Locale } from "../../shared/i18n";

type Tab = "week" | "videos" | "settings";

export default function App() {
  const { t, locale, setLocale } = useI18n();
  const [tab, setTab] = useState<Tab>("week");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.status().then(setStatus).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, locale]);

  useEffect(() => {
    setVideo(null);
  }, [status?.channel?.id]);

  useEffect(() => {
    return api.onAuth((result) => {
      toast(result.ok ? t("toast.connected") : result.message ?? t("error.oauth_generic"));
      refresh();
    });
  }, [refresh, t]);

  useEffect(() => {
    if (!status?.syncing) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [status?.syncing, refresh]);

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

  if (error) return <div className="p-12 text-center text-muted-foreground">{t("app.fatal", { error })}</div>;
  if (!status) return <div className="p-12 text-center text-muted-foreground">{t("app.loading")}</div>;

  const hasData = !!status.data_range;
  const tabs: { id: Tab; label: string }[] = [
    { id: "week", label: t("tab.week") },
    { id: "videos", label: t("tab.videos") },
  ];

  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-12 max-[620px]:px-3.5">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-background/90 py-4 backdrop-blur max-[620px]:flex-col max-[620px]:items-stretch">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary" aria-hidden>
            <svg className="size-5 fill-none stroke-white stroke-[3]" viewBox="0 0 32 32"><path d="M8 22l6-7 4 4 6-9" /></svg>
          </span>
          <div className="min-w-0">
            <div className="truncate text-[1.05rem] font-semibold">{status.channel?.title ?? t("app.brand_fallback")}</div>
            <div className="text-[0.82rem] text-muted-foreground">
              {status.channel
                ? t("app.subscribers", { count: num(status.channel.subscribers, locale) })
                : t("app.no_channel")}
              {status.demo && <Badge variant="outline" className="ml-2">{t("app.demo")}</Badge>}
              {status.syncing && <Badge className="ml-2">{t("app.syncing")}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[0.82rem] text-muted-foreground">
            {t("lang.label")}
            <select className="rounded-md border bg-card px-2 py-1 text-sm text-foreground" value={locale} onChange={(e) => void setLocale(e.target.value as Locale)}>
              {LOCALES.map((code) => (
                <option key={code} value={code}>{t(code === "en" ? "lang.en" : "lang.es")}</option>
              ))}
            </select>
          </label>
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
            <TabsList className="max-[620px]:w-full">
              {tabs.map((item) => (
                <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>
              ))}
              <TabsTrigger value="settings" aria-label={t("tab.settings")}>
                <SettingsIcon className="size-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main>
        {!hasData && tab !== "settings" ? (
          <div className="flex flex-col items-center gap-2.5 px-5 py-20 text-center">
            <h1 className="text-[1.8rem] font-semibold tracking-tight">{t("onboard.title")}</h1>
            <p className="text-muted-foreground">{t("onboard.body")}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setTab("settings")}>{t("onboard.cta")}</Button>
              <Button variant="outline" onClick={() => void loadDemo()}>{t("onboard.demo")}</Button>
            </div>
            <p className="text-[0.82rem] text-muted-foreground">{t("onboard.demo_hint")}</p>
          </div>
        ) : tab === "week" ? (
          <Weekly status={status} onOpenVideo={openVideo} />
        ) : tab === "videos" ? (
          <Videos status={status} selected={video} onSelect={setVideo} />
        ) : (
          <Settings status={status} refresh={refresh} notify={(message) => toast(message)} />
        )}
      </main>
    </div>
  );
}
