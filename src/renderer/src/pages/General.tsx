import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LOCALES, type Locale } from "../../../shared/i18n";
import { ACCENTS, THEMES, type AccentId, type ThemeChoice } from "../../../shared/theme";
import { api, type McpView, type SettingsView } from "../api";
import { Copy } from "lucide-react";
import { Pill, SettingsSection } from "../components/ui";

const FIELD = "flex flex-col gap-2 text-sm font-medium";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export type GeneralSection = "appearance" | "model" | "mcp";

export default function General({ section }: { section: GeneralSection; refresh: () => void }) {
  return (
    <div className="flex max-w-[1100px] flex-col">
      {section === "appearance" && <AppearanceCard />}
      {section === "model" && <ModelCard />}
      {section === "mcp" && <McpCard />}
    </div>
  );
}

function AppearanceCard() {
  const { t, locale, setLocale } = useI18n();
  const { theme, accent, resolved, setTheme, setAccent } = useTheme();

  return (
    <>
      <SettingsSection title={t("lang.label")} description={t("appearance.lang_help")}>
          <Tabs value={locale} onValueChange={(value) => void setLocale(value as Locale)}>
            <TabsList>
              {LOCALES.map((code) => (
                <TabsTrigger key={code} value={code}>{t(code === "en" ? "lang.en" : "lang.es")}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
      </SettingsSection>
      <SettingsSection title={t("theme.label")} description={t("appearance.theme_help")}>
          <Tabs value={theme} onValueChange={(value) => void setTheme(value as ThemeChoice)}>
            <TabsList>
              {THEMES.map((choice) => (
                <TabsTrigger key={choice} value={choice}>{t(`theme.${choice}`)}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
      </SettingsSection>
      <SettingsSection title={t("appearance.accent")} description={t("appearance.accent_help")}>
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
      </SettingsSection>
    </>
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
    <SettingsSection title={t("byok.title")} description={t("byok.help")}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
        <label className={FIELD}>
          {t("byok.provider")}
          <Select value={provider} onValueChange={(value) => setProvider(value as SettingsView["llmProvider"])}>
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("byok.provider_none")}</SelectItem>
              <SelectItem value="anthropic">{t("byok.provider_anthropic")}</SelectItem>
              <SelectItem value="openai">{t("byok.provider_openai")}</SelectItem>
              <SelectItem value="compatible">{t("byok.provider_compatible")}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className={FIELD}>
          <span className="flex items-center justify-between gap-2">
            {t("byok.api_key")}
            {settings?.keySet
              ? <Pill tone="good">{t("byok.key_set", { hint: settings.keyHint ?? "" })}</Pill>
              : <Pill>{t("byok.key_missing")}</Pill>}
          </span>
          <Input className="h-10" type="password" value={apiKey} placeholder={settings?.keyHint ? `••••${settings.keyHint}` : ""} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        </label>
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">{t("more.options")}</summary>
          <div className="mt-3 flex flex-col gap-4">
            <label className={FIELD}>
              {t("byok.model")}
              <Input className="h-10" type="text" value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
            </label>
            {provider === "compatible" && (
              <label className={FIELD}>
                {t("byok.base_url")}
                <Input className="h-10" type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </label>
            )}
          </div>
        </details>
        <div className="flex items-center justify-end gap-3">
          {msg && <p className="text-sm text-muted-foreground" role="status">{msg}</p>}
          <Button>{t("byok.save")}</Button>
        </div>
      </form>
    </SettingsSection>
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
    <SettingsSection title={t("mcp.title")} description={t("mcp.help")}>
      <div className="flex items-center justify-between gap-3">
        <label className="flex min-h-11 flex-1 items-center justify-between gap-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            {t("mcp.enable")}
            {view?.running ? <Pill tone="good">{t("mcp.running_short")}</Pill> : <Pill>{t("mcp.stopped")}</Pill>}
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked);
              void persist(checked).catch((err: Error) => setMsg(err.message));
            }}
          />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">{view?.running ? t("mcp.running") : t("mcp.stopped")}</p>
      {enabled && (
        <div className="mt-4">
          <Button type="button" variant="outline" onClick={() => void copy()} disabled={!view?.tokenHint}>
            <Copy strokeWidth={1.75} />{t("mcp.copy")}
          </Button>
        </div>
      )}
      <details className="mt-4 border-t border-rule pt-3">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">{t("more.options")}</summary>
        <form className="mt-3 flex flex-wrap items-end gap-2.5" onSubmit={(e) => { e.preventDefault(); void persist(enabled).catch((err: Error) => setMsg(err.message)); }}>
          <label className={FIELD}>
            {t("mcp.port")}
            <Input className="num h-10 w-32" type="number" min={1024} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value))} />
          </label>
          <Button type="submit" variant="outline" className="h-10">{t("byok.save")}</Button>
          <Button type="button" variant="outline" className="h-10" onClick={() => void rotate()}>{t("mcp.rotate")}</Button>
        </form>
        {token && <p className="mt-3"><code className="rounded-md bg-muted px-2 py-1 font-mono text-sm">{token}</code></p>}
      </details>
      {msg && <p className="mt-3 text-sm text-muted-foreground" role="status">{msg}</p>}
    </SettingsSection>
  );
}
