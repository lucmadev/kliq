import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LOCALES, type Locale } from "../../../shared/i18n";
import { ACCENTS, THEMES, type AccentId, type ThemeChoice } from "../../../shared/theme";
import { api, type McpView, type SettingsView } from "../api";
import { Card } from "../components/ui";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export type GeneralSection = "appearance" | "model" | "mcp";

export default function General({ section }: { section: GeneralSection; refresh: () => void }) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      {section === "appearance" && <AppearanceCard />}
      {section === "model" && <ModelCard />}
      {section === "mcp" && <McpCard />}
    </div>
  );
}

function AppearanceCard() {
  const { t, locale, setLocale } = useI18n();
  const { theme, accent, setTheme, setAccent } = useTheme();

  return (
    <Card title={t("appearance.title")}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t("lang.label")}</span>
          <Tabs value={locale} onValueChange={(value) => void setLocale(value as Locale)}>
            <TabsList>
              {LOCALES.map((code) => (
                <TabsTrigger key={code} value={code}>{t(code === "en" ? "lang.en" : "lang.es")}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t("theme.label")}</span>
          <Tabs value={theme} onValueChange={(value) => void setTheme(value as ThemeChoice)}>
            <TabsList>
              {THEMES.map((choice) => (
                <TabsTrigger key={choice} value={choice}>{t(`theme.${choice}`)}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{t("appearance.accent")}</span>
          <div className="flex gap-2">
            {ACCENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.id}
                aria-pressed={accent === item.id}
                className="size-11 rounded-full border-2 border-transparent ring-offset-2 ring-offset-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:ring-2 aria-pressed:ring-foreground"
                style={{ background: item.light }}
                onClick={() => void setAccent(item.id as AccentId)}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ModelCard() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [provider, setProvider] = useState<SettingsView["llmProvider"]>("none");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.settings().then((next) => {
      setSettings(next);
      setProvider(next.llmProvider);
      setModel(next.llmModel);
      setBaseUrl(next.llmBaseUrl);
    }).catch(() => undefined);
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const saved = await api.saveSettings({ ...settings, llmProvider: provider, llmModel: model, llmBaseUrl: baseUrl });
      if (apiKey.trim()) {
        const key = await api.saveLlmKey(apiKey);
        setSettings({ ...saved, ...key });
      } else {
        setSettings(saved);
      }
      setApiKey("");
      setMsg(t("byok.saved"));
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  return (
    <Card title={t("byok.title")}>
      <p className="text-[0.82rem] text-muted-foreground">{t("byok.help")}</p>
      <form className="mt-2.5 flex flex-wrap items-end gap-2.5" onSubmit={(e) => void save(e)}>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("byok.provider")}
          <Select value={provider} onValueChange={(value) => setProvider(value as SettingsView["llmProvider"])}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("byok.provider_none")}</SelectItem>
              <SelectItem value="anthropic">{t("byok.provider_anthropic")}</SelectItem>
              <SelectItem value="openai">{t("byok.provider_openai")}</SelectItem>
              <SelectItem value="compatible">{t("byok.provider_compatible")}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("byok.api_key")}
          <Input type="password" value={apiKey} placeholder={settings?.keyHint ? `••••${settings.keyHint}` : ""} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        </label>
        <Button>{t("byok.save")}</Button>
      </form>
      <p className="text-[0.82rem] text-muted-foreground">
        {settings?.keySet ? t("byok.key_set", { hint: settings.keyHint ?? "" }) : t("byok.key_missing")}
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">{t("more.options")}</summary>
        <div className="mt-2 flex flex-wrap gap-2.5">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("byok.model")}
            <Input type="text" value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
          </label>
          {provider === "compatible" && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("byok.base_url")}
              <Input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </label>
          )}
        </div>
      </details>
      {msg && <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm">{msg}</p>}
    </Card>
  );
}

function McpCard() {
  const { t } = useI18n();
  const [view, setView] = useState<McpView | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [port, setPort] = useState(47321);
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.mcp().then((next) => {
      setView(next);
      setEnabled(next.enabled);
      setPort(next.port);
    }).catch(() => undefined);
  }, []);

  const persist = async (nextEnabled: boolean, nextPort = port) => {
    const saved = await api.saveMcp({ enabled: nextEnabled, port: nextPort });
    setView(saved.view);
    setToken(saved.token ?? null);
    setMsg(saved.view.running ? t("mcp.running") : t("mcp.stopped"));
  };

  const rotate = async () => {
    try {
      const saved = await api.rotateMcp();
      setToken(saved.token);
      setView(saved.view);
      setMsg(t("mcp.token_once"));
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  const copy = async () => {
    try {
      await api.copyMcp();
      setMsg(t("mcp.copied"));
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  return (
    <Card title={t("mcp.title")}>
      <p className="text-[0.82rem] text-muted-foreground">{t("mcp.help")}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked);
              void persist(checked).catch((err: Error) => setMsg(err.message));
            }}
          />
          {t("mcp.enable")}
        </label>
        {enabled && (
          <Button type="button" variant="outline" onClick={() => void copy()} disabled={!view?.tokenHint}>{t("mcp.copy")}</Button>
        )}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">{t("more.options")}</summary>
        <form className="mt-2 flex flex-wrap items-end gap-2.5" onSubmit={(e) => { e.preventDefault(); void persist(enabled).catch((err: Error) => setMsg(err.message)); }}>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("mcp.port")}
            <Input type="number" min={1024} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value))} />
          </label>
          <Button type="submit" variant="outline">{t("byok.save")}</Button>
          <Button type="button" variant="outline" onClick={() => void rotate()}>{t("mcp.rotate")}</Button>
        </form>
        {token && <p className="mt-2"><code>{token}</code></p>}
      </details>
      <p className="mt-2 text-[0.82rem] text-muted-foreground">{view?.running ? t("mcp.running") : t("mcp.stopped")}</p>
      {msg && <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm">{msg}</p>}
    </Card>
  );
}
