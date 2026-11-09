import { useState, type FormEvent, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Input } from "@/components/ui/input";
import { api, type Status } from "../api";
import { Pill, SettingsSection } from "../components/ui";

const FIELD = "flex flex-col gap-2 text-sm font-medium";
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

  const syncState = status.last_sync?.status;
  const facts: [string, ReactNode][] = [
    [t("conn.facts_data"), status.data_range ? `${day(status.data_range.from, locale)} – ${day(status.data_range.to, locale)}` : t("conn.no_data")],
    [t("conn.facts_last"), status.last_sync ? (
      <span className="inline-flex items-center gap-2">
        {syncState === "ok" ? <Pill tone="good">{t("conn.sync_ok")}</Pill> : syncState === "error" ? <Pill tone="bad">{t("conn.sync_error")}</Pill> : <Pill tone="tint">{t("conn.syncing")}</Pill>}
        <span className="text-muted-foreground">{ago(status.last_sync.finished_at ?? status.last_sync.started_at, locale)}</span>
      </span>
    ) : t("conn.never")],
    [t("conn.facts_ai"), status.llm.enabled ? status.llm.provider : t("conn.ai_off")],
  ];

  return (
    <div className="flex max-w-[1100px] flex-col">
      <SettingsSection title={t("conn.title")} description={<>{t("conn.accounts_help")} {t("conn.readonly")}</>}>
        <ul className="flex flex-col">
          {status.accounts.length === 0 && <li className="text-sm text-muted-foreground">{t("accounts.none")}</li>}
          {status.accounts.map((account) => (
            <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-3 first:pt-0">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-tint-100 text-sm font-semibold text-tint-ink" aria-hidden>
                  {account.title.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{account.title}</span>
                    {account.active && <Pill tone="tint">{t("accounts.active")}</Pill>}
                  </div>
                  <div className="num text-[0.8125rem] text-muted-foreground">
                    {account.connected || account.demo
                      ? t("accounts.subscribers", { count: num(account.subscribers, locale) })
                      : t("accounts.signed_out")}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!account.active && (
                  <Button variant="outline" disabled={busy || status.syncing} onClick={() => void activate(account.id)}>{t("accounts.use")}</Button>
                )}
                {account.active && account.connected && (
                  <Button variant="outline" onClick={sync} disabled={busy || status.syncing}>
                    <RefreshCw strokeWidth={1.75} />
                    {status.syncing ? t("conn.syncing") : t("conn.sync")}
                  </Button>
                )}
                {!account.demo && account.connected && (
                  <Button variant="ghost" className="text-critical hover:text-critical" onClick={() => void disconnect(account.id)}>{t("conn.disconnect")}</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void connect()} disabled={busy || !status.configured}>
            {status.accounts.some((account) => account.connected) ? t("accounts.add") : t("conn.connect")}
          </Button>
        </div>
        {!status.configured && <p className="mt-3 text-sm text-muted-foreground" role="status">{t("error.not_configured")}</p>}
        {msg && <p className="mt-3 text-sm text-muted-foreground" role="status">{msg}</p>}
      </SettingsSection>

      <SettingsSection title={t("conn.facts_title")} description={t("conn.facts_help")}>
        <dl className="flex flex-col">
          {facts.map(([label, value]) => (
            <div key={label} className="flex min-h-10 items-center justify-between gap-4 border-b border-rule text-sm last:border-0">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="num text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>

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
    <SettingsSection title={t("conn.csv_title")} description={t("conn.csv_help")}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
        <div className="grid grid-cols-2 gap-3">
          <label className={FIELD}>{t("conn.from")} <Input className="num h-10" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className={FIELD}>{t("conn.to")} <Input className="num h-10" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <input className="text-sm file:mr-3 file:h-9 file:rounded-lg file:border file:border-input file:bg-card file:px-3 file:text-sm file:font-medium" type="file" accept=".csv,text/csv" aria-label={t("conn.csv_title")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="flex items-center justify-end gap-3">
          {msg && <p className="text-sm text-muted-foreground" role="status">{msg}</p>}
          <Button disabled={!file}>{t("conn.import")}</Button>
        </div>
      </form>
    </SettingsSection>
  );
}
