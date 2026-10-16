import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  }, [status.channel?.id]);

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
    <TableHead className={`cursor-pointer text-right select-none ${sort === key ? "text-foreground" : ""}`} onClick={() => setSort(key)}>
      {label}{sort === key ? " ↓" : ""}
    </TableHead>
  );

  return (
    <div className="flex flex-col gap-4">
      {selected && <VideoPanel id={selected} connected={status.connected} onClose={() => onSelect(null)} />}

      <Card title={t("videos.count", { count: rows.length })}
        aside={<Input className="w-[200px] max-[620px]:w-[130px]" placeholder={t("videos.search")} value={q} onChange={(e) => setQ(e.target.value)} />}>
        <div className="-mx-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.video")}</TableHead>
                {th("published_at", t("col.published"))}
                {th("last7", t("col.last7"))}
                {th("delta_pct", t("col.change"))}
                {th("views", t("col.total"))}
                {th("ctr", t("col.ctr"))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id} className={`cursor-pointer ${selected === v.id ? "bg-accent" : ""}`}
                  onClick={() => { onSelect(v.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <TableCell className="max-w-[460px] max-[620px]:max-w-[200px]"><span className="inline-block max-w-full truncate align-bottom">{v.title}</span></TableCell>
                  <TableCell className="text-right text-muted-foreground">{day(v.published_at, locale)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{num(v.last7, locale)}</TableCell>
                  <TableCell className="text-right"><Delta value={v.delta_pct} /></TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{short(v.views, locale)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{v.ctr != null ? `${num(v.ctr, locale)}%` : t("empty.none")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

  if (!d) return <Card><div className="py-6 text-center text-muted-foreground">{t("videos.loading")}</div></Card>;

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
    <Card className="border-primary"
      title={<a className="text-foreground no-underline hover:underline" href={`https://youtu.be/${v.id}`} target="_blank" rel="noreferrer">{v.title} ↗</a>}
      aside={<Button variant="outline" size="icon" onClick={onClose} aria-label={t("videos.close")}>✕</Button>}>
      <div className="mb-2 flex flex-wrap gap-7">
        <div className="flex flex-col"><span className="text-xs text-muted-foreground">{t("col.published")}</span><strong className="tabular-nums">{day(v.published_at, locale)}</strong></div>
        <div className="flex flex-col"><span className="text-xs text-muted-foreground">{t("videos.duration")}</span><strong className="tabular-nums">{secs(v.duration_s, locale)}</strong></div>
        <div className="flex flex-col"><span className="text-xs text-muted-foreground">{t("videos.total_views")}</span><strong className="tabular-nums">{num(v.views, locale)}</strong></div>
        <div className="flex flex-col"><span className="text-xs text-muted-foreground">{t("videos.last90")}</span><strong className="tabular-nums">{num(total90, locale)}</strong></div>
        <div className="flex flex-col"><span className="text-xs text-muted-foreground">{t("col.ctr")}</span><strong className="tabular-nums">{lastReach?.ctr != null ? `${num(lastReach.ctr, locale)}%` : t("empty.none")}</strong></div>
      </div>

      <div className="grid grid-cols-2 gap-5 max-[1000px]:grid-cols-1">
        <div>
          <h3 className="mt-4 mb-2 text-sm font-semibold text-muted-foreground">{t("videos.daily")}</h3>
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
          <div className="mt-4 mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">{t("videos.retention")}</h3>
            {connected && (
              <Button variant="outline" size="sm" onClick={() => void refreshRetention()} disabled={loadingRet}>
                {loadingRet ? t("videos.fetching") : d.retention.length ? t("videos.refresh_retention") : t("videos.fetch_retention")}
              </Button>
            )}
          </div>
          {d.retention.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={d.retention.map((r) => ({ ...r, pct: Math.round(r.watch_ratio * 1000) / 10, t: r.ratio * v.duration_s }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="t" type="number" domain={[0, v.duration_s]} tickFormatter={(value) => secs(Number(value), locale)}
                  tickLine={false} axisLine={false} tick={{ fill: "var(--text-2)", fontSize: 12 }} />
                <YAxis unit="%" width={44} tickLine={false} axisLine={false} domain={[0, "auto"]}
                  tick={{ fill: "var(--text-2)", fontSize: 12 }} />
                <Tooltip labelFormatter={(value) => secs(Number(value), locale)} formatter={(x) => [`${x}%`, t("videos.still_watching")]}
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
