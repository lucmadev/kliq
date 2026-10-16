/** Weekly report: Monday–Sunday versus the previous week, entirely from SQLite. */
import type Database from "better-sqlite3";
import { addDays, lastCompleteWeekStart, parse, weekStartOf } from "./dates";
import { kvGet, nowIso } from "./db";
import { formatCount, trafficLabel, translate, type Locale, type MessageKey } from "../shared/i18n";

export type Kpi = {
  key: string;
  label: string;
  unit: "num" | "secs";
  current: number;
  previous: number;
  delta_pct: number | null;
};

export type TrafficRow = {
  source: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  delta_pct: number | null;
  share: number;
};

export type VideoWeek = {
  id: string;
  title: string;
  thumbnail: string | null;
  published_at: string | null;
  duration_s?: number | null;
  views: number;
  previous: number;
  delta_pct: number | null;
  watch_hours: number;
  subs: number;
  ratio_vs_median: number | null;
  flag: "new" | "outlier" | "rising" | "falling" | null;
};

export type Launch = {
  id: string;
  title: string;
  thumbnail?: string | null;
  published_at: string;
  days: number;
  views: number;
  baseline: number | null;
  ratio: number | null;
};

export type Reach = {
  period_start: string;
  period_end: string;
  median_ctr: number | null;
  rows: { video_id: string; title: string; impressions: number; ctr: number | null }[];
};

export type Report = {
  week: { start: string; end: string };
  previous_week: { start: string; end: string };
  data_through: string;
  complete: boolean;
  kpis: Kpi[];
  daily: { day: string; date: string; current: number | null; previous: number | null }[];
  traffic: TrafficRow[];
  videos: VideoWeek[];
  median_week_views: number;
  launches: Launch[];
  search_terms: { term: string; views: number; previous: number | null; is_new: boolean }[];
  reach: Reach | null;
  insights: string[];
  summary?: string | null;
};

type Summarizer = {
  enabled: () => boolean;
  summarize: (report: Report) => Promise<string>;
};

let summarizer: Summarizer = {
  enabled: () => false,
  summarize: async () => {
    throw new Error("AI is off");
  },
};

export function setSummarizer(next: Summarizer): void {
  summarizer = next;
}

export function llmEnabled(): boolean {
  return summarizer.enabled();
}

function round(n: number, digits = 0): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

export function pct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return round(((cur - prev) / prev) * 100, 1);
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function dataRange(db: Database.Database): [string, string] | null {
  const r = db.prepare("SELECT MIN(date) AS a, MAX(date) AS b FROM channel_daily").get() as {
    a: string | null;
    b: string | null;
  };
  if (!r?.b || !r.a) return null;
  return [parse(r.a), parse(r.b)];
}

export function availableWeeks(db: Database.Database): string[] {
  const rng = dataRange(db);
  if (!rng) return [];
  const [first, last] = rng;
  let ws = lastCompleteWeekStart(last);
  const floor = weekStartOf(first);
  const out: string[] = [];
  while (addDays(ws, -7) >= floor) {
    out.push(ws);
    ws = addDays(ws, -7);
  }
  return out;
}

type Totals = {
  views: number;
  watch_hours: number;
  net_subs: number;
  avg_view_duration: number;
  engagement: number;
  subs_per_1k: number;
};

function channelTotals(db: Database.Database, start: string, end: string): Totals {
  const r = db
    .prepare(
      `SELECT COALESCE(SUM(views),0) AS views, COALESCE(SUM(watch_minutes),0) AS wm,
              COALESCE(SUM(subs_gained),0) AS sg, COALESCE(SUM(subs_lost),0) AS sl,
              COALESCE(SUM(likes),0)+COALESCE(SUM(comments),0)+COALESCE(SUM(shares),0) AS eng
       FROM channel_daily WHERE date BETWEEN ? AND ?`,
    )
    .get(start, end) as { views: number; wm: number; sg: number; sl: number; eng: number };
  const views = r.views;
  return {
    views,
    watch_hours: round(r.wm / 60, 1),
    net_subs: r.sg - r.sl,
    avg_view_duration: views ? Math.round((r.wm * 60) / views) : 0,
    engagement: r.eng,
    subs_per_1k: views ? round(((r.sg - r.sl) / views) * 1000, 2) : 0,
  };
}

function videoWeek(db: Database.Database, start: string, end: string): Map<string, { views: number; wm: number; subs: number }> {
  const rows = db
    .prepare(
      `SELECT video_id, SUM(views) AS views, SUM(watch_minutes) AS wm, SUM(subs_gained) AS subs
       FROM video_daily WHERE date BETWEEN ? AND ? GROUP BY video_id`,
    )
    .all(start, end) as { video_id: string; views: number; wm: number | null; subs: number | null }[];
  return new Map(rows.map((r) => [r.video_id, { views: r.views, wm: r.wm ?? 0, subs: r.subs ?? 0 }]));
}

