import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CountingNumber } from "@/components/animate-ui/primitives/texts/counting-number";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import { Button } from "@/components/animate-ui/components/buttons/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Report, type Status } from "../api";
import RangeCalendar from "../components/RangeCalendar";
import { Card, Delta, Empty, Flag, MiniMarkdown } from "../components/ui";
import type { MessageKey } from "../../../shared/i18n";
import { day, num, range, secs, short } from "../format";
import { useI18n } from "../i18n";
import { fadeIn, revealOnce } from "../motion";

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

  useEffect(() => {
    if (page.current) fadeIn(page.current);
  }, [mode, report?.week.start, report?.week.end]);

  useLayoutEffect(() => {
    const root = page.current;
    if (!root) return;
    const cards = [...root.querySelectorAll<HTMLElement>("section")];
    const unseen = cards.filter((card) => card.dataset.revealed !== "1");
    unseen.forEach((card) => { card.style.opacity = "0"; });
    const scroller = root.closest(".overflow-auto");
    const show = (card: HTMLElement, delay: number) => {
      if (card.dataset.revealed === "1") return;
      card.dataset.revealed = "1";
      revealOnce(card, delay);
    };
    const revealPassed = () => {
      const edge = (scroller instanceof HTMLElement ? scroller : document.documentElement).getBoundingClientRect().bottom;
      unseen.forEach((card, index) => {
        if (card.getBoundingClientRect().top < edge) show(card, index * 50);
      });
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        show(entry.target as HTMLElement, unseen.indexOf(entry.target as HTMLElement) * 50);
        io.unobserve(entry.target);
      });
    }, { root: scroller instanceof HTMLElement ? scroller : null, threshold: 0.15 });
    unseen.forEach((card) => io.observe(card));
    revealPassed();
    scroller?.addEventListener("scroll", revealPassed, { passive: true });
    return () => {
      io.disconnect();
      scroller?.removeEventListener("scroll", revealPassed);
    };
  }, [report?.week.start, report?.week.end]);

  if (error && !report) return <Empty>{error}</Empty>;
  if (!weeks.length && !report) return <Empty>{t("week.empty")}</Empty>;
  if (!report) return <div className="p-12 text-center text-muted-foreground">{t("week.loading")}</div>;

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

  return (
    <div ref={page} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3.5">
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
              onClick={() => setWeek(weeks[idx + 1])} aria-label={label("nav_previous")}>‹</Button>
            <Select value={report.week.start} onValueChange={setWeek}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {weeks.map((w, i) => (
                  <SelectItem key={w} value={w}>
                    {i === 0 ? t("week.latest_prefix") : ""}{range(w, addDays(w, 6), locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" disabled={idx <= 0}
              onClick={() => setWeek(weeks[idx - 1])} aria-label={label("nav_next")}>›</Button>
          </div>
        )}
        {mode === "month" && anchor && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => setAnchor(shiftMonth(anchor, -1))} aria-label={label("nav_previous")}>‹</Button>
            <span className="text-sm">{anchor.slice(0, 7)}</span>
            <Button variant="outline" size="icon" onClick={() => setAnchor(shiftMonth(anchor, 1))} aria-label={label("nav_next")}>›</Button>
          </div>
        )}
        {mode === "year" && anchor && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => setAnchor(shiftYear(anchor, -1))} aria-label={label("nav_previous")}>‹</Button>
            <span className="text-sm">{anchor.slice(0, 4)}</span>
            <Button variant="outline" size="icon" onClick={() => setAnchor(shiftYear(anchor, 1))} aria-label={label("nav_next")}>›</Button>
          </div>
        )}
        {mode === "custom" && (
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
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
              {k.unit === "secs" ? secs(k.current, locale) : <CountingNumber number={k.current} format={(value) => num(Math.round(value), locale)} />}
            </span>
            <span className="flex flex-wrap items-baseline gap-2 text-xs">
              <Delta value={k.delta_pct} />
              <span className="text-muted-foreground">{t("col.before").toLowerCase()} {k.unit === "secs" ? secs(k.previous, locale) : num(k.previous, locale)}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 max-[1000px]:grid-cols-1">
        <Card title={mode === "custom" ? t("period.what.between", { range: currentRange }) : label("what")}>
          {report.insights.length ? (
            <ul className="flex list-disc flex-col gap-2 pl-4 text-sm marker:text-primary">
              {report.insights.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          ) : <Empty>{mode === "custom" ? t("period.quiet.between", { range: currentRange }) : label("quiet")}</Empty>}
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
              <p className="text-[0.82rem] text-muted-foreground">{mode === "week" ? t("week.ai_pending") : mode === "custom" ? t("period.ai_between", { range: currentRange }) : t("period.ai_pending")}</p>
            )}
          </div>
        </Card>

        <Card title={t(spanDays > 62 ? "period.views_by_week" : "week.views_by_day")} aside={<span className="text-[0.82rem] text-muted-foreground">{mode === "custom" ? t("period.vs_dates", { current: currentRange, previous: previousRange }) : label("vs_chart")}</span>}>
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
                <Line name={mode === "custom" ? previousRange : label("series_previous")} dataKey="previous" stroke="var(--prev)" strokeWidth={2}
                  strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
                <Line name={mode === "custom" ? currentRange : label("series_current")} dataKey="current" stroke="var(--series-1)" strokeWidth={2}
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
                <span className="text-muted-foreground"> {t("week.vs_baseline", { baseline: l.baseline != null ? num(Math.round(l.baseline), locale) : t("empty.none") })}</span>
                {l.ratio != null && (
                  <span className={`ml-1.5 rounded-md px-1.5 font-mono text-sm font-semibold ${l.ratio >= 1 ? "bg-good/15 text-good" : "bg-critical/15 text-critical"}`}>{num(l.ratio, locale)}x</span>
                )}
              </span>
            </button>
          )) : <Empty>{mode === "custom" ? t("period.no_launches.between", { previous: previousRange, current: currentRange }) : label("no_launches")}</Empty>}

          {mode === "week" && (
            <>
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
            </>
          )}
        </Card>
      </div>

      <Card title={mode === "custom" ? t("period.videos.between", { range: currentRange }) : label("videos")} aside={<span className="text-[0.82rem] text-muted-foreground">{t("week.median_aside", { count: num(report.median_week_views, locale) })}</span>}>
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
                  <TableCell className="text-right font-mono text-sm tabular-nums">{v.ratio_vs_median != null ? `${num(v.ratio_vs_median, locale)}x` : t("empty.none")}</TableCell>
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
          ctr: report.reach.median_ctr != null ? num(report.reach.median_ctr, locale) : t("empty.none"),
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
                      <TableCell className="text-right font-mono text-sm tabular-nums">{r.ctr != null ? `${num(r.ctr, locale)}%` : t("empty.none")}</TableCell>
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
