import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Input } from "@/components/ui/input";
import { LOCALES, type Locale } from "../../../shared/i18n";
import { THEMES, type ThemeChoice } from "../../../shared/theme";
import { api, type McpView, type SettingsView } from "../api";
import { Card } from "../components/ui";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export default function General({ refresh }: { refresh: () => void }) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <AppearanceCard />
      <ScheduleCard refresh={refresh} />
      <ModelCard refresh={refresh} />
      <McpCard />
    </div>
  );
}

function AppearanceCard() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const field = "rounded-md border bg-card px-2 py-1 text-sm text-foreground";

  return (
    <Card title={t("appearance.title")}>
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("lang.label")}
          <select className={field} value={locale} onChange={(e) => void setLocale(e.target.value as Locale)}>
            {LOCALES.map((code) => (
              <option key={code} value={code}>{t(code === "en" ? "lang.en" : "lang.es")}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t("theme.label")}
          <select className={field} value={theme} onChange={(e) => void setTheme(e.target.value as ThemeChoice)}>
            {THEMES.map((choice) => (
              <option key={choice} value={choice}>{t(`theme.${choice}`)}</option>
            ))}
          </select>
        </label>
      </div>
    </Card>
  );
}

function ScheduleCard({ refresh }: { refresh: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ tz: "", syncHour: 6, syncDaysBack: 28, initialDaysBack: 120 });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.settings().then((settings) => {
      setForm({
        tz: settings.tz,
        syncHour: settings.syncHour,
        syncDaysBack: settings.syncDaysBack,
        initialDaysBack: settings.initialDaysBack,
      });
    }).catch(() => undefined);
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const current = await api.settings();
    try {
      await api.saveSettings({ ...current, ...form });
      setMsg(t("sched.saved"));
      refresh();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  return (
    <Card title={t("sched.title")}>
      <p className="text-[0.82rem] text-muted-foreground">{t("sched.help")}</p>
      <form className="mt-2.5 flex flex-wrap items-end gap-2.5" onSubmit={(e) => void save(e)}>
        <label>{t("sched.hour")} <Input type="number" min={0} max={23} value={form.syncHour} onChange={(e) => setForm({ ...form, syncHour: Number(e.target.value) })} /></label>
        <label>{t("sched.tz")} <Input type="text" value={form.tz} onChange={(e) => setForm({ ...form, tz: e.target.value })} /></label>
        <label>{t("sched.days")} <Input type="number" min={1} max={365} value={form.syncDaysBack} onChange={(e) => setForm({ ...form, syncDaysBack: Number(e.target.value) })} /></label>
        <label>{t("sched.initial")} <Input type="number" min={1} max={730} value={form.initialDaysBack} onChange={(e) => setForm({ ...form, initialDaysBack: Number(e.target.value) })} /></label>
        <Button variant="outline">{t("byok.save")}</Button>
      </form>
      {msg && <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm">{msg}</p>}
    </Card>
  );
}

function ModelCard({ refresh }: { refresh: () => void }) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [provider, setProvider] = useState<SettingsView["llmProvider"]>("none");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    api.settings().then((next) => {
      setSettings(next);
      setProvider(next.llmProvider);
      setModel(next.llmModel);
      setBaseUrl(next.llmBaseUrl);
    }).catch(() => undefined);
  };

  useEffect(load, []);

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
      refresh();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  const clearKey = async () => {
    try {
      const key = await api.clearLlmKey();
      setSettings((cur) => (cur ? { ...cur, ...key, enabled: cur.llmProvider === "compatible" } : cur));
      setMsg(t("byok.key_missing"));
      refresh();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  return (
    <Card title={t("byok.title")}>
      <p className="text-[0.82rem] text-muted-foreground">{t("byok.help")}</p>
      <form className="mt-2.5 flex flex-wrap items-end gap-2.5" onSubmit={(e) => void save(e)}>
        <label>
          {t("byok.provider")}
          <select value={provider} onChange={(e) => setProvider(e.target.value as SettingsView["llmProvider"])}>
            <option value="none">{t("byok.provider_none")}</option>
            <option value="anthropic">{t("byok.provider_anthropic")}</option>
            <option value="openai">{t("byok.provider_openai")}</option>
            <option value="compatible">{t("byok.provider_compatible")}</option>
          </select>
        </label>
        <label>{t("byok.model")} <Input type="text" value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" /></label>
        {provider === "compatible" && (
          <label>{t("byok.base_url")} <Input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></label>
        )}
        <label>
          {t("byok.api_key")}
          <Input type="password" value={apiKey} placeholder={settings?.keyHint ? `••••${settings.keyHint}` : ""} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        </label>
        <Button>{t("byok.save")}</Button>
        {settings?.keySet && <Button type="button" variant="outline" onClick={() => void clearKey()}>{t("byok.clear")}</Button>}
      </form>
      <p className="text-[0.82rem] text-muted-foreground">
        {settings?.keySet ? t("byok.key_set", { hint: settings.keyHint ?? "" }) : t("byok.key_missing")}
      </p>
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

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const saved = await api.saveMcp({ enabled, port });
      setView(saved.view);
      setToken(saved.token ?? null);
      setMsg(saved.view.running ? t("mcp.running", { url: saved.view.url ?? "" }) : t("mcp.stopped"));
    } catch (err) {
      setMsg((err as Error).message);
    }
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
      <form className="mt-2.5 flex flex-wrap items-end gap-2.5" onSubmit={(e) => void save(e)}>
        <label>
          <input type="checkbox" className="size-4 accent-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> {t("mcp.enable")}
        </label>
        <label>{t("mcp.port")} <Input type="number" min={1024} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value))} /></label>
        <Button>{t("byok.save")}</Button>
        <Button type="button" variant="outline" onClick={() => void rotate()}>{t("mcp.rotate")}</Button>
        <Button type="button" variant="outline" onClick={() => void copy()} disabled={!view?.tokenHint}>{t("mcp.copy")}</Button>
      </form>
      <p className="text-[0.82rem] text-muted-foreground">{view?.running ? t("mcp.running", { url: view.url ?? "" }) : t("mcp.stopped")}</p>
      {token && (
        <>
          <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm">{t("mcp.token_once")}</p>
          <p><code>{token}</code></p>
        </>
      )}
      {msg && <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm">{msg}</p>}
    </Card>
  );
}
