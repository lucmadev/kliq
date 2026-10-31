import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Badge } from "@/components/ui/badge";
import { api, type Status } from "./api";
import Onboarding from "./components/Onboarding";
import Sidebar, { NAV_LABEL, type View } from "./components/Sidebar";
import WindowControls from "./components/TitleBar";
import { Empty } from "./components/ui";
import Settings from "./pages/Settings";
import Videos from "./pages/Videos";
import Weekly from "./pages/Weekly";
import { useI18n } from "./i18n";

export default function App() {
  const { t, locale } = useI18n();
  const [view, setView] = useState<View>("analytics");
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [wizard, setWizard] = useState<"unknown" | "show" | "hide">("unknown");
  const [maximized, setMaximized] = useState(false);
  const panel = useRef<HTMLElement>(null);

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
    panel.current?.scrollTo({ top: 0 });
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
  };

  const frame = maximized ? "rounded-none" : "rounded-2xl border";
  const shell = (title: string, body: ReactNode) => (
    <div className={cn("flex h-full overflow-hidden bg-background", frame)}>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="titlebar flex h-16 shrink-0 items-center gap-3 px-8 max-[760px]:h-14 max-[760px]:px-4">
          <h1 className="min-w-0 truncate text-[1.75rem] font-bold tracking-[-0.02em] max-[760px]:text-[1.375rem]">{title}</h1>
          <span className="flex-1" />
          <WindowControls />
        </header>
        {body}
      </div>
    </div>
  );
  if (error) {
    return shell(t("app.brand_fallback"), <div className="px-8 py-6"><Empty>{t("app.fatal", { error })}</Empty></div>);
  }
  if (!status || wizard === "unknown") {
    return shell(t("app.brand_fallback"), <div className="px-8 py-6 text-sm text-muted-foreground">{t("app.loading")}</div>);
  }

  const hasData = !!status.data_range;
  const settingsView = view !== "analytics" && view !== "videos";
  const select = (next: View) => {
    setView(next);
    setMenuOpen(false);
  };
  const title = wizard === "show" ? t("onboard.title") : t(NAV_LABEL[view]);

  return (
    <div className={cn("flex h-full overflow-hidden bg-background", frame)}>
      <Sidebar
        view={view}
        status={status}
        expanded={expanded}
        menuOpen={menuOpen}
        onExpand={setExpanded}
        onSelect={select}
        onCloseMenu={() => setMenuOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="titlebar flex h-16 shrink-0 items-center gap-3 px-8 max-[760px]:h-14 max-[760px]:gap-2 max-[760px]:px-4">
          <button type="button" aria-label={t("nav.menu")} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}
            className="-ml-2 hidden size-11 shrink-0 place-items-center rounded-lg hover:bg-accent max-[760px]:grid">
            <Menu className="size-5" strokeWidth={1.75} />
          </button>
          <h1 className="min-w-0 truncate text-[1.75rem] font-bold tracking-[-0.02em] max-[760px]:text-[1.375rem]">{title}</h1>
          {status.syncing && <Badge className="ml-1">{t("app.syncing")}</Badge>}
          <span className="flex-1" />
          <WindowControls />
        </header>
        <main ref={panel} className="min-h-0 flex-1 overflow-auto px-8 pt-2 pb-12 max-[760px]:px-4">
          {wizard === "show" ? (
            <Onboarding status={status} onDone={() => setWizard("hide")} notify={notify} />
          ) : !hasData && !settingsView ? (
            <div className="flex max-w-[560px] flex-col items-start gap-3 rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("empty.body")}</p>
              <Button onClick={() => select("connection")}>{t("onboard.cta")}</Button>
            </div>
          ) : view === "analytics" ? (
            <Weekly status={status} onOpenVideo={openVideo} onOpenModel={() => select("model")} />
          ) : view === "videos" ? (
            <Videos status={status} selected={video} onSelect={setVideo} />
          ) : (
            <Settings section={view} status={status} refresh={refresh} notify={notify} />
          )}
        </main>
      </div>
    </div>
  );
}
