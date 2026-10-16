import type Database from "better-sqlite3";
import { addDays } from "./dates";
import { AppError } from "./errors";
import { dataRange, pct } from "./report";
import { translate, type Locale } from "../shared/i18n";

export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function assertVideoId(id: string, locale: Locale): void {
  if (!VIDEO_ID.test(id)) throw new AppError(translate(locale, "error.bad_video_id"));
}

export type VideoRow = {
  id: string;
  title: string;
  published_at: string;
  duration_s: number;
  thumbnail: string | null;
  views: number;
  likes: number;
  comments: number;
  last7: number;
  prev7: number;
  delta_pct: number | null;
  ctr: number | null;
  impressions: number | null;
};

export function listVideos(db: Database.Database): VideoRow[] {
  const rng = dataRange(db);
  const today = new Date().toISOString().slice(0, 10);
  const last = rng ? rng[1] : today;
  const w1s = addDays(last, -6);
  const w0s = addDays(last, -13);
  const w0e = addDays(last, -7);
  const rows = db
    .prepare(
      `SELECT v.*,
        (SELECT COALESCE(SUM(views),0) FROM video_daily d WHERE d.video_id=v.id AND d.date BETWEEN ? AND ?) AS last7,
        (SELECT COALESCE(SUM(views),0) FROM video_daily d WHERE d.video_id=v.id AND d.date BETWEEN ? AND ?) AS prev7,
        (SELECT ctr FROM reach r WHERE r.video_id=v.id ORDER BY period_end DESC LIMIT 1) AS ctr,
        (SELECT impressions FROM reach r WHERE r.video_id=v.id ORDER BY period_end DESC LIMIT 1) AS impressions
       FROM videos v ORDER BY published_at DESC`,
    )
    .all(w1s, last, w0s, w0e) as VideoRow[];
  return rows.map((row) => ({ ...row, delta_pct: pct(row.last7, row.prev7) }));
}

export function videoDetail(db: Database.Database, videoId: string, locale: Locale, days = 90) {
  assertVideoId(videoId, locale);
  const video = db.prepare("SELECT * FROM videos WHERE id=?").get(videoId) as VideoRow | undefined;
  if (!video) throw new AppError(translate(locale, "error.video_missing"), 404);
  const rng = dataRange(db);
  const end = rng ? rng[1] : new Date().toISOString().slice(0, 10);
  const start = addDays(end, -(days - 1));
  const daily = db
    .prepare(
      "SELECT date, views, subs_gained FROM video_daily WHERE video_id=? AND date BETWEEN ? AND ? ORDER BY date",
    )
    .all(videoId, start, end) as { date: string; views: number; subs_gained: number }[];
  const retention = db
    .prepare("SELECT ratio, watch_ratio, relative_perf FROM retention WHERE video_id=? ORDER BY ratio")
    .all(videoId) as { ratio: number; watch_ratio: number; relative_perf: number }[];
  const reach = db
    .prepare("SELECT period_start, period_end, impressions, ctr FROM reach WHERE video_id=? ORDER BY period_end")
    .all(videoId) as { period_start: string; period_end: string; impressions: number; ctr: number | null }[];
  const byDate = new Map(daily.map((row) => [row.date, row]));
  const series = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const row = byDate.get(cursor);
    series.push({ date: cursor, views: row?.views ?? 0, subs: row?.subs_gained ?? 0 });
  }
  return { video, daily: series, retention, reach };
}
