import { useEffect, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CountingNumber } from "@/components/animate-ui/primitives/texts/counting-number";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Report, type Status } from "../api";
import { Card, Delta, Empty, Flag, MiniMarkdown } from "../components/ui";
import { day, num, range, secs, short } from "../format";
import { useI18n } from "../i18n";

type Props = { status: Status; onOpenVideo: (id: string) => void; onOpenModel: () => void };

export default function Weekly({ status, onOpenVideo, onOpenModel }: Props) {
  const { t, locale } = useI18n();
  const [weeks, setWeeks] = useState<string[]>([]);
  const [week, setWeek] = useState<string | undefined>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    api.weeks().then((w) => {
      setWeeks(w);
      setWeek(w[0]);
    }).catch((e) => setError(e.message));
  }, [status.channel?.id]);

  useEffect(() => {
    if (!week) return;
    setError(null);
    api.report(week).then(setReport).catch((e) => setError(e.message));
  }, [week, status.channel?.id]);

  if (error && !report) return <Empty>{error}</Empty>;
  if (!weeks.length && !report) return <Empty>{t("week.empty")}</Empty>;
  if (!report) return <div className="p-12 text-center text-muted-foreground">{t("week.loading")}</div>;

  const idx = weeks.indexOf(report.week.start);
  const summarize = async () => {
    setSummarizing(true);
    try {
      const { summary } = await api.summarize(report.week.start);
      setReport({ ...report, summary });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" disabled={idx >= weeks.length - 1}
            onClick={() => setWeek(weeks[idx + 1])} aria-label={t("week.previous")}>‹</Button>
          <select className="rounded-md border bg-card px-2.5 py-1.5 text-sm" value={report.week.start} onChange={(e) => setWeek(e.target.value)}>
            {weeks.map((w, i) => (
              <option key={w} value={w}>
                {i === 0 ? t("week.latest_prefix") : ""}{range(w, addDays(w, 6), locale)}
              </option>
            ))}
          </select>
          <Button variant="outline" size="icon" disabled={idx <= 0}
            onClick={() => setWeek(weeks[idx - 1])} aria-label={t("week.next")}>›</Button>
        </div>
        <span className="text-[0.82rem] text-muted-foreground">
          {t("week.vs", {
            range: range(report.previous_week.start, report.previous_week.end, locale),
            through: day(report.data_through, locale),
          })}
        </span>
      </div>

      <div className="grid grid-cols-6 gap-3 max-[1000px]:grid-cols-3 max-[620px]:grid-cols-2">
        {report.kpis.map((k) => (
          <div className="flex flex-col gap-1 rounded-xl border bg-card p-3.5" key={k.key}>
            <span className="text-xs text-muted-foreground">{k.label}</span>
            <span className="text-[1.6rem] font-semibold tracking-tight max-[620px]:text-[1.3rem]">
              {k.unit === "secs" ? secs(k.current) : <CountingNumber number={k.current} format={(value) => num(Math.round(value), locale)} />}
            </span>
            <span className="flex flex-wrap items-baseline gap-2 text-xs">
              <Delta value={k.delta_pct} />
              <span className="text-muted-foreground">{t("col.before").toLowerCase()} {k.unit === "secs" ? secs(k.previous) : num(k.previous, locale)}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 max-[1000px]:grid-cols-1">
        <Card title={t("week.what")}>
          {report.insights.length ? (
            <ul className="flex list-disc flex-col gap-2 pl-4 text-sm marker:text-primary">
              {report.insights.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          ) : <Empty>{t("week.quiet")}</Empty>}
          <div className="mt-4 rounded-[10px] bg-accent p-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-primary uppercase">{t("week.ai")}</span>
              {status.llm.enabled ? (
                <Button variant="ghost" size="sm" onClick={summarize} disabled={summarizing}>
                  {summarizing ? t("week.thinking") : report.summary ? t("week.regenerate") : t("week.generate")}
                </Button>
              ) : (
                <button type="button" className="text-[0.82rem] text-primary underline" onClick={onOpenModel}>{t("week.ai_off")}</button>
              )}
            </div>
            {report.summary ? <MiniMarkdown text={report.summary} /> : (
              <p className="text-[0.82rem] text-muted-foreground">{t("week.ai_pending")}</p>
            )}
          </div>
        </Card>

        <Card title={t("week.views_by_day")} aside={<span className="text-[0.82rem] text-muted-foreground">{t("week.vs_previous")}</span>}>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={report.daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "var(--text-2)", fontSize: 12 }} />
                <YAxis tickFormatter={(v) => short(Number(v), locale)} tickLine={false} axisLine={false} width={44}
                  tick={{ fill: "var(--text-2)", fontSize: 12 }} />
                <Tooltip
                  cursor={{ stroke: "var(--text-3)", strokeWidth: 1 }}
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
                  labelStyle={{ color: "var(--text-1)" }}
                  itemStyle={{ color: "var(--text-1)" }}
                  formatter={(v) => num(Number(v), locale)}
                />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--text-2)" }} />
                <Line name={t("week.series_previous")} dataKey="previous" stroke="var(--prev)" strokeWidth={2}
                  strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
                <Line name={t("week.series_current")} dataKey="current" stroke="var(--series-1)" strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: "var(--series-1)" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 max-[1000px]:grid-cols-1">
        <Card title={t("week.traffic")}>
          <div className="flex flex-col gap-2">
            {report.traffic.filter((row) => row.current || row.previous).map((row) => (
              <div className="grid grid-cols-[minmax(120px,1.3fr)_1.2fr_52px_64px_70px] items-center gap-2.5 text-sm max-[620px]:grid-cols-[minmax(0,1fr)_52px_64px]" key={row.source} title={t("week.traffic_tip", {
                label: row.label,
                current: num(row.current, locale),
                previous: num(row.previous, locale),
              })}>
                <span className="truncate">{row.label}</span>
                <span className="h-2 overflow-hidden rounded bg-grid max-[620px]:hidden">
                  <span className="block h-full rounded-r bg-primary" style={{ width: `${Math.max(row.share, 0.5)}%` }} />
                </span>
                <span className="text-right font-mono text-sm tabular-nums">{num(row.share, locale)}%</span>
                <span className="text-right font-mono text-sm tabular-nums">{num(row.current, locale)}</span>
                <span className="max-[620px]:hidden"><Delta value={row.delta_pct} /></span>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t("week.launches")} aside={<span className="text-[0.82rem] text-muted-foreground">{t("week.launch_aside")}</span>}>
          {report.launches.length ? report.launches.map((l) => (
            <button className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-grid py-2.5 text-left max-[620px]:grid-cols-1" key={l.id} onClick={() => onOpenVideo(l.id)}>
              <span className="truncate font-medium hover:text-primary">{l.title}</span>
              <span className="text-[0.82rem] text-muted-foreground">{t("week.published", {
                date: day(l.published_at, locale),
                days: l.days,
                unit: l.days === 1 ? t("week.day") : t("week.days"),
              })}</span>
              <span className="row-span-2 self-center text-right tabular-nums max-[620px]:row-auto max-[620px]:mt-1 max-[620px]:text-left">
                <strong>{num(l.views, locale)}</strong>
                <span className="text-muted-foreground"> {t("week.vs_baseline", { baseline: l.baseline != null ? num(Math.round(l.baseline), locale) : "—" })}</span>
                {l.ratio != null && (
                  <span className={`ml-1.5 rounded-md px-1.5 font-mono text-sm font-semibold ${l.ratio >= 1 ? "bg-good/15 text-good" : "bg-critical/15 text-critical"}`}>{num(l.ratio, locale)}x</span>
                )}
              </span>
            </button>
          )) : <Empty>{t("week.no_launches")}</Empty>}

          <h3 className="mt-4 mb-2 text-sm font-semibold text-muted-foreground">{t("week.searches")}</h3>
          {report.search_terms.length ? (
            <div className="flex flex-wrap gap-1.5">
              {report.search_terms.slice(0, 16).map((s) => (
                <span className={`rounded-full border bg-popover px-2.5 py-0.5 text-[0.82rem] ${s.is_new ? "border-primary" : ""}`} key={s.term} title={t("week.search_tip", { count: num(s.views, locale) })}>
                  {s.is_new && <span className="text-xs text-primary">{t("delta.new")} · </span>}
                  {s.term} <span className="text-muted-foreground">{short(s.views, locale)}</span>
                </span>
              ))}
            </div>
          ) : <Empty>{t("week.no_searches")}</Empty>}
        </Card>
      </div>

      <Card title={t("week.videos")} aside={<span className="text-[0.82rem] text-muted-foreground">{t("week.median_aside", { count: num(report.median_week_views, locale) })}</span>}>
        <div className="-mx-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.video")}</TableHead>
                <TableHead className="text-right">{t("col.views")}</TableHead>
                <TableHead className="text-right">{t("col.before")}</TableHead>
                <TableHead className="text-right">{t("col.change")}</TableHead>
                <TableHead className="text-right">{t("col.vs_median")}</TableHead>
                <TableHead className="text-right">{t("col.hours")}</TableHead>
                <TableHead className="text-right">{t("col.subs")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.videos.map((v) => (
                <TableRow key={v.id} onClick={() => onOpenVideo(v.id)} className="cursor-pointer">
                  <TableCell className="max-w-[460px] max-[620px]:max-w-[200px]">
                    <span className="inline-block max-w-[calc(100%-5.5rem)] truncate align-bottom">{v.title}</span> <Flag flag={v.flag} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{num(v.views, locale)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground tabular-nums">{num(v.previous, locale)}</TableCell>
                  <TableCell className="text-right"><Delta value={v.delta_pct} /></TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{v.ratio_vs_median != null ? `${num(v.ratio_vs_median, locale)}x` : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{num(v.watch_hours, locale)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{num(v.subs, locale)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card title={t("week.reach")}
        aside={report.reach ? <span className="text-[0.82rem] text-muted-foreground">{t("week.reach_aside", {
          range: range(report.reach.period_start, report.reach.period_end, locale),
          ctr: report.reach.median_ctr != null ? num(report.reach.median_ctr, locale) : "—",
        })}</span> : null}>
        {report.reach ? (
          <div className="-mx-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>{t("col.video")}</TableHead><TableHead className="text-right">{t("col.impressions")}</TableHead><TableHead className="text-right">{t("col.ctr")}</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {report.reach.rows.slice(0, 10).map((r) => {
                  const low = report.reach!.median_ctr != null && r.ctr != null && r.ctr < report.reach!.median_ctr * 0.7 && r.impressions >= 1000;
                  return (
                    <TableRow key={r.video_id} onClick={() => onOpenVideo(r.video_id)} className="cursor-pointer">
                      <TableCell className="max-w-[460px]"><span className="inline-block max-w-[calc(100%-5.5rem)] truncate align-bottom">{r.title}</span>
                        {low && <span className="ml-1.5 inline-block rounded-md bg-critical/15 px-1.5 align-middle text-[0.7rem] font-semibold text-critical">▼ {t("flag.low_ctr")}</span>}</TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">{num(r.impressions, locale)}</TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">{r.ctr != null ? `${num(r.ctr, locale)}%` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty>{t("week.no_reach")}</Empty>
        )}
      </Card>
    </div>
  );
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
