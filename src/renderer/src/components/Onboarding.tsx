import { useEffect, useState } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type SettingsView, type Status } from "../api";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";
import type { Locale } from "../../../shared/i18n";
import { THEMES, type ThemeChoice } from "../../../shared/theme";

export default function Onboarding({ status, onDone, notify }: {
  status: Status;
  onDone: () => void;
  notify: (message: string) => void;
}) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [provider, setProvider] = useState<"none" | "anthropic" | "openai" | "compatible">("anthropic");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:11434/v1");
  const [key, setKey] = useState("");

  useEffect(() => {
    api.settings().then((view) => {
      setSettings(view);
      if (view.llmProvider !== "none") setProvider(view.llmProvider);
      setModel(view.llmModel);
      setBaseUrl(view.llmBaseUrl);
    }).catch((e) => notify(e.message));
  }, [notify]);

  useEffect(() => {
    if (step === 1 && status.channel) setStep(2);
  }, [status.channel, step]);

  const finish = () => {
    api.finishOnboard().then(onDone).catch((e) => notify(e.message));
  };

  const connect = () => {
    setBusy(true);
    api.connect().catch((e) => notify(e.message)).finally(() => setBusy(false));
  };

  const saveKey = () => {
    if (!settings) return;
    setBusy(true);
    api.saveSettings({
      tz: settings.tz,
      syncHour: settings.syncHour,
      syncDaysBack: settings.syncDaysBack,
      initialDaysBack: settings.initialDaysBack,
      llmProvider: provider,
      llmModel: model,
      llmBaseUrl: baseUrl,
    })
      .then(() => (key.trim() ? api.saveLlmKey(key.trim()) : undefined))
      .then(() => setStep(3))
      .catch((e) => notify(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <div className="mx-auto flex max-w-[520px] flex-col gap-4 py-10">
      <h1 className="text-xl font-semibold">{t("onboard.title")}</h1>
      {step === 0 && (
        <>
          <p className="text-sm text-muted-foreground">{t("onboard.step_lang")}</p>
          <Tabs value={locale} onValueChange={(value) => void setLocale(value as Locale)}>
            <TabsList>
              <TabsTrigger value="en">{t("lang.en")}</TabsTrigger>
              <TabsTrigger value="es">{t("lang.es")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={theme} onValueChange={(value) => void setTheme(value as ThemeChoice)}>
            <TabsList>
              {THEMES.map((choice) => (
                <TabsTrigger key={choice} value={choice}>{t(`theme.${choice}`)}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button onClick={() => setStep(1)}>{t("onboard.next")}</Button>
        </>
      )}
      {step === 1 && (
        <>
          <p className="text-sm text-muted-foreground">{t("onboard.step_connect")}</p>
          <p className="text-sm">{status.channel?.title ?? t("accounts.signed_out")}</p>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={connect}>{t("conn.connect")}</Button>
            <Button variant="outline" onClick={() => setStep(2)}>{t("onboard.skip")}</Button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <p className="text-sm text-muted-foreground">{t("onboard.step_key")}</p>
          <Select value={provider} onValueChange={(value) => setProvider(value as typeof provider)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anthropic">{t("byok.provider_anthropic")}</SelectItem>
              <SelectItem value="openai">{t("byok.provider_openai")}</SelectItem>
              <SelectItem value="compatible">{t("byok.provider_compatible")}</SelectItem>
            </SelectContent>
          </Select>
          <input
            className="rounded-md border bg-card px-2 py-1 text-sm"
            placeholder={t("byok.model")}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          {provider === "compatible" && (
            <input
              className="rounded-md border bg-card px-2 py-1 text-sm"
              placeholder={t("byok.base_url")}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          )}
          <input
            className="rounded-md border bg-card px-2 py-1 text-sm"
            type="password"
            placeholder={t("byok.api_key")}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <div className="flex gap-2">
            <Button disabled={busy} onClick={saveKey}>{t("onboard.next")}</Button>
            <Button variant="outline" onClick={() => setStep(3)}>{t("onboard.skip")}</Button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <p className="text-sm text-muted-foreground">{t("onboard.step_done")}</p>
          <p className="text-sm">{t("onboard.done_body")}</p>
          <Button onClick={finish}>{t("onboard.finish")}</Button>
        </>
      )}
    </div>
  );
}
