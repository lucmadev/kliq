import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ExternalLink, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Status, type VideoDetail, type VideoRow } from "../api";
import { Card, Delta, Empty } from "../components/ui";
import { day, niceTicks, num, secs, short } from "../format";
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
    <TableHead className="text-right" aria-sort={sort === key ? "descending" : undefined}>
      <button type="button" onClick={() => setSort(key)}
        className={cn("inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", sort === key && "font-medium text-foreground")}>
        {sort === key && <ArrowDown className="size-3" strokeWidth={2} />}{label}
      </button>
    </TableHead>
  );

  return (
    <div className="flex flex-col gap-4">
      {selected && <VideoPanel id={selected} connected={status.connected} onClose={() => onSelect(null)} />}

      <Card title={t("videos.count", { count: rows.length })}
        aside={
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
            <Input className="w-[240px] pl-8 max-[620px]:w-[150px]" aria-label={t("videos.search")} placeholder={t("videos.search")} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        }>
        <div className="-mx-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[46%]">{t("col.video")}</TableHead>
                {th("published_at", t("col.published"))}
                {th("last7", t("col.last7"))}
                {th("delta_pct", t("col.change"))}
                {th("views", t("col.total"))}
                {th("ctr", t("col.ctr"))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id} data-state={selected === v.id ? "selected" : undefined} aria-selected={selected === v.id}
                  className={cn("cursor-pointer", selected === v.id && "bg-tint-50 hover:bg-tint-50")}
                  onClick={(e) => { onSelect(v.id); e.currentTarget.closest("main")?.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <TableCell className="max-w-[460px] max-[620px]:max-w-[200px]"><span className={cn("block truncate", selected === v.id && "font-medium")}>{v.title}</span></TableCell>
                  <TableCell className="text-right text-muted-foreground">{day(v.published_at, locale)}</TableCell>
                  <TableCell className="text-right font-medium">{num(v.last7, locale)}</TableCell>
                  <TableCell className="text-right"><Delta value={v.delta_pct} /></TableCell>
                  <TableCell className="text-right">{short(v.views, locale)}</TableCell>
                  <TableCell className="text-right">{v.ctr != null ? `${num(v.ctr, locale)}%` : <span className="text-muted-foreground">–</span>}</TableCell>
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

  if (!d) return <Card><p className="text-sm text-muted-foreground">{t("videos.loading")}</p></Card>;

  const v = d.video;
  const total90 = d.daily.reduce((s, x) => s + x.views, 0);
  const lastReach = d.reach.at(-1);
  const ticks = niceTicks(Math.max(0, ...d.daily.map((x) => x.views)));
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
    <Card
      title={
        <a className="group inline-flex min-w-0 items-center gap-1.5 text-foreground no-underline" href={`https://youtu.be/${v.id}`} target="_blank" rel="noreferrer">
          <span className="truncate group-hover:underline">{v.title}</span>
          <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </a>
      }
      aside={<Button variant="ghost" size="icon" onClick={onClose} aria-label={t("videos.close")}><X strokeWidth={1.75} /></Button>}>
      <dl className="grid grid-cols-5 gap-px overflow-hidden rounded-xl border bg-border max-[900px]:grid-cols-3 max-[620px]:grid-cols-2 max-[620px]:[&>*:last-child:nth-child(odd)]:col-span-2">
        {[
          [t("videos.total_views"), num(v.views, locale)],
          [t("videos.last90"), num(total90, locale)],
          [t("col.ctr"), lastReach?.ctr != null ? `${num(lastReach.ctr, locale)}%` : null],
          [t("col.published"), day(v.published_at, locale)],
          [t("videos.duration"), secs(v.duration_s, locale)],
        ].map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5 bg-card px-4 py-3">
            <dt className="truncate text-[0.8125rem] text-muted-foreground">{label}</dt>
            <dd className="num text-xl font-semibold">{value ?? <span className="text-muted-foreground">–</span>}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid grid-cols-2 gap-6 max-[1000px]:grid-cols-1">
        <div>
          <h3 className="mb-2 flex h-8 items-center text-sm font-semibold">{t("videos.daily")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(value) => day(String(value), locale)} minTickGap={40} tickLine={false} axisLine={{ stroke: "var(--grid)" }}
                tick={{ fill: "var(--text-2)", fontSize: 12 }} />
              <YAxis ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tickFormatter={(value) => short(Number(value), locale)} width={44} tickLine={false} axisLine={{ stroke: "var(--grid)" }}
                tick={{ fill: "var(--text-2)", fontSize: 12 }} />
              <Tooltip labelFormatter={(l) => day(String(l), locale)} formatter={(x) => [num(Number(x), locale), t("week.views_tip")]}
                contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
                itemStyle={{ color: "var(--text-1)" }} labelStyle={{ color: "var(--text-1)" }} />
              <Area type="linear" dataKey="views" stroke="var(--series-1)" strokeWidth={2} fill="var(--series-1)" fillOpacity={0.1} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="mb-2 flex h-8 items-center justify-between">
            <h3 className="text-sm font-semibold">{t("videos.retention")}</h3>
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
                <Line type="linear" dataKey="pct" stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
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
