import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api, type Status } from "../api";
import { Card } from "../components/ui";
import { day, num } from "../format";
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

  const disconnect = async (id: string) => {
    if (!confirm(t("conn.disconnect_confirm"))) return;
    await api.disconnect(id);
    refresh();
  };

  const activate = async (id: string) => {
    setBusy(true);
    try {
      await api.activateAccount(id);
      refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
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
        <ul className="flex flex-col gap-2">
          {status.accounts.length === 0 && <li className="text-muted-foreground">{t("accounts.none")}</li>}
          {status.accounts.map((account) => (
            <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div>
                <strong>{account.title}</strong>
                {account.active && <Badge className="ml-2">{t("accounts.active")}</Badge>}
                <div className="text-[0.82rem] text-muted-foreground">
                  {account.connected || account.demo
                    ? t("accounts.subscribers", { count: num(account.subscribers, locale) })
                    : t("accounts.signed_out")}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!account.active && (
                  <Button variant="outline" disabled={busy || status.syncing} onClick={() => void activate(account.id)}>{t("accounts.use")}</Button>
                )}
                {account.active && account.connected && (
                  <Button onClick={sync} disabled={busy || status.syncing}>
                    {status.syncing ? t("conn.syncing") : t("conn.sync")}
                  </Button>
                )}
                {!account.demo && account.connected && (
                  <Button variant="outline" onClick={() => void disconnect(account.id)}>{t("conn.disconnect")}</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-muted-foreground">{t("conn.readonly")}</p>
          <Button onClick={() => void connect()} disabled={busy || !status.configured}>
            {status.accounts.some((account) => account.connected) ? t("accounts.add") : t("conn.connect")}
          </Button>
        </div>
        {!status.configured && (
          <form className="mt-4 flex flex-wrap items-end gap-2.5 border-t pt-3" onSubmit={(e) => void saveClient(e)}>
            <p className="w-full text-[0.82rem] text-muted-foreground">
              {t("conn.missing_client")}{" "}
              <a className="text-primary underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">{t("conn.console")}</a>
            </p>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("conn.client_id")} <Input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">{t("conn.client_secret")} <Input type="password" value={clientSecret} placeholder={secretHint ? `••••${secretHint}` : ""} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" /></label>
            <Button variant="outline" disabled={busy}>{t("conn.save_client")}</Button>
          </form>
        )}
        {msg && <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm">{msg}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-3.5 max-[620px]:grid-cols-1">
          <div>
            <dt>{t("conn.facts_data")}</dt>
            <dd>
              {status.data_range ? `${day(status.data_range.from, locale)} → ${day(status.data_range.to, locale)}` : t("conn.no_data")}
            </dd>
          </div>
          <div>
            <dt>{t("conn.facts_last")}</dt>
            <dd>
              {status.last_sync ? (
                <>
                  <span className={`mr-1 inline-block size-2 rounded-full ${status.last_sync.status === "ok" ? "bg-good" : status.last_sync.status === "error" ? "bg-critical" : "bg-primary"}`} />
                  {status.last_sync.status === "ok" ? t("conn.sync_ok") : status.last_sync.status === "error" ? t("conn.sync_error") : t("conn.syncing")}
                </>
              ) : t("conn.never")}
            </dd>
          </div>
          <div>
            <dt>{t("conn.facts_ai")}</dt>
            <dd>{status.llm.enabled ? status.llm.provider : t("conn.ai_off")}</dd>
          </div>
        </dl>
      </Card>

      {!status.has_daily_reach && <CsvImport onDone={refresh} />}
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
    <Card>
      <details>
        <summary className="cursor-pointer text-sm font-medium">{t("conn.csv_title")}</summary>
      <p className="mt-2 text-[0.82rem] text-muted-foreground">{t("conn.csv_help")}</p>
      <form className="mt-2.5 flex flex-wrap items-end gap-2.5" onSubmit={(e) => void submit(e)}>
        <label>{t("conn.from")} <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>{t("conn.to")} <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <input className="text-sm" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button disabled={!file}>{t("conn.import")}</Button>
      </form>
      {msg && <p className="mt-3 rounded-md bg-accent px-3 py-2 text-sm">{msg}</p>}
      </details>
    </Card>
  );
}
