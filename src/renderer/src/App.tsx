import { useCallback, useEffect, useState } from "react";
import { api, type Status } from "./api";
import Connection from "./pages/Connection";
import Videos from "./pages/Videos";
import Weekly from "./pages/Weekly";
import { num } from "./format";

type Tab = "semana" | "videos" | "conexion";
const TABS: { id: Tab; label: string }[] = [
  { id: "semana", label: "Semana" },
  { id: "videos", label: "Videos" },
  { id: "conexion", label: "Conexión" },
];

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "semana");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(
    params.get("connected") ? "Canal conectado. Arrancó el primer sync." : params.get("error"),
  );
  const [video, setVideo] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.status().then(setStatus).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
    if (params.toString()) window.history.replaceState(null, "", "/");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // mientras sincroniza, refresca el estado
  useEffect(() => {
    if (!status?.syncing) return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [status?.syncing, refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const openVideo = (id: string) => {
    setVideo(id);
    setTab("videos");
    window.scrollTo({ top: 0 });
  };

  if (error) return <div className="fatal">No llego a la API: {error}</div>;
  if (!status) return <div className="loading">Cargando…</div>;

  const hasData = !!status.data_range;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 32 32"><path d="M8 22l6-7 4 4 6-9" /></svg>
          </span>
          <div>
            <div className="brand-name">{status.channel?.title ?? "YT Monitor"}</div>
            <div className="muted small">
              {status.channel ? `${num(status.channel.subscribers)} suscriptores` : "sin canal conectado"}
              {status.demo && <span className="badge">demo</span>}
              {status.syncing && <span className="badge live">sincronizando</span>}
            </div>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {!hasData && tab !== "conexion" ? (
          <div className="onboarding">
            <h1>Tu monitor semanal, sin créditos</h1>
            <p className="muted">Conectá tu canal y en el primer sync traigo los últimos 120 días de YouTube Analytics.</p>
            <button className="btn" onClick={() => setTab("conexion")}>Ir a Conexión</button>
          </div>
        ) : tab === "semana" ? (
          <Weekly status={status} onOpenVideo={openVideo} />
        ) : tab === "videos" ? (
          <Videos status={status} selected={video} onSelect={setVideo} />
        ) : (
          <Connection status={status} refresh={refresh} />
        )}
      </main>

      {toast && <div className="toast" onClick={() => setToast(null)}>{toast}</div>}
    </div>
  );
}