function trafficWeek(db: Database.Database, start: string, end: string): Map<string, number> {
  const rows = db
    .prepare("SELECT source, SUM(views) AS v FROM traffic_daily WHERE date BETWEEN ? AND ? GROUP BY source")
    .all(start, end) as { source: string; v: number }[];
  return new Map(rows.map((r) => [r.source, r.v]));
}

function firstDays(db: Database.Database, videoId: string, published: string, days: number): number {
  const r = db
    .prepare("SELECT COALESCE(SUM(views),0) AS v FROM video_daily WHERE video_id=? AND date BETWEEN ? AND ?")
    .get(videoId, published, addDays(published, days - 1)) as { v: number };
  return r.v;
}

type VideoMeta = {
  id: string;
  title: string;
  published_at: string | null;
  thumbnail: string | null;
  duration_s: number | null;
};

export function buildReport(db: Database.Database, weekStart?: string | null, locale: Locale = "en"): Report | null {
  const rng = dataRange(db);
  if (!rng) return null;
  const [firstDate, lastDate] = rng;
  const ws = weekStartOf(weekStart ? parse(weekStart) : lastCompleteWeekStart(lastDate));
  const we = addDays(ws, 6);
  const ps = addDays(ws, -7);
  const pe = addDays(ws, -1);

  const cur = channelTotals(db, ws, we);
  const prev = channelTotals(db, ps, pe);
  const kpiDefs: [keyof Totals, MessageKey, "num" | "secs"][] = [
    ["views", "kpi.views", "num"],
    ["watch_hours", "kpi.watch_hours", "num"],
    ["net_subs", "kpi.net_subs", "num"],
    ["avg_view_duration", "kpi.avg_view_duration", "secs"],
    ["subs_per_1k", "kpi.subs_per_1k", "num"],
    ["engagement", "kpi.engagement", "num"],
  ];
  const kpis: Kpi[] = kpiDefs.map(([k, label, unit]) => ({
    key: k,
    label: translate(locale, label),
    unit,
    current: cur[k],
    previous: prev[k],
    delta_pct: pct(cur[k], prev[k]),
  }));

  const dailyMap = (s: string, e: string) => {
    const rows = db
      .prepare("SELECT date, views, watch_minutes FROM channel_daily WHERE date BETWEEN ? AND ?")
      .all(s, e) as { date: string; views: number }[];
    return new Map(rows.map((r) => [r.date, r]));
  };
  const dc = dailyMap(ws, we);
  const dp = dailyMap(ps, pe);
  const daily = [];
  for (let i = 0; i < 7; i++) {
    const dCur = addDays(ws, i);
    const dPrev = addDays(ps, i);
    daily.push({
      day: translate(locale, `weekday.${i}` as MessageKey),
      date: dCur,
      current: dc.get(dCur)?.views ?? null,
      previous: dp.get(dPrev)?.views ?? null,
    });
  }

  const tc = trafficWeek(db, ws, we);
  const tp = trafficWeek(db, ps, pe);
  const totalTc = [...tc.values()].reduce((a, b) => a + b, 0) || 1;
  const sources = new Set([...tc.keys(), ...tp.keys()]);
  const traffic: TrafficRow[] = [...sources]
    .map((s) => {
      const current = tc.get(s) ?? 0;
      const previous = tp.get(s) ?? 0;
      return {
        source: s,
        label: trafficLabel(locale, s),
        current,
        previous,
        delta: current - previous,
        delta_pct: pct(current, previous),
        share: round((current / totalTc) * 100, 1),
      };
    })
    .sort((a, b) => b.current - a.current);

  const metaRows = db.prepare("SELECT * FROM videos").all() as VideoMeta[];
  const meta = new Map(metaRows.map((r) => [r.id, r]));
  const vc = videoWeek(db, ws, we);
  const vp = videoWeek(db, ps, pe);
  const weekViews = [...vc.values()].map((v) => v.views).filter((v) => v > 0);
  const med = weekViews.length ? median(weekViews) : 0;
  const videos: VideoWeek[] = [];
  for (const [vid, v] of vc) {
    const m = meta.get(vid);
    const prevViews = vp.get(vid)?.views ?? 0;
    const published = m?.published_at ? parse(m.published_at) : null;
    const ratio = med ? round(v.views / med, 1) : null;
    const delta = pct(v.views, prevViews);
    let flag: VideoWeek["flag"] = null;
    if (published && ws <= published && published <= we) flag = "new";
    else if (ratio && ratio >= 3 && v.views >= 50) flag = "outlier";
    else if (delta != null && delta >= 50 && prevViews >= 20) flag = "rising";
    else if (delta != null && delta <= -40 && prevViews >= 50) flag = "falling";
    videos.push({
      id: vid,
      title: m?.title ?? vid,
      thumbnail: m?.thumbnail ?? null,
      published_at: m?.published_at ?? null,
      duration_s: m?.duration_s ?? null,
      views: v.views,
      previous: prevViews,
      delta_pct: delta,
      watch_hours: round((v.wm || 0) / 60, 1),
      subs: v.subs || 0,
      ratio_vs_median: ratio,
      flag,
    });
  }
  videos.sort((a, b) => b.views - a.views);

  const uploads = metaRows.filter((m) => m.published_at).sort((a, b) => (a.published_at! < b.published_at! ? -1 : 1));
  const launches: Launch[] = [];
  uploads.forEach((m, i) => {
    const pub = parse(m.published_at!);
    if (pub < ps || pub > we) return;
    const days = Math.min(7, daysBetween(pub, lastDate) + 1);
    if (days <= 0) return;
    const got = firstDays(db, m.id, pub, days);
    const baselineVals = uploads
      .slice(Math.max(0, i - 10), i)
      .filter((b) => parse(b.published_at!) >= firstDate)
      .map((b) => firstDays(db, b.id, parse(b.published_at!), days));
    const base = baselineVals.length ? median(baselineVals) : null;
    launches.push({
      id: m.id,
      title: m.title,
      thumbnail: m.thumbnail,
      published_at: m.published_at!,
      days,
      views: got,
      baseline: base,
      ratio: base ? round(got / base, 2) : null,
    });
  });

  const stCur = db
    .prepare("SELECT term, views FROM search_terms WHERE week_start=? ORDER BY views DESC")
    .all(ws) as { term: string; views: number }[];
  const stPrevRows = db.prepare("SELECT term, views FROM search_terms WHERE week_start=?").all(ps) as {
    term: string;
    views: number;
  }[];
  const stPrev = new Map(stPrevRows.map((r) => [r.term, r.views]));
  const searchTerms = stCur.map((r) => ({
    term: r.term,
    views: r.views,
    previous: stPrev.get(r.term) ?? null,
    is_new: !stPrev.has(r.term),
  }));

  const reach = latestReach(db, meta);
  const report: Report = {
    week: { start: ws, end: we },
    previous_week: { start: ps, end: pe },
    data_through: lastDate,
    complete: we <= lastDate,
    kpis,
    daily,
    traffic,
    videos: videos.slice(0, 25),
    median_week_views: med,
    launches,
    search_terms: searchTerms,
    reach,
    insights: [],
  };
  report.insights = buildInsights(report, locale);
  return report;
}

