import { useEffect, useState, type FormEvent } from "react";
import { api, type McpView, type SettingsView, type Status } from "../api";
import { Card } from "../components/ui";
import { ago, day, num } from "../format";
import { useI18n } from "../i18n";

export default function Connection({ status, refresh, notify }: {
  status: Status;
  refresh: () => void;
  notify: (message: string) => void;
}) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [secretHint, setSecretHint] = useState<string | null>(null);

  useEffect(() => {
    api.client().then((client) => {
      setClientId(client.clientId);
      setSecretHint(client.secretHint);
    }).catch(() => undefined);
  }, [status.configured, status.connected]);

  const sync = async () => {
    setBusy(true);
    try {
      const r = await api.sync();
      const text = r.started ? t("conn.sync_started") : r.reason ?? "";
      setMsg(text);
      if (r.started) notify(text);
      refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm(t("conn.disconnect_confirm"))) return;
    await api.disconnect();
    refresh();
  };

  const saveClient = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await api.saveClient(clientId, clientSecret);
      setClientSecret("");
      setSecretHint(saved.secretHint);
      setMsg(t("conn.save_client"));
      refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      await api.connect();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <Card title={t("conn.title")}>
        <p className="muted small">{t("conn.missing_client")}</p>
        <form className="csv-form" onSubmit={(e) => void saveClient(e)}>
          <label>{t("conn.client_id")} <input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" /></label>
          <label>{t("conn.client_secret")} <input type="password" value={clientSecret} placeholder={secretHint ? `••••${secretHint}` : ""} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" /></label>
          <button className="btn ghost" disabled={busy}>{t("conn.save_client")}</button>
        </form>
        {status.connected ? (
          <div className="conn-row">
            <div>
              <strong>{status.channel?.title ?? t("app.brand_fallback")}</strong>
              <div className="muted small">
                {status.channel && (
                  <>
                    {t("conn.subscribers_videos", {
                      subs: num(status.channel.subscribers, locale),
                      videos: num(status.videos, locale),
                    })}
                  </>
                )}
                {t("conn.last_sync_line", { when: ago(status.last_sync?.finished_at ?? status.last_sync?.started_at, locale) })}
              </div>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={sync} disabled={busy || status.syncing}>
                {status.syncing ? t("conn.syncing") : t("conn.sync")}
              </button>
              <button className="btn ghost" onClick={() => void disconnect()}>{t("conn.disconnect")}</button>
            </div>
          </div>
        ) : (
          <div className="conn-row">
            <p className="muted">{t("conn.readonly")}</p>
            <button className="btn" onClick={() => void connect()} disabled={busy || !status.configured}>{t("conn.connect")}</button>
          </div>
        )}
        {msg && <p className="notice">{msg}</p>}

        <dl className="facts">
          <div>
            <dt>{t("conn.facts_data")}</dt>
            <dd>
              {status.data_range ? `${day(status.data_range.from, locale)} → ${day(status.data_range.to, locale)}` : t("conn.no_data")}
              {status.demo && ` (${t("app.demo")})`}
            </dd>
          </div>
          <div>
            <dt>{t("conn.facts_last")}</dt>
            <dd>
              {status.last_sync ? (
                <>
                  <span className={`dot ${status.last_sync.status}`} /> {status.last_sync.status} · {status.last_sync.detail ?? ""}
                </>
              ) : t("conn.never")}
            </dd>
          </div>
          <div>
            <dt>{t("conn.facts_next")}</dt>
            <dd>{status.next_sync ? new Date(status.next_sync).toLocaleString(locale === "es" ? "es-AR" : "en-US") : t("conn.scheduler_off")}</dd>
          </div>
          <div>
            <dt>{t("conn.facts_ai")}</dt>
            <dd>{status.llm.enabled ? status.llm.provider : t("conn.ai_off")}</dd>
          </div>
        </dl>
      </Card>

      <ScheduleCard refresh={refresh} />
      <ModelCard refresh={refresh} />
      <McpCard />
      <CsvImport onDone={refresh} />
    </div>
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
      <p className="muted small">{t("sched.help")}</p>
      <form className="csv-form" onSubmit={(e) => void save(e)}>
        <label>{t("sched.hour")} <input type="number" min={0} max={23} value={form.syncHour} onChange={(e) => setForm({ ...form, syncHour: Number(e.target.value) })} /></label>
        <label>{t("sched.tz")} <input type="text" value={form.tz} onChange={(e) => setForm({ ...form, tz: e.target.value })} /></label>
        <label>{t("sched.days")} <input type="number" min={1} max={365} value={form.syncDaysBack} onChange={(e) => setForm({ ...form, syncDaysBack: Number(e.target.value) })} /></label>
        <label>{t("sched.initial")} <input type="number" min={1} max={730} value={form.initialDaysBack} onChange={(e) => setForm({ ...form, initialDaysBack: Number(e.target.value) })} /></label>
        <button className="btn ghost">{t("byok.save")}</button>
      </form>
      {msg && <p className="notice">{msg}</p>}
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
      <p className="muted small">{t("byok.help")}</p>
      <form className="csv-form" onSubmit={(e) => void save(e)}>
        <label>
          {t("byok.provider")}
          <select value={provider} onChange={(e) => setProvider(e.target.value as SettingsView["llmProvider"])}>
            <option value="none">{t("byok.provider_none")}</option>
            <option value="anthropic">{t("byok.provider_anthropic")}</option>
            <option value="openai">{t("byok.provider_openai")}</option>
            <option value="compatible">{t("byok.provider_compatible")}</option>
          </select>
        </label>
        <label>{t("byok.model")} <input type="text" value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" /></label>
        {provider === "compatible" && (
          <label>{t("byok.base_url")} <input type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></label>
        )}
        <label>
          {t("byok.api_key")}
          <input type="password" value={apiKey} placeholder={settings?.keyHint ? `••••${settings.keyHint}` : ""} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
        </label>
        <button className="btn">{t("byok.save")}</button>
        {settings?.keySet && <button type="button" className="btn ghost" onClick={() => void clearKey()}>{t("byok.clear")}</button>}
      </form>
      <p className="muted small">
        {settings?.keySet ? t("byok.key_set", { hint: settings.keyHint ?? "" }) : t("byok.key_missing")}
      </p>
      {msg && <p className="notice">{msg}</p>}
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
      <p className="muted small">{t("mcp.help")}</p>
      <form className="csv-form" onSubmit={(e) => void save(e)}>
        <label>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> {t("mcp.enable")}
        </label>
        <label>{t("mcp.port")} <input type="number" min={1024} max={65535} value={port} onChange={(e) => setPort(Number(e.target.value))} /></label>
        <button className="btn">{t("byok.save")}</button>
        <button type="button" className="btn ghost" onClick={() => void rotate()}>{t("mcp.rotate")}</button>
        <button type="button" className="btn ghost" onClick={() => void copy()} disabled={!view?.tokenHint}>{t("mcp.copy")}</button>
      </form>
      <p className="muted small">{view?.running ? t("mcp.running", { url: view.url ?? "" }) : t("mcp.stopped")}</p>
      {token && (
        <>
          <p className="notice">{t("mcp.token_once")}</p>
          <p><code>{token}</code></p>
        </>
      )}
      {msg && <p className="notice">{msg}</p>}
    </Card>
  );
}

function CsvImport({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const [start, setStart] = useState(iso(new Date(today.getTime() - 30 * 864e5)));
  const [end, setEnd] = useState(iso(new Date(today.getTime() - 2 * 864e5)));
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      const r = await api.importReach(file, start, end);
      setMsg(t("conn.imported", { count: r.imported }));
      onDone();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  return (
    <Card title={t("conn.csv_title")}>
      <p className="muted small">{t("conn.csv_help")}</p>
      <form className="csv-form" onSubmit={(e) => void submit(e)}>
        <label>{t("conn.from")} <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>{t("conn.to")} <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className="btn" disabled={!file}>{t("conn.import")}</button>
      </form>
      {msg && <p className="notice">{msg}</p>}
    </Card>
  );
}
