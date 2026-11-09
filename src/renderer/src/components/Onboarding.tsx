import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCENTS, type AccentId } from "../../../shared/theme";
import { api, type SettingsView, type Status } from "../api";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export default function Onboarding({ status, onDone, notify }: {
  status: Status;
  onDone: () => void;
  notify: (message: string) => void;
}) {
  const { t } = useI18n();
  const { accent, resolved, setAccent } = useTheme();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [provider, setProvider] = useState<"anthropic" | "openai" | "compatible">("anthropic");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:11434/v1");
  const [key, setKey] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [agentOn, setAgentOn] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    api.settings().then((view) => {
      setSettings(view);
      if (view.llmProvider !== "none") setProvider(view.llmProvider);
      setBaseUrl(view.llmBaseUrl);
    }).catch((e) => notify(e.message));
  }, [notify]);

  useEffect(() => {
    if (step === 0 && status.connected) setStep(1);
  }, [status.connected, step]);

  const connect = () => {
    setBusy(true);
    api.connect().catch((e) => notify(e.message)).finally(() => setBusy(false));
  };

  const enableAgent = () => {
    setBusy(true);
    api.saveMcp({ enabled: true, port: 47321 })
      .then((saved) => {
        setAgentOn(true);
        setToken(saved.token ?? null);
        setNote(saved.token ? t("mcp.token_once") : t("mcp.running"));
      })
      .catch((e) => notify(e.message))
      .finally(() => setBusy(false));
  };

  const saveSummary = () => {
    if (!settings) return;
    setBusy(true);
    api.saveSettings({
      tz: settings.tz,
      syncHour: settings.syncHour,
      syncDaysBack: settings.syncDaysBack,
      initialDaysBack: settings.initialDaysBack,
      llmProvider: provider,
      llmModel: settings.llmModel,
      llmBaseUrl: baseUrl,
    })
      .then(() => (key.trim() ? api.saveLlmKey(key.trim()) : undefined))
      .then(() => setStep(2))
      .catch((e) => notify(e.message))
      .finally(() => setBusy(false));
  };

  const finish = () => {
    api.finishOnboard().then(onDone).catch((e) => notify(e.message));
  };

  const summaryReady = provider === "compatible" ? baseUrl.trim().length > 0 : key.trim().length > 0;
  const description = step === 0 ? t("onboard.step_connect") : step === 1 ? t("onboard.step_ai") : t("onboard.step_accent");
  const keepOpen = (event: { preventDefault: () => void; target: EventTarget | null }) => {
    if (event.target instanceof Element && event.target.closest("[data-slot=select-content]")) return;
    event.preventDefault();
  };

  return (
    <DialogPrimitive.Root open onOpenChange={() => undefined}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[min(32rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-auto rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
          onEscapeKeyDown={keepOpen}
          onPointerDownOutside={keepOpen}
          onInteractOutside={keepOpen}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("onboard.progress", { current: step + 1, total: 3 })}</p>
            <div className="flex gap-1.5" aria-hidden>
              {[0, 1, 2].map((item) => (
                <span key={item} className={cn("h-1.5 w-6 rounded-full", item === step ? "bg-primary" : "bg-muted")} />
              ))}
            </div>
          </div>
          <DialogPrimitive.Title className="text-lg font-semibold">{t("onboard.title")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
      {step === 0 && (
        <>
          <p className="text-sm">{t("accounts.signed_out")}</p>
          <Button disabled={busy || !status.configured} onClick={connect}>{t("conn.connect")}</Button>
          {!status.configured && <p className="text-sm text-muted-foreground" role="status">{t("error.not_configured")}</p>}
        </>
      )}
      {step === 1 && (
        <>
          <p className="text-sm">{t("mcp.help")}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || agentOn} onClick={enableAgent}>{t("onboard.agent_on")}</Button>
            {agentOn && (
              <Button variant="outline" onClick={() => void api.copyMcp().then(() => setNote(t("mcp.copied"))).catch((e) => notify(e.message))}>
                <Copy strokeWidth={1.75} />{t("mcp.copy")}
              </Button>
            )}
          </div>
          {token && <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm">{token}</code>}
          {note && <p className="text-sm text-muted-foreground" role="status">{note}</p>}
          {agentOn && <Button onClick={() => setStep(2)}>{t("onboard.next")}</Button>}
          <p className="text-sm text-muted-foreground">{t("onboard.step_summary")}</p>
          <Select value={provider} onValueChange={(value) => setProvider(value as typeof provider)}>
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anthropic">{t("byok.provider_anthropic")}</SelectItem>
              <SelectItem value="openai">{t("byok.provider_openai")}</SelectItem>
              <SelectItem value="compatible">{t("byok.provider_compatible")}</SelectItem>
            </SelectContent>
          </Select>
          {provider === "compatible" && (
            <Input
              className="h-10"
              aria-label={t("byok.base_url")}
              placeholder={t("byok.base_url")}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          )}
          {provider !== "compatible" && (
            <Input
              className="h-10"
              type="password"
              aria-label={t("byok.api_key")}
              placeholder={t("byok.api_key")}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <Button disabled={busy || !settings || !summaryReady} onClick={saveSummary}>{t("onboard.summary_on")}</Button>
            <Button variant="outline" onClick={() => setStep(2)}>{t("onboard.skip")}</Button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <p className="text-sm">{t("appearance.accent_help")}</p>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.id}
                title={item.id}
                aria-pressed={accent === item.id}
                className="grid size-11 place-items-center rounded-full ring-border transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:ring-2 aria-pressed:ring-foreground"
                onClick={() => void setAccent(item.id as AccentId)}
              >
                <span className="size-7 rounded-full" style={{ background: resolved === "dark" ? item.dark : item.light }} />
              </button>
            ))}
          </div>
          <Button onClick={finish}>{t("onboard.next")}</Button>
        </>
      )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
