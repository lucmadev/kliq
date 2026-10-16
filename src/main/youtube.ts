/** Sync a channel from YouTube Data API v3 and YouTube Analytics API v2.

Data API cost per sync is about 1 + 2 * ceil(videos / 50) units.
A 300-video channel is about 13 of the 10,000 daily units. Analytics has a separate quota.
*/
import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import type Database from "better-sqlite3";
import { noteActiveChannel, prefsDatabase } from "./accounts";
import { loadClient } from "./auth";
import { addDays, daterange, lastCompleteWeekStart, parse } from "./dates";
import { kvGet, kvSet, nowIso } from "./db";
import { autoGenerateReports } from "./report";
import { loadSettings } from "./settings";
import { isLocale, translate, type Locale } from "../shared/i18n";
import { assertVideoId } from "./videos";

type Cell = string | number | boolean | null;
type AnalyticsRow = Record<string, Cell>;

let running = false;

export function isRunning(): boolean {
  return running;
}

export function parseDuration(iso: string | null | undefined): number {
  if (!iso) return 0;
  const match = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [d, h, m, s] = match.slice(1).map((part) => (part ? Number(part) : 0));
  return d * 86400 + h * 3600 + m * 60 + s;
}

function num(value: Cell | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function analyticsRows(data: { columnHeaders?: { name?: string | null }[]; rows?: unknown[][] | null }): AnalyticsRow[] {
  const headers = (data.columnHeaders ?? []).map((header) => header.name ?? "");
  return (data.rows ?? []).map((row) => {
    const record: AnalyticsRow = {};
    headers.forEach((name, index) => {
      record[name] = row[index] as Cell;
    });
    return record;
  });
}

async function queryAnalytics(
  auth: OAuth2Client,
  start: string,
  end: string,
  query: { metrics: string; dimensions?: string; sort?: string; filters?: string; maxResults?: number; startIndex?: number },
): Promise<AnalyticsRow[]> {
  const ya = google.youtubeAnalytics({ version: "v2", auth });
  const resp = await ya.reports.query({
    ids: "channel==MINE",
    startDate: start,
    endDate: end,
    ...query,
  });
  return analyticsRows(resp.data);
}

async function syncPublic(auth: OAuth2Client, db: Database.Database, locale: Locale): Promise<void> {
  const yt = google.youtube({ version: "v3", auth });
  const resp = await yt.channels.list({ part: ["snippet", "contentDetails", "statistics"], mine: true });
  const ch = resp.data.items?.[0];
  if (!ch?.id) throw new Error(translate(locale, "error.no_channel"));
  const stats = ch.statistics ?? {};
  db.prepare("INSERT OR REPLACE INTO channel VALUES (?,?,?,?,?,?,?)").run(
    ch.id,
    ch.snippet?.title ?? "",
    ch.snippet?.thumbnails?.default?.url ?? null,
    Number(stats.subscriberCount ?? 0),
    Number(stats.viewCount ?? 0),
    Number(stats.videoCount ?? 0),
    nowIso(),
  );

  const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
  const ids: string[] = [];
  let page: string | undefined;
  for (;;) {
    const playlist = await yt.playlistItems.list({
      part: ["contentDetails"],
      playlistId: uploads ?? "",
      maxResults: 50,
      pageToken: page,
    });
    for (const item of playlist.data.items ?? []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    page = playlist.data.nextPageToken ?? undefined;
    if (!page) break;
  }

  const today = new Date().toISOString().slice(0, 10);
  const insertVideo = db.prepare("INSERT OR REPLACE INTO videos VALUES (?,?,?,?,?,?,?,?,?)");
  const insertSnap = db.prepare("INSERT OR REPLACE INTO video_snapshots VALUES (?,?,?,?,?)");
  for (const chunk of chunks(ids, 50)) {
    const listed = await yt.videos.list({ part: ["snippet", "contentDetails", "statistics"], id: chunk });
    for (const video of listed.data.items ?? []) {
      if (!video.id) continue;
      const thumbs = video.snippet?.thumbnails;
      const views = Number(video.statistics?.viewCount ?? 0);
      const likes = Number(video.statistics?.likeCount ?? 0);
      const comments = Number(video.statistics?.commentCount ?? 0);
      insertVideo.run(
        video.id,
        video.snippet?.title ?? video.id,
        video.snippet?.publishedAt ?? null,
        parseDuration(video.contentDetails?.duration),
        thumbs?.medium?.url ?? thumbs?.default?.url ?? null,
        views,
        likes,
        comments,
        nowIso(),
      );
      insertSnap.run(today, video.id, views, likes, comments);
    }
  }
}

async function syncAnalytics(auth: OAuth2Client, db: Database.Database, start: string, end: string): Promise<void> {
  const channel = db.prepare("INSERT OR REPLACE INTO channel_daily VALUES (?,?,?,?,?,?,?,?,?)");
  for (const row of await queryAnalytics(auth, start, end, {
    metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares",
    dimensions: "day",
    sort: "day",
  })) {
    channel.run(
      row.day, num(row.views), num(row.estimatedMinutesWatched), num(row.averageViewDuration),
      num(row.subscribersGained), num(row.subscribersLost), num(row.likes), num(row.comments), num(row.shares),
    );
  }

  const traffic = db.prepare("INSERT OR REPLACE INTO traffic_daily VALUES (?,?,?,?)");
  for (const row of await queryAnalytics(auth, start, end, {
    metrics: "views,estimatedMinutesWatched",
    dimensions: "day,insightTrafficSourceType",
    sort: "day",
  })) {
    traffic.run(row.day, row.insightTrafficSourceType, num(row.views), num(row.estimatedMinutesWatched));
  }

  const daily = db.prepare("INSERT OR REPLACE INTO video_daily VALUES (?,?,?,?,?,?)");
  for (const day of daterange(start, end)) {
    for (const row of await queryAnalytics(auth, day, day, {
      metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained",
      dimensions: "video",
      sort: "-views",
      maxResults: 200,
    })) {
      daily.run(day, row.video, num(row.views), num(row.estimatedMinutesWatched), num(row.averageViewDuration), num(row.subscribersGained));
    }
  }

  const weekStart = lastCompleteWeekStart(end);
  const insertTerm = db.prepare("INSERT OR REPLACE INTO search_terms VALUES (?,?,?)");
  for (const week of [weekStart, addDays(weekStart, -7)]) {
    if (week < start) continue;
    const terms = await queryAnalytics(auth, week, addDays(week, 6), {
      metrics: "views",
      dimensions: "insightTrafficSourceDetail",
      filters: "insightTrafficSourceType==YT_SEARCH",
      sort: "-views",
      maxResults: 25,
    });
    db.prepare("DELETE FROM search_terms WHERE week_start = ?").run(week);
    for (const row of terms) insertTerm.run(week, row.insightTrafficSourceDetail, num(row.views));
  }
}

function asPercent(value: number): number {
  if (value > 0 && value <= 1) return value * 100;
  return value;
}

/** Impressions are stored per day so any selected range can sum them. A failure here does not abort the rest of the sync. */
export async function syncReach(auth: OAuth2Client, db: Database.Database, start: string, end: string): Promise<number> {
  const insert = db.prepare("INSERT OR REPLACE INTO reach_daily VALUES (?,?,?,?)");
  let startIndex = 1;
  let saved = 0;
  try {
    for (;;) {
      const rows = await queryAnalytics(auth, start, end, {
        metrics: "impressions,impressionClickThroughRate",
        dimensions: "day,video",
        sort: "day",
        maxResults: 200,
        startIndex,
      });
      if (!rows.length) break;
      for (const row of rows) {
        const video = String(row.video ?? "");
        if (!/^[A-Za-z0-9_-]{11}$/.test(video)) continue;
        const impressions = Math.round(num(row.impressions));
        insert.run(String(row.day), video, impressions, asPercent(num(row.impressionClickThroughRate)));
        saved += 1;
      }
      if (rows.length < 200) break;
      startIndex += rows.length;
      if (startIndex > 20000) break;
    }
  } catch (err) {
    console.error("impressions report failed", err);
  }
  kvSet(db, "reach_daily_rows", String(saved));
  return saved;
}

export async function fetchRetention(db: Database.Database, videoId: string, locale: Locale): Promise<number> {
  assertVideoId(videoId, locale);
  const auth = await loadClient(locale);
  const video = db.prepare("SELECT published_at FROM videos WHERE id = ?").get(videoId) as { published_at: string | null } | undefined;
  const start = video?.published_at ? parse(video.published_at) : "2006-01-01";
  const end = addDays(new Date().toISOString().slice(0, 10), -1);
  const rows = await queryAnalytics(auth, start, end, {
    metrics: "audienceWatchRatio,relativeRetentionPerformance",
    dimensions: "elapsedVideoTimeRatio",
    filters: `video==${videoId}`,
  });
  const write = db.transaction(() => {
    db.prepare("DELETE FROM retention WHERE video_id = ?").run(videoId);
    const insert = db.prepare("INSERT INTO retention VALUES (?,?,?,?)");
    for (const row of rows) {
      insert.run(videoId, num(row.elapsedVideoTimeRatio), num(row.audienceWatchRatio), num(row.relativeRetentionPerformance));
    }
  });
  write();
  return rows.length;
}

export async function runSync(db: Database.Database, daysBack?: number | null): Promise<{ status: string; detail?: string }> {
  if (running) return { status: "busy" };
  running = true;
  const prefs = prefsDatabase(db);
  const storedLocale = kvGet(prefs, "locale");
  const locale: Locale = isLocale(storedLocale) ? storedLocale : "en";
  let logId: number | bigint | null = null;
  try {
    const settings = loadSettings(prefs);
    const hasData = db.prepare("SELECT 1 AS ok FROM channel_daily LIMIT 1").get();
    logId = db.prepare("INSERT INTO sync_log (started_at, status) VALUES (?, 'running')").run(nowIso()).lastInsertRowid;
    const window = daysBack ?? (hasData ? settings.syncDaysBack : settings.initialDaysBack);
    const end = addDays(new Date().toISOString().slice(0, 10), -1);
    const start = addDays(end, -(window - 1));
    const auth = await loadClient(locale);
    await syncPublic(auth, db, locale);
    noteActiveChannel(db);
    await syncAnalytics(auth, db, start, end);
    await syncReach(auth, db, start, end);
    kvSet(db, "demo", null);
    const generated = await autoGenerateReports(db, locale);
    const detail = `${start} → ${end}${generated.length ? ` · report ${generated.join(", ")}` : ""}`;
    db.prepare("UPDATE sync_log SET finished_at=?, status='ok', detail=? WHERE id=?").run(nowIso(), detail, logId);
    return { status: "ok", detail };
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 500) : "sync failed";
    console.error("sync failed", err);
    if (logId != null) {
      db.prepare("UPDATE sync_log SET finished_at=?, status='error', detail=? WHERE id=?").run(nowIso(), detail, logId);
    }
    return { status: "error", detail };
  } finally {
    running = false;
  }
}