function daysBetween(a: string, b: string): number {
  const ms = utcMs(b) - utcMs(a);
  return Math.round(ms / 86400000);
}

function utcMs(iso: string): number {
  const [y, m, d] = parse(iso).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function latestReach(db: Database.Database, meta?: Map<string, { title?: string }>): Reach | null {
  const p = db
    .prepare("SELECT period_start, period_end FROM reach ORDER BY period_end DESC, period_start DESC LIMIT 1")
    .get() as { period_start: string; period_end: string } | undefined;
  if (!p) return null;
  const titles =
    meta ??
    new Map(
      (db.prepare("SELECT id, title FROM videos").all() as { id: string; title: string }[]).map((r) => [r.id, r]),
    );
  const rows = db
    .prepare(
      "SELECT video_id, impressions, ctr FROM reach WHERE period_start=? AND period_end=? ORDER BY impressions DESC",
    )
    .all(p.period_start, p.period_end) as { video_id: string; impressions: number; ctr: number | null }[];
  const ctrs = rows.filter((r) => r.ctr != null && r.impressions >= 100).map((r) => r.ctr as number);
  const medCtr = ctrs.length ? round(median(ctrs), 2) : null;
  return {
    period_start: p.period_start,
    period_end: p.period_end,
    median_ctr: medCtr,
    rows: rows.slice(0, 20).map((r) => ({
      video_id: r.video_id,
      title: titles.get(r.video_id)?.title ?? r.video_id,
      impressions: r.impressions,
      ctr: r.ctr,
    })),
  };
}

function fmt(locale: Locale, n: number, digits = 0): string {
  return formatCount(locale, n, digits);
}

function sp(locale: Locale, n: number): string {
  return (n > 0 ? "+" : "") + fmt(locale, n, 1) + "%";
}

export function buildInsights(r: Report, locale: Locale = "en"): string[] {
  const out: string[] = [];
  const k = new Map(r.kpis.map((x) => [x.key, x]));
  const views = k.get("views")!;
  if (views.delta_pct != null) {
    out.push(
      translate(locale, views.delta_pct >= 0 ? "insight.views_up" : "insight.views_down", {
        pct: fmt(locale, Math.abs(views.delta_pct), 1),
        previous: fmt(locale, views.previous),
        current: fmt(locale, views.current),
      }),
    );
  }

  const movers = [...r.traffic].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (movers.length && Math.abs(movers[0].delta) >= 20) {
    const t = movers[0];
    const sign = t.delta >= 0 ? "+" : "−";
    out.push(
      translate(locale, t.delta_pct != null ? "insight.traffic" : "insight.traffic_new", {
        label: t.label,
        sign,
        delta: fmt(locale, Math.abs(t.delta)),
        pct: t.delta_pct != null ? sp(locale, t.delta_pct) : "",
      }),
    );
  }

  for (const vid of r.videos.filter((x) => x.flag === "outlier").slice(0, 2)) {
    out.push(translate(locale, "insight.outlier", { title: vid.title, ratio: fmt(locale, vid.ratio_vs_median ?? 0, 1) }));
  }
  for (const vid of r.videos.filter((x) => x.flag === "rising").slice(0, 2)) {
    out.push(translate(locale, "insight.rising", { title: vid.title, pct: sp(locale, vid.delta_pct ?? 0) }));
  }
  for (const vid of r.videos.filter((x) => x.flag === "falling").slice(0, 1)) {
    out.push(translate(locale, "insight.falling", { title: vid.title, pct: sp(locale, vid.delta_pct ?? 0) }));
  }

  for (const l of r.launches) {
    if (l.ratio == null) continue;
    out.push(
      translate(locale, l.ratio >= 1 ? "insight.launch_above" : "insight.launch_below", {
        title: l.title,
        views: fmt(locale, l.views),
        days: l.days,
        ratio: fmt(locale, l.ratio, 2),
      }),
    );
  }

  const avd = k.get("avg_view_duration")!;
  if (avd.delta_pct != null && Math.abs(avd.delta_pct) >= 10) {
    out.push(
      translate(locale, avd.delta_pct > 0 ? "insight.avd_up" : "insight.avd_down", {
        pct: fmt(locale, Math.abs(avd.delta_pct), 1),
      }),
    );
  }

  const conv = k.get("subs_per_1k")!;
  if (conv.previous && conv.delta_pct != null && Math.abs(conv.delta_pct) >= 25) {
    out.push(
      translate(locale, conv.delta_pct > 0 ? "insight.conv_up" : "insight.conv_down", {
        current: fmt(locale, conv.current, 2),
        previous: fmt(locale, conv.previous, 2),
      }),
    );
  }

  const newTerms = r.search_terms.filter((s) => s.is_new).slice(0, 3).map((s) => s.term);
  if (newTerms.length) {
    const quoted = newTerms.map((term) => `"${term}"`).join(", ");
    out.push(translate(locale, "insight.searches", { terms: quoted }));
  }

  const reach = r.reach;
  if (reach?.median_ctr) {
    const low = reach.rows
      .slice(0, 10)
      .filter((x) => x.ctr != null && x.impressions >= 1000 && x.ctr < reach.median_ctr! * 0.7);
    for (const x of low.slice(0, 2)) {
      out.push(
        translate(locale, "insight.low_ctr", {
          title: x.title,
          impressions: fmt(locale, x.impressions),
          ctr: fmt(locale, x.ctr ?? 0, 2),
          median: fmt(locale, reach.median_ctr, 2),
        }),
      );
    }
  }

  if (!r.complete) out.push(translate(locale, "insight.incomplete"));
  return out;
}

export function saveReport(db: Database.Database, report: Report, summary?: string | null): void {
  const existing = db.prepare("SELECT summary FROM reports WHERE week_start=?").get(report.week.start) as
    | { summary: string | null }
    | undefined;
  const kept = summary !== undefined && summary !== null ? summary : (existing?.summary ?? null);
  db.prepare("INSERT OR REPLACE INTO reports VALUES (?,?,?,?)").run(
    report.week.start,
    nowIso(),
    JSON.stringify(report),
    kept,
  );
}

export async function autoGenerateReports(db: Database.Database, locale: Locale = "en"): Promise<string[]> {
  const weeks = availableWeeks(db);
  if (!weeks.length) return [];
  const latest = weeks[0];
  const exists = db.prepare("SELECT 1 AS ok FROM reports WHERE week_start=?").get(latest);
  if (exists) return [];
  const report = buildReport(db, latest, locale);
  if (!report) return [];
  let summary: string | null = null;
  if (summarizer.enabled()) {
    try {
      summary = await summarizer.summarize(report);
    } catch (err) {
      console.error("could not generate the AI summary", err);
    }
  }
  saveReport(db, report, summary);
  return [latest];
}

export function isDemo(db: Database.Database): boolean {
  return kvGet(db, "demo") === "1";
}
