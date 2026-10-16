import { useState, type FormEvent } from "react";
import { api, type Status } from "../api";
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

  return (
    <div className="page narrow">
      <Card title={t("conn.title")}>
        {!status.configured ? (
          <div className="setup">
            <p>{t("conn.missing_client")}</p>
          </div>
        ) : status.connected ? (
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
            <button className="btn" onClick={() => notify(t("conn.connect"))}>{t("conn.connect")}</button>
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

      <CsvImport onDone={refresh} />
    </div>
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
