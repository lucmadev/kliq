import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS channel (
    id TEXT PRIMARY KEY, title TEXT, thumbnail TEXT,
    subscribers INTEGER, views INTEGER, video_count INTEGER, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY, title TEXT, published_at TEXT, duration_s INTEGER,
    thumbnail TEXT, views INTEGER, likes INTEGER, comments INTEGER, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS video_snapshots (
    date TEXT, video_id TEXT, views INTEGER, likes INTEGER, comments INTEGER,
    PRIMARY KEY (date, video_id)
);

CREATE TABLE IF NOT EXISTS channel_daily (
    date TEXT PRIMARY KEY, views INTEGER, watch_minutes REAL, avg_view_duration REAL,
    subs_gained INTEGER, subs_lost INTEGER, likes INTEGER, comments INTEGER, shares INTEGER
);

CREATE TABLE IF NOT EXISTS video_daily (
    date TEXT, video_id TEXT, views INTEGER, watch_minutes REAL,
    avg_view_duration REAL, subs_gained INTEGER,
    PRIMARY KEY (date, video_id)
);
CREATE INDEX IF NOT EXISTS idx_video_daily_video ON video_daily (video_id, date);

CREATE TABLE IF NOT EXISTS traffic_daily (
    date TEXT, source TEXT, views INTEGER, watch_minutes REAL,
    PRIMARY KEY (date, source)
);

CREATE TABLE IF NOT EXISTS search_terms (
    week_start TEXT, term TEXT, views INTEGER,
    PRIMARY KEY (week_start, term)
);

CREATE TABLE IF NOT EXISTS retention (
    video_id TEXT, ratio REAL, watch_ratio REAL, relative_perf REAL,
    PRIMARY KEY (video_id, ratio)
);

CREATE TABLE IF NOT EXISTS reach (
    period_start TEXT, period_end TEXT, video_id TEXT, impressions INTEGER, ctr REAL,
    PRIMARY KEY (period_start, period_end, video_id)
);

CREATE TABLE IF NOT EXISTS reports (
    week_start TEXT PRIMARY KEY, created_at TEXT, data TEXT, summary TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT, finished_at TEXT,
    status TEXT, detail TEXT
);
`;

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

export function openDatabase(dbPath: string): Database.Database {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  if (dbPath !== ":memory:") {
    try {
      chmodSync(dbPath, 0o600);
    } catch {
      /* some filesystems refuse the mode change */
    }
  }
  return db;
}

export function kvGet(db: Database.Database, key: string): string | null {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function kvSet(db: Database.Database, key: string, value: string | null): void {
  if (value === null) {
    db.prepare("DELETE FROM kv WHERE key = ?").run(key);
    return;
  }
  db.prepare(
    "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

let current: Database.Database | null = null;

export function setDatabase(db: Database.Database): void {
  current = db;
}

export function database(): Database.Database {
  if (!current) throw new Error("Database is not open yet");
  return current;
}
