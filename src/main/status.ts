import type Database from "better-sqlite3";
import { isCalendarWeek, isDemo, type Report, availableWeeks, buildRange, buildReport, dataRange } from "./report";
import { AppError } from "./errors";
import { translate, type Locale } from "../shared/i18n";

export type Channel = {
  id: string;
  title: string;
  thumbnail: string | null;
  subscribers: number;
  views: number;
  video_count: number;
};

export type SyncRow = {
  started_at: string;
  finished_at: string | null;
  status: string;
  detail: string | null;
};

export type Status = {
  configured: boolean;
  connected: boolean;
  demo: boolean;
  channel: Channel | null;
  videos: number;
  data_range: { from: string; to: string } | null;
  last_sync: SyncRow | null;
  syncing: boolean;
  next_sync: string | null;
  llm: { provider: string; enabled: boolean };
};

export type Runtime = {
  configured: boolean;
  connected: boolean;
  syncing: boolean;
  nextSync: string | null;
  llm: { provider: string; enabled: boolean };
};

export function getStatus(db: Database.Database, runtime: Runtime): Status {
  const ch = db.prepare("SELECT * FROM channel LIMIT 1").get() as Channel | undefined;
  const last = db
    .prepare("SELECT started_at, finished_at, status, detail FROM sync_log ORDER BY id DESC LIMIT 1")
    .get() as SyncRow | undefined;
  const n = db.prepare("SELECT COUNT(*) AS n FROM videos").get() as { n: number };
  const rng = dataRange(db);
  return {
    configured: runtime.configured,
    connected: runtime.connected,
    demo: isDemo(db),
    channel: ch ?? null,
    videos: n.n,
    data_range: rng ? { from: rng[0], to: rng[1] } : null,
    last_sync: last ?? null,
    syncing: runtime.syncing,
    next_sync: runtime.nextSync,
    llm: runtime.llm,
  };
}

export function getWeeks(db: Database.Database): string[] {
  return availableWeeks(db);
}

function withSavedSummary(db: Database.Database, report: Report): Report {
  if (!isCalendarWeek(report.week.start, report.week.end)) return report;
  const saved = db.prepare("SELECT summary FROM reports WHERE week_start=?").get(report.week.start) as
    | { summary: string | null }
    | undefined;
  report.summary = saved?.summary ?? null;
  return report;
}

export function getReport(db: Database.Database, week?: string | null, locale: Locale = "en"): Report {
  const report = buildReport(db, week, locale);
  if (!report) throw new AppError(translate(locale, "error.no_data"), 404);
  return withSavedSummary(db, report);
}

export function getRangeReport(db: Database.Database, start: string, end: string, locale: Locale = "en"): Report {
  const report = buildRange(db, start, end, locale);
  if (!report) throw new AppError(translate(locale, "error.no_data"), 404);
  return withSavedSummary(db, report);
}
