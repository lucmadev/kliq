import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Input } from "@/components/ui/input";
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
    <div className="mx-auto flex max-w-[760px] flex-col gap-4">
      <Card title={t("conn.title")}>
        <p className="text-[0.82rem] text-muted-foreground">{t("conn.missing_client")}</p>
        <form className="mt-2.5 flex flex-wrap items-end gap-2.5" onSubmit={(e) => void saveClient(e)}>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("conn.client_id")} <Input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" /></label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("conn.client_secret")} <Input type="password" value={clientSecret} placeholder={secretHint ? `••••${secretHint}` : ""} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" /></label>
          <Button variant="outline" disabled={busy}>{t("conn.save_client")}</Button>
        </form>
        {status.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <strong>{status.channel?.title ?? t("app.brand_fallback")}</strong>
              <div className="text-[0.82rem] text-muted-foreground">
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
            <div className="flex flex-wrap gap-2">
              <Button onClick={sync} disabled={busy || status.syncing}>
                {status.syncing ? t("conn.syncing") : t("conn.sync")}
              </Button>
              <Button variant="outline" onClick={() => void disconnect()}>{t("conn.disconnect")}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-muted-foreground">{t("conn.readonly")}</p>
            <Button onClick={() => void connect()} disabled={busy || !status.configured}>{t("conn.connect")}</Button>
          </div>
        )}
        {msg && <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm">{msg}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-3.5 max-[620px]:grid-cols-1">
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
                  <span className={`mr-1 inline-block size-2 rounded-full ${status.last_sync.status === "ok" ? "bg-good" : status.last_sync.status === "error" ? "bg-critical" : "bg-primary"}`} /> {status.last_sync.status} · {status.last_sync.detail ?? ""}
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
      <p className="text-[0.82rem] text-muted-foreground">{t("conn.csv_help")}</p>
      <form className="mt-2.5 flex flex-wrap items-end gap-2.5" onSubmit={(e) => void submit(e)}>
        <label>{t("conn.from")} <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>{t("conn.to")} <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <input className="text-sm" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button disabled={!file}>{t("conn.import")}</Button>
      </form>
      {msg && <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm">{msg}</p>}
    </Card>
  );
}
