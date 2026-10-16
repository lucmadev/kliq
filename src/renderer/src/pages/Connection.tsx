import { useState, type FormEvent } from "react";
import { api, type Status } from "../api";
import { Card } from "../components/ui";
import { ago, day, num } from "../format";

export default function Connection({ status, refresh }: { status: Status; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sync = async () => {
    setBusy(true);
    try {
      const r = await api.sync();
      setMsg(r.started ? "Sincronizando… la primera vez puede tardar un par de minutos." : r.reason ?? "");
      refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("¿Desconectar la cuenta de Google? Los datos guardados se mantienen.")) return;
    await api.disconnect();
    refresh();
  };

  return (
    <div className="page narrow">
      <Card title="Cuenta de YouTube">
        {!status.configured ? (
          <div className="setup">
            <p>Falta configurar el cliente OAuth de Google. Completá <code>GOOGLE_CLIENT_ID</code> y{" "}
              <code>GOOGLE_CLIENT_SECRET</code> en el <code>.env</code> y reiniciá la API. Los pasos están en el README.</p>
          </div>
        ) : status.connected ? (
          <div className="conn-row">
            <div>
              <strong>{status.channel?.title ?? "Canal conectado"}</strong>
              <div className="muted small">
                {status.channel && <>{num(status.channel.subscribers)} suscriptores · {num(status.videos)} videos · </>}
                último sync {ago(status.last_sync?.finished_at ?? status.last_sync?.started_at)}
              </div>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={sync} disabled={busy || status.syncing}>
                {status.syncing ? "Sincronizando…" : "Sincronizar ahora"}
              </button>
              <button className="btn ghost" onClick={disconnect}>Desconectar</button>
            </div>
          </div>
        ) : (
          <div className="conn-row">
            <p className="muted">Solo lectura: pide <code>youtube.readonly</code> y <code>yt-analytics.readonly</code>.
              Nadie más que vos ve los datos; quedan en tu SQLite.</p>
            <a className="btn" href="/api/auth/login">Conectar con Google</a>
          </div>
        )}
        {msg && <p className="notice">{msg}</p>}

        <dl className="facts">
          <div><dt>Datos</dt><dd>{status.data_range ? `${day(status.data_range.from)} → ${day(status.data_range.to)}` : "sin datos"}{status.demo && " (demo)"}</dd></div>
          <div><dt>Último sync</dt><dd>
            {status.last_sync ? <>
              <span className={`dot ${status.last_sync.status}`} /> {status.last_sync.status} · {status.last_sync.detail ?? ""}
            </> : "nunca"}</dd></div>
          <div><dt>Próximo sync</dt><dd>{status.next_sync ? new Date(status.next_sync).toLocaleString("es-AR") : "scheduler apagado"}</dd></div>
          <div><dt>Resumen IA</dt><dd>{status.llm.enabled ? status.llm.provider : "desactivado"}</dd></div>
        </dl>
      </Card>

      <CsvImport onDone={refresh} />
    </div>
  );
}

function CsvImport({ onDone }: { onDone: () => void }) {
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
      setMsg(`Listo: ${r.imported} videos con impresiones y CTR.`);
      onDone();
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  return (
    <Card title="Impresiones y CTR (CSV de Studio)">
      <p className="muted small">
        La API no expone impresiones ni CTR. En YouTube Studio → Estadísticas → Contenido → <em>Ver más</em>,
        elegí el período, sumá las columnas “Impresiones” y “Porcentaje de clics de las impresiones”, y exportá
        como CSV. Subí el archivo <code>Datos de la tabla.csv</code> del zip.
      </p>
      <form className="csv-form" onSubmit={submit}>
        <label>Desde <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Hasta <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className="btn" disabled={!file}>Importar</button>
      </form>
      {msg && <p className="notice">{msg}</p>}
    </Card>
  );
}
