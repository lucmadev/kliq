import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Report, type Status } from "../api";
import RangeCalendar from "../components/RangeCalendar";
import { Aside, Card, Delta, Empty, Flag, MiniMarkdown, Pill } from "../components/ui";
import { intlTag, type Locale, type MessageKey } from "../../../shared/i18n";
import { day, niceTicks, num, range, secs, short } from "../format";
import { useI18n } from "../i18n";

type Props = { status: Status; onOpenVideo: (id: string) => void; onOpenModel: () => void };
type Mode = "week" | "month" | "year" | "custom";

export default function Weekly({ status, onOpenVideo, onOpenModel }: Props) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<Mode>("week");
  const [weeks, setWeeks] = useState<string[]>([]);
  const [week, setWeek] = useState<string | undefined>();
  const [anchor, setAnchor] = useState<string | null>(null);
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [allVideos, setAllVideos] = useState(false);
  const page = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.weeks().then((w) => {
      setWeeks(w);
      setWeek(w[0]);
    }).catch((e) => setError(e.message));
    const end = status.data_range?.to;
    if (end) {
      setAnchor(`${end.slice(0, 7)}-01`);
      setCustom({ start: status.data_range?.from ?? end, end });
    }
  }, [status.channel?.id, status.data_range?.from, status.data_range?.to]);

  const bounds = useMemo(() => {
    if (mode === "week") return week ?? null;
    if (mode === "month" && anchor) return { start: anchor, end: monthEnd(anchor) };
    if (mode === "year" && anchor) return { start: `${anchor.slice(0, 4)}-01-01`, end: `${anchor.slice(0, 4)}-12-31` };
    if (mode === "custom" && custom.start && custom.end && custom.start <= custom.end) return custom;
    return null;
  }, [mode, week, anchor, custom]);

  useEffect(() => {
    if (!bounds) return;
    setError(null);
    api.report(bounds).then(setReport).catch((e) => setError(e.message));
  }, [bounds, status.channel?.id]);

  if (error && !report) return <Empty>{error}</Empty>;
  if (!weeks.length && !report) return <Empty>{t("week.empty")}</Empty>;
  if (!report) return <p className="py-6 text-sm text-muted-foreground">{t("week.loading")}</p>;

  const pickMode = (next: Mode) => {
    const end = status.data_range?.to;
    if (end && next === "month") setAnchor(`${end.slice(0, 7)}-01`);
    if (end && next === "year") setAnchor(`${end.slice(0, 4)}-01-01`);
    setMode(next);
    if (next === "custom") setPickerOpen(true);
  };
  const label = (slot: string) => t(`period.${slot}.${mode}` as MessageKey);
  const spanDays = report ? daysBetween(report.week.start, report.week.end) + 1 : 0;
  const currentRange = range(report.week.start, report.week.end, locale);
  const previousRange = range(report.previous_week.start, report.previous_week.end, locale);

  const idx = weeks.indexOf(report.week.start);
  const summarize = async () => {
    setSummarizing(true);
    try {
      const { summary } = await api.summarize(bounds ?? report.week.start);
      setReport({ ...report, summary });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSummarizing(false);
    }
  };

  const [finding, ...rest] = report.insights;
  const insights = showAll ? rest : rest.slice(0, 4);
  const ticks = niceTicks(Math.max(0, ...report.daily.flatMap((d) => [d.current ?? 0, d.previous ?? 0])));
  const currentName = mode === "custom" ? currentRange : label("series_current");
  const previousName = mode === "custom" ? previousRange : label("series_previous");
  const reachRows = report.reach?.rows.slice(0, 8) ?? [];

  return (
    <div ref={page} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Tabs value={mode} onValueChange={(value) => pickMode(value as Mode)}>
          <TabsList>
            {(["week", "month", "year", "custom"] as Mode[]).map((item) => (
              <TabsTrigger key={item} value={item}>{t(`period.${item}`)}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {mode === "week" && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" disabled={idx >= weeks.length - 1}
              onClick={() => setWeek(weeks[idx + 1])} aria-label={label("nav_previous")}><ChevronLeft strokeWidth={1.75} /></Button>
            <Select value={report.week.start} onValueChange={setWeek}>
              <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
              <SelectContent>
                {weeks.map((w, i) => (
                  <SelectItem key={w} value={w}>
                    {i === 0 ? t("week.latest_prefix") : ""}{range(w, addDays(w, 6), locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" disabled={idx <= 0}
              onClick={() => setWeek(weeks[idx - 1])} aria-label={label("nav_next")}><ChevronRight strokeWidth={1.75} /></Button>
          </div>
        )}
        {mode === "month" && anchor && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => setAnchor(shiftMonth(anchor, -1))} aria-label={label("nav_previous")}><ChevronLeft strokeWidth={1.75} /></Button>
            <span className="num min-w-24 text-center text-sm font-medium">{monthLabel(anchor, locale)}</span>
            <Button variant="outline" size="icon" onClick={() => setAnchor(shiftMonth(anchor, 1))} aria-label={label("nav_next")}><ChevronRight strokeWidth={1.75} /></Button>
          </div>
        )}
        {mode === "year" && anchor && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => setAnchor(shiftYear(anchor, -1))} aria-label={label("nav_previous")}><ChevronLeft strokeWidth={1.75} /></Button>
            <span className="num min-w-14 text-center text-sm font-medium">{anchor.slice(0, 4)}</span>
            <Button variant="outline" size="icon" onClick={() => setAnchor(shiftYear(anchor, 1))} aria-label={label("nav_next")}><ChevronRight strokeWidth={1.75} /></Button>
          </div>
        )}
        {mode === "custom" && (
          <Button variant="outline" onClick={() => setPickerOpen(true)}>
            <CalendarRange strokeWidth={1.75} />
            {custom.start && custom.end ? range(custom.start, custom.end, locale) : t("period.pick")}
          </Button>
        )}
        <RangeCalendar
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          value={custom}
          onApply={(start, end) => {
            setCustom({ start, end });
            setPickerOpen(false);
          }}
        />
        <span className="text-[0.8125rem] text-muted-foreground">
          {t("week.vs", {
            range: range(report.previous_week.start, report.previous_week.end, locale),
            through: day(report.data_through, locale),
          })}
        </span>
      </div>

      {finding && <p className="max-w-[90ch] text-[0.9375rem] leading-6">{finding}</p>}

      <div className="grid grid-cols-6 gap-px overflow-hidden rounded-2xl border bg-border max-[1180px]:grid-cols-3 max-[620px]:grid-cols-2">
        {report.kpis.map((k, i) => (
          <div className="flex min-w-0 flex-col gap-1 bg-card px-5 py-4" key={k.key}>
            <span className="truncate text-[0.8125rem] text-muted-foreground">{k.label}</span>
            <span className={cn("num leading-tight font-semibold tracking-[-0.01em]", i === 0 ? "text-[2rem] max-[620px]:text-[1.625rem]" : "text-2xl max-[620px]:text-xl")}>
              {k.unit === "secs" ? secs(k.current, locale) : num(k.current, locale)}
            </span>
            <span className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
              <Delta value={k.delta_pct} />
              <span className="num text-muted-foreground">{t("col.before").toLowerCase()} {k.unit === "secs" ? secs(k.previous, locale) : num(k.previous, locale)}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-4 max-[1000px]:grid-cols-1">
        <Card
          title={t(spanDays > 62 ? "period.views_by_week" : "week.views_by_day")}
          aside={
            <span className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Swatch color="var(--series-1)" />{currentName}</span>
              <span className="flex items-center gap-1.5"><Swatch color="var(--prev)" dashed />{previousName}</span>
            </span>
          }
          contentClassName="flex flex-col"
        >
          <div className="relative min-h-[260px] flex-1">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.daily} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: "var(--grid)" }} interval="preserveStartEnd" minTickGap={24}
                    tick={{ fill: "var(--text-2)", fontSize: 12 }} tickMargin={8} />
                  <YAxis ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tickFormatter={(v) => short(Number(v), locale)}
                    tickLine={false} axisLine={false} width={44} tick={{ fill: "var(--text-2)", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ stroke: "var(--text-3)", strokeWidth: 1 }}
                    contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                    labelStyle={{ color: "var(--text-1)" }}
                    itemStyle={{ color: "var(--text-1)" }}
                    formatter={(v) => num(Number(v), locale)}
                  />
                  <Line name={previousName} dataKey="previous" stroke="var(--prev)" strokeWidth={1.5}
                    strokeDasharray="4 4" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                  <Line name={currentName} dataKey="current" stroke="var(--series-1)" strokeWidth={2}
                    dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card title={mode === "custom" ? t("period.what.between", { range: currentRange }) : label("what")}>
          {rest.length ? (
            <>
              <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-[1.45] marker:text-primary">
                {insights.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
              {rest.length > 4 && (
                <button type="button" onClick={() => setShowAll(!showAll)}
                  className="mt-2 text-sm font-medium text-tint-ink hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                  {showAll ? t("week.show_less") : t("week.show_all", { count: rest.length })}
                </button>
              )}
            </>
          ) : <Empty>{mode === "custom" ? t("period.quiet.between", { range: currentRange }) : label("quiet")}</Empty>}
          <div className="mt-4 rounded-xl border border-tint-100 bg-tint-50 p-4">
            <div className="mb-1 flex min-h-8 items-center justify-between gap-3">
              <span className="text-sm font-semibold text-tint-ink">{t("week.ai")}</span>
              {status.llm.enabled ? (
                <Button variant="outline" size="sm" onClick={summarize} disabled={summarizing}>
                  <Sparkles strokeWidth={1.75} />
                  {summarizing ? t("week.thinking") : report.summary ? t("week.regenerate") : t("week.generate")}
                </Button>
              ) : (
                <button type="button" className="text-[0.8125rem] font-medium text-tint-ink underline-offset-2 hover:underline" onClick={onOpenModel}>{t("week.ai_off")}</button>
              )}
            </div>
            {report.summary ? <MiniMarkdown text={report.summary} /> : (
              <p className="text-[0.8125rem] text-muted-foreground">{mode === "week" ? t("week.ai_pending") : mode === "custom" ? t("period.ai_between", { range: currentRange }) : t("period.ai_pending")}</p>
            )}
          </div>
        </Card>
      </div>

      <div className={cn("grid gap-4", mode === "week" ? "grid-cols-[minmax(0,7fr)_minmax(0,5fr)] max-[1000px]:grid-cols-1" : "grid-cols-1")}>
        <Card title={t("week.launches")} aside={<Aside>{t("week.launch_aside")}</Aside>}>
          {report.launches.length ? (
            <ul className="flex flex-col">
              {report.launches.map((l) => (
                <li key={l.id} className="border-b border-rule last:border-0">
                  <button type="button" onClick={() => onOpenVideo(l.id)}
                    className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-ring">
                    <span className="truncate font-medium group-hover:text-tint-ink">{l.title}</span>
                    <span className="num row-span-2 flex items-center gap-2 text-right">
                      <span className="flex flex-col items-end leading-tight">
                        <strong className="font-semibold">{num(l.views, locale)}</strong>
                        <span className="text-xs text-muted-foreground">{t("week.vs_baseline", { baseline: l.baseline != null ? num(Math.round(l.baseline), locale) : t("empty.none") })}</span>
                      </span>
                      {l.ratio != null && <Pill tone={l.ratio >= 1 ? "good" : "bad"} className="num">{num(l.ratio, locale)}×</Pill>}
                    </span>
                    <span className="text-[0.8125rem] text-muted-foreground">{t("week.published", {
                      date: day(l.published_at, locale),
                      days: l.days,
                      unit: l.days === 1 ? t("week.day") : t("week.days"),
                    })}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <Empty>{mode === "custom" ? t("period.no_launches.between", { previous: previousRange, current: currentRange }) : label("no_launches")}</Empty>}
        </Card>

        {mode === "week" && (
          <Card title={t("week.searches")}>
            {report.search_terms.length ? (
              <div className="flex flex-wrap gap-1.5">
                {report.search_terms.slice(0, 14).map((s) => (
                  <span key={s.term} title={t("week.search_tip", { count: num(s.views, locale) })}
                    className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem]", s.is_new ? "bg-tint-100 text-tint-ink" : "bg-muted")}>
                    {s.term}
                    <span className={cn("num", s.is_new ? "text-tint-ink" : "text-muted-foreground")}>{short(s.views, locale)}</span>
                    {s.is_new && <span className="font-medium">· {t("delta.new")}</span>}
                  </span>
                ))}
              </div>
            ) : <Empty>{t("week.no_searches")}</Empty>}
          </Card>
        )}
      </div>

      <Card title={mode === "custom" ? t("period.videos.between", { range: currentRange }) : label("videos")} aside={<Aside>{t("week.median_aside", { count: num(report.median_week_views, locale) })}</Aside>}>
        <div className="-mx-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44%]">{t("col.video")}</TableHead>
                <TableHead className="text-right">{t("col.views")}</TableHead>
                <TableHead className="text-right">{t("col.before")}</TableHead>
                <TableHead className="text-right">{t("col.change")}</TableHead>
                <TableHead className="text-right">{t("col.vs_median")}</TableHead>
                <TableHead className="text-right">{t("col.hours")}</TableHead>
                <TableHead className="text-right">{t("col.subs")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(allVideos ? report.videos : report.videos.slice(0, 10)).map((v) => (
                <TableRow key={v.id} onClick={() => onOpenVideo(v.id)} className="cursor-pointer">
                  <TableCell className="max-w-[460px] max-[620px]:max-w-[200px]">
                    <span className="flex min-w-0 items-center">
                      <span className="min-w-0 truncate">{v.title}</span>
                      <Flag flag={v.flag} />
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">{num(v.views, locale)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{num(v.previous, locale)}</TableCell>
                  <TableCell className="text-right"><Delta value={v.delta_pct} /></TableCell>
                  <TableCell className="text-right">{v.ratio_vs_median != null ? `${num(v.ratio_vs_median, locale)}×` : <Dash />}</TableCell>
                  <TableCell className="text-right">{num(v.watch_hours, locale)}</TableCell>
                  <TableCell className="text-right">{num(v.subs, locale)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {report.videos.length > 10 && (
          <button type="button" onClick={() => setAllVideos(!allVideos)}
            className="mt-3 text-sm font-medium text-tint-ink hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            {allVideos ? t("week.show_less") : t("week.show_all", { count: report.videos.length })}
          </button>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4 max-[1000px]:grid-cols-1">
        <Card title={t("week.traffic")}>
          <div className="grid grid-cols-[minmax(110px,1.3fr)_minmax(60px,1fr)_52px_64px_60px] items-center gap-x-3 text-sm max-[620px]:grid-cols-[minmax(0,1fr)_52px_64px]">
            <span className="pb-2 text-xs text-muted-foreground">{t("col.source")}</span>
            <span className="pb-2 max-[620px]:hidden" />
            <span className="pb-2 text-right text-xs text-muted-foreground">{t("col.share")}</span>
            <span className="pb-2 text-right text-xs text-muted-foreground">{t("col.views")}</span>
            <span className="pb-2 text-right text-xs text-muted-foreground max-[620px]:hidden">{t("col.change")}</span>
            {report.traffic.filter((row) => row.current || row.previous).map((row) => (
              <div className="contents" key={row.source} title={t("week.traffic_tip", {
                label: row.label,
                current: num(row.current, locale),
                previous: num(row.previous, locale),
              })}>
                <span className="truncate border-t border-rule py-2.5">{row.label}</span>
                <span className="flex h-full items-center border-t border-rule max-[620px]:hidden">
                  <span className="block h-1.5 w-full overflow-hidden rounded-full bg-tint-100">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.share)}%` }} />
                  </span>
                </span>
                <span className="num border-t border-rule py-2.5 text-right text-muted-foreground">{num(row.share, locale)}%</span>
                <span className="num border-t border-rule py-2.5 text-right">{num(row.current, locale)}</span>
                <span className="border-t border-rule py-2.5 text-right max-[620px]:hidden"><Delta value={row.delta_pct} /></span>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t("week.reach")}
          aside={report.reach ? <Aside>{t("week.reach_aside", {
            range: range(report.reach.period_start, report.reach.period_end, locale),
            ctr: report.reach.median_ctr != null ? num(report.reach.median_ctr, locale) : t("empty.none"),
          })}</Aside> : null}>
          {report.reach ? (
            <div className="-mx-2">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>{t("col.video")}</TableHead><TableHead className="text-right">{t("col.impressions")}</TableHead><TableHead className="text-right">{t("col.ctr")}</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {reachRows.map((r) => {
                    const low = report.reach!.median_ctr != null && r.ctr != null && r.ctr < report.reach!.median_ctr * 0.7 && r.impressions >= 1000;
                    return (
                      <TableRow key={r.video_id} onClick={() => onOpenVideo(r.video_id)} className="cursor-pointer">
                        <TableCell className="max-w-[320px]">
                          <span className="flex min-w-0 items-center">
                            <span className="min-w-0 truncate">{r.title}</span>
                            {low && <Pill tone="bad" className="ml-2">{t("flag.low_ctr")}</Pill>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{num(r.impressions, locale)}</TableCell>
                        <TableCell className={cn("text-right", low && "font-medium text-critical")}>{r.ctr != null ? `${num(r.ctr, locale)}%` : <Dash />}</TableCell>
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
    </div>
  );
}

function Swatch({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return (
    <svg width="16" height="8" aria-hidden>
      <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth={dashed ? 1.5 : 2} strokeDasharray={dashed ? "4 3" : undefined} />
    </svg>
  );
}

function Dash() {
  return <span className="text-muted-foreground">–</span>;
}

function monthLabel(iso: string, locale: Locale) {
  const [y, m] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(intlTag(locale), { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));
}

function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function monthEnd(start: string) {
  const [y, m] = start.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return addDays(next, -1);
}

function shiftMonth(start: string, delta: number) {
  const [y, m] = start.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 10);
}

function shiftYear(start: string, delta: number) {
  return `${Number(start.slice(0, 4)) + delta}-01-01`;
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
