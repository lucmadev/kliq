import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Badge } from "@/components/ui/badge";
import { api, type Status } from "./api";
import Onboarding from "./components/Onboarding";
import Sidebar, { type View } from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
import { fadeIn } from "./motion";
import Settings from "./pages/Settings";
import Videos from "./pages/Videos";
import Weekly from "./pages/Weekly";
import { num } from "./format";
import { useI18n } from "./i18n";

export default function App() {
  const { t, locale } = useI18n();
  const [view, setView] = useState<View>("analytics");
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [wizard, setWizard] = useState<"unknown" | "show" | "hide">("unknown");
  const [maximized, setMaximized] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    api.status().then(setStatus).catch((e: Error) => setError(e.message));
  }, []);

  const notify = useCallback((message: string) => {
    toast(message);
  }, []);

  useEffect(() => {
    api.status()
      .then(async (next) => {
        setStatus(next);
        if (wizard !== "unknown") return;
        const done = await api.onboarded().catch(() => true);
        setWizard(!done && !next.channel && !next.demo ? "show" : "hide");
      })
      .catch((e: Error) => setError(e.message));
  }, [refresh, locale, wizard]);

  useEffect(() => {
    setVideo(null);
  }, [status?.channel?.id]);

  useEffect(() => api.onWindowMaximized(setMaximized), []);

  useEffect(() => api.onAccount(refresh), [refresh]);

  useEffect(() => {
    if (panel.current) fadeIn(panel.current);
  }, [view]);

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
    setView("videos");
    window.scrollTo({ top: 0 });
  };

  const frame = maximized ? "rounded-none" : "rounded-2xl border";
  if (error) {
    return (
      <div className={cn("flex h-full flex-col overflow-hidden bg-background", frame)}>
        <TitleBar />
        <div className="p-12 text-center text-muted-foreground">{t("app.fatal", { error })}</div>
      </div>
    );
  }
  if (!status || wizard === "unknown") {
    return (
      <div className={cn("flex h-full flex-col overflow-hidden bg-background", frame)}>
        <TitleBar />
        <div className="p-12 text-center text-muted-foreground">{t("app.loading")}</div>
      </div>
    );
  }

  const hasData = !!status.data_range;
  const settingsView = view !== "analytics" && view !== "videos";

  return (
    <div className={cn("flex h-full flex-col overflow-hidden bg-background", frame)}>
      <TitleBar />
      <div className="flex min-h-0 flex-1">
      <Sidebar view={view} expanded={expanded} onExpand={setExpanded} onSelect={setView} />
      <div ref={panel} className="min-w-0 flex-1 overflow-auto px-6 pb-12 max-[620px]:px-3.5">
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/90 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="truncate text-[1.05rem] font-semibold">{status.channel?.title ?? t("app.brand_fallback")}</div>
            <div className="text-[0.82rem] text-muted-foreground">
              {status.channel
                ? t("app.subscribers", { count: num(status.channel.subscribers, locale) })
                : t("app.no_channel")}
              {status.syncing && <Badge className="ml-2">{t("app.syncing")}</Badge>}
            </div>
          </div>
        </header>

        {wizard === "show" ? (
          <Onboarding status={status} onDone={() => setWizard("hide")} notify={notify} />
        ) : !hasData && !settingsView ? (
          <div className="flex flex-col items-center gap-2.5 px-5 py-20 text-center">
            <h1 className="text-[1.8rem] font-semibold tracking-tight">{t("empty.title")}</h1>
            <p className="text-muted-foreground">{t("empty.body")}</p>
            <Button onClick={() => setView("connection")}>{t("onboard.cta")}</Button>
          </div>
        ) : view === "analytics" ? (
          <Weekly status={status} onOpenVideo={openVideo} onOpenModel={() => setView("model")} />
        ) : view === "videos" ? (
          <Videos status={status} selected={video} onSelect={setVideo} />
        ) : (
          <Settings section={view} status={status} refresh={refresh} notify={notify} />
        )}
      </div>
      </div>
    </div>
  );
}
