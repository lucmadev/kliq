import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, type Status, type VideoDetail, type VideoRow } from "../api";
import { Card, Delta, Empty } from "../components/ui";
import { day, num, secs, short } from "../format";

type SortKey = "published_at" | "last7" | "views" | "delta_pct" | "ctr";

export default function Videos({ status, selected, onSelect }: {
  status: Status;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("last7");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.videos().then(setRows).catch((e) => setError(e.message));
  }, [status.data_range?.to]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? rows.filter((r) => r.title.toLowerCase().includes(term)) : rows;
    return [...list].sort((a, b) => {
      const av = a[sort] ?? -Infinity;
      const bv = b[sort] ?? -Infinity;
      return av < bv ? 1 : av > bv ? -1 : 0;
    });
  }, [rows, q, sort]);

  if (error) return <Empty>{error}</Empty>;

  const th = (key: SortKey, label: string) => (
    <th className={`r sortable ${sort === key ? "active" : ""}`} onClick={() => setSort(key)}>
      {label}{sort === key ? " ↓" : ""}
    </th>
  );

  return (
    <div className="page">
      {selected && <VideoPanel id={selected} connected={status.connected} onClose={() => onSelect(null)} />}

      <Card title={`Todos los videos (${rows.length})`}
        aside={<input className="search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Video</th>
                {th("published_at", "Publicado")}
                {th("last7", "Últimos 7 d")}
                {th("delta_pct", "Cambio")}
                {th("views", "Total")}
                {th("ctr", "CTR")}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className={`clickable ${selected === v.id ? "selected" : ""}`}
                  onClick={() => { onSelect(v.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <td className="title-cell"><span className="title-text">{v.title}</span></td>
                  <td className="r muted">{day(v.published_at)}</td>
                  <td className="r num">{num(v.last7)}</td>
                  <td className="r"><Delta value={v.delta_pct} /></td>
                  <td className="r num">{short(v.views)}</td>
                  <td className="r num">{v.ctr != null ? `${v.ctr.toFixed(1).replace(".", ",")}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function VideoPanel({ id, connected, onClose }: { id: string; connected: boolean; onClose: () => void }) {
  const [d, setD] = useState<VideoDetail | null>(null);
  const [loadingRet, setLoadingRet] = useState(false);

  const load = () => api.video(id).then(setD).catch((e) => alert(e.message));
  useEffect(() => { setD(null); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <Card><div className="loading">Cargando video…</div></Card>;

  const v = d.video;
  const total90 = d.daily.reduce((s, x) => s + x.views, 0);
  const lastReach = d.reach.at(-1);
  const refreshRetention = async () => {
    setLoadingRet(true);
    try {
      await api.retention(id);
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoadingRet(false);
    }
  };

  return (
    <Card className="video-panel"
      title={<a href={`https://youtu.be/${v.id}`} target="_blank" rel="noreferrer">{v.title} ↗</a>}
      aside={<button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>}>
      <div className="mini-kpis">
        <div><span className="kpi-label">Publicado</span><strong>{day(v.published_at)}</strong></div>
        <div><span className="kpi-label">Duración</span><strong>{secs(v.duration_s)}</strong></div>
        <div><span className="kpi-label">Vistas totales</span><strong>{num(v.views)}</strong></div>
        <div><span className="kpi-label">Últimos 90 días</span><strong>{num(total90)}</strong></div>
        <div><span className="kpi-label">CTR</span><strong>{lastReach?.ctr != null ? `${lastReach.ctr.toFixed(2).replace(".", ",")}%` : "—"}</strong></div>
      </div>

      <div className="grid-2 tight">
        <div>
          <h3 className="sub">Vistas por día (90 días)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={day} minTickGap={40} tickLine={false} axisLine={false}
                tick={{ fill: "var(--text-2)", fontSize: 12 }} />
              <YAxis tickFormatter={short} width={44} tickLine={false} axisLine={false}
                tick={{ fill: "var(--text-2)", fontSize: 12 }} />
              <Tooltip labelFormatter={(l) => day(String(l))} formatter={(x) => [num(Number(x)), "Vistas"]}
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
                itemStyle={{ color: "var(--text-1)" }} labelStyle={{ color: "var(--text-1)" }} />
              <Area dataKey="views" stroke="var(--series-1)" strokeWidth={2} fill="url(#fillViews)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="sub-row">
            <h3 className="sub">Retención de audiencia</h3>
            {connected && (
              <button className="btn ghost small" onClick={refreshRetention} disabled={loadingRet}>
                {loadingRet ? "Trayendo…" : d.retention.length ? "Actualizar" : "Traer de YouTube"}
              </button>
            )}
          </div>
          {d.retention.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={d.retention.map((r) => ({ ...r, pct: Math.round(r.watch_ratio * 1000) / 10, t: r.ratio * v.duration_s }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="t" type="number" domain={[0, v.duration_s]} tickFormatter={(t) => secs(Number(t))}
                  tickLine={false} axisLine={false} tick={{ fill: "var(--text-2)", fontSize: 12 }} />
                <YAxis unit="%" width={44} tickLine={false} axisLine={false} domain={[0, "auto"]}
                  tick={{ fill: "var(--text-2)", fontSize: 12 }} />
                <Tooltip labelFormatter={(t) => secs(Number(t))} formatter={(x) => [`${x}%`, "Siguen mirando"]}
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
                  itemStyle={{ color: "var(--text-1)" }} labelStyle={{ color: "var(--text-1)" }} />
                <Line dataKey="pct" stroke="var(--series-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty>{connected ? "Sin datos guardados todavía." : "Conectá tu canal para traer la curva de retención."}</Empty>
          )}
        </div>
      </div>
    </Card>
  );
}
