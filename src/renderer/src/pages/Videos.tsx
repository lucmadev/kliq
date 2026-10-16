import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, type Status, type VideoDetail, type VideoRow } from "../api";
import { Card, Delta, Empty } from "../components/ui";
import { day, num, secs, short } from "../format";
import { useI18n } from "../i18n";

type SortKey = "published_at" | "last7" | "views" | "delta_pct" | "ctr";

export default function Videos({ status, selected, onSelect }: {
  status: Status;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { t, locale } = useI18n();
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

      <Card title={t("videos.count", { count: rows.length })}
        aside={<input className="search" placeholder={t("videos.search")} value={q} onChange={(e) => setQ(e.target.value)} />}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("col.video")}</th>
                {th("published_at", t("col.published"))}
                {th("last7", t("col.last7"))}
                {th("delta_pct", t("col.change"))}
                {th("views", t("col.total"))}
                {th("ctr", t("col.ctr"))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className={`clickable ${selected === v.id ? "selected" : ""}`}
                  onClick={() => { onSelect(v.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <td className="title-cell"><span className="title-text">{v.title}</span></td>
                  <td className="r muted">{day(v.published_at, locale)}</td>
                  <td className="r num">{num(v.last7, locale)}</td>
                  <td className="r"><Delta value={v.delta_pct} /></td>
                  <td className="r num">{short(v.views, locale)}</td>
                  <td className="r num">{v.ctr != null ? `${num(v.ctr, locale)}%` : "—"}</td>
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
  const { t, locale } = useI18n();
  const [d, setD] = useState<VideoDetail | null>(null);
  const [loadingRet, setLoadingRet] = useState(false);

  const load = () => api.video(id).then(setD).catch((e) => alert(e.message));
  useEffect(() => { setD(null); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <Card><div className="loading">{t("videos.loading")}</div></Card>;

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
      aside={<button className="icon-btn" onClick={onClose} aria-label={t("videos.close")}>✕</button>}>
      <div className="mini-kpis">
        <div><span className="kpi-label">{t("col.published")}</span><strong>{day(v.published_at, locale)}</strong></div>
        <div><span className="kpi-label">{t("videos.duration")}</span><strong>{secs(v.duration_s)}</strong></div>
        <div><span className="kpi-label">{t("videos.total_views")}</span><strong>{num(v.views, locale)}</strong></div>
        <div><span className="kpi-label">{t("videos.last90")}</span><strong>{num(total90, locale)}</strong></div>
        <div><span className="kpi-label">{t("col.ctr")}</span><strong>{lastReach?.ctr != null ? `${num(lastReach.ctr, locale)}%` : "—"}</strong></div>
      </div>

      <div className="grid-2 tight">
        <div>
          <h3 className="sub">{t("videos.daily")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(value) => day(String(value), locale)} minTickGap={40} tickLine={false} axisLine={false}
                tick={{ fill: "var(--text-2)", fontSize: 12 }} />
              <YAxis tickFormatter={(value) => short(Number(value), locale)} width={44} tickLine={false} axisLine={false}
                tick={{ fill: "var(--text-2)", fontSize: 12 }} />
              <Tooltip labelFormatter={(l) => day(String(l), locale)} formatter={(x) => [num(Number(x), locale), t("week.views_tip")]}
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
                itemStyle={{ color: "var(--text-1)" }} labelStyle={{ color: "var(--text-1)" }} />
              <Area dataKey="views" stroke="var(--series-1)" strokeWidth={2} fill="url(#fillViews)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="sub-row">
            <h3 className="sub">{t("videos.retention")}</h3>
            {connected && (
              <button className="btn ghost small" onClick={() => void refreshRetention()} disabled={loadingRet}>
                {loadingRet ? t("videos.fetching") : d.retention.length ? t("videos.refresh_retention") : t("videos.fetch_retention")}
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
                <Tooltip labelFormatter={(value) => secs(Number(value))} formatter={(x) => [`${x}%`, t("videos.still_watching")]}
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
                  itemStyle={{ color: "var(--text-1)" }} labelStyle={{ color: "var(--text-1)" }} />
                <Line dataKey="pct" stroke="var(--series-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty>{connected ? t("videos.no_retention") : t("videos.retention_needs_connection")}</Empty>
          )}
        </div>
      </div>
    </Card>
  );
}
