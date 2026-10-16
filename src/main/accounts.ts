/** One SQLite file per YouTube channel, plus a small meta database for app settings. */

import { chmodSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import {
  clearDatabase,
  kvGet,
  kvSet,
  nowIso,
  openDatabase,
  peekDatabase,
  setDatabase,
} from "./db";
import { AppError } from "./errors";
import { SECRET, secretGet, secretSet, secretsAvailable } from "./secrets";
import { translate, type Locale } from "../shared/i18n";

export const DEMO_ID = "demo";

const CHANNEL_ID = /^UC[\w-]{22}$/;

const META_SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  thumbnail TEXT,
  created_at TEXT NOT NULL
);
`;

export type AccountRecord = {
  id: string;
  title: string;
  thumbnail: string | null;
};

export type ConnectedChannel = {
  id: string;
  title: string;
  thumbnail: string | null;
  subscribers: number;
  views: number;
  videoCount: number;
};

let rootDir: string | null = null;
let meta: Database.Database | null = null;

export function isAccountId(id: string): boolean {
  return id === DEMO_ID || CHANNEL_ID.test(id);
}

export function accountTokenKey(id: string): string {
  return `${SECRET.refreshToken}:${id}`;
}

export function metaReady(): boolean {
  return meta !== null;
}

export function metaDatabase(): Database.Database {
  if (!meta) throw new Error("Account store is not open yet");
  return meta;
}

/** Settings and locale live in meta once the store is open. Tests keep using the database they passed. */
export function prefsDatabase(fallback: Database.Database): Database.Database {
  return meta ?? fallback;
}

export function closeAccounts(): void {
  const current = peekDatabase();
  if (current) {
    current.close();
    clearDatabase();
  }
  meta?.close();
  meta = null;
  rootDir = null;
}

function openMeta(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(META_SCHEMA);
  try {
    chmodSync(dbPath, 0o600);
  } catch {
    /* some filesystems refuse the mode change */
  }
  return db;
}

export function accountPath(id: string): string {
  if (!isAccountId(id)) throw new Error("bad account id");
  if (!rootDir) throw new Error("Account store is not open yet");
  return join(rootDir, "accounts", `${id}.db`);
}

export function initAccounts(userData: string, osLocale: string): void {
  closeAccounts();
  rootDir = userData;
  meta = openMeta(join(userData, "meta.db"));
  migrateLegacy(join(userData, "monitor.db"));
  const active = kvGet(meta, "active_account");
  if (active && isAccountId(active) && existsSync(accountPath(active))) {
    setDatabase(openDatabase(accountPath(active)));
  }
  if (kvGet(meta, "locale") !== "en" && kvGet(meta, "locale") !== "es") {
    kvSet(meta, "locale", osLocale.toLowerCase().startsWith("es") ? "es" : "en");
  }
}

export function activeAccountId(): string | null {
  if (!meta) return null;
  const id = kvGet(meta, "active_account");
  return id && isAccountId(id) ? id : null;
}

export function rememberAccount(id: string, title: string, thumbnail: string | null): void {
  if (!meta) throw new Error("Account store is not open yet");
  if (!isAccountId(id)) throw new Error("bad account id");
  meta.prepare(
    `INSERT INTO accounts (id, title, thumbnail, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, thumbnail = excluded.thumbnail`,
  ).run(id, title || id, thumbnail, nowIso());
  if (!existsSync(accountPath(id))) {
    const created = openDatabase(accountPath(id));
    created.close();
  }
}

export function activateAccount(id: string, locale: Locale, busy: boolean): void {
  if (!meta || !isAccountId(id)) throw new AppError(translate(locale, "error.bad_account"));
  if (busy) throw new AppError(translate(locale, "error.sync_busy"));
  const row = meta.prepare("SELECT id FROM accounts WHERE id = ?").get(id);
  if (!row) throw new AppError(translate(locale, "error.bad_account"));
  const next = openDatabase(accountPath(id));
  const prev = peekDatabase();
  setDatabase(next);
  kvSet(meta, "active_account", id);
  if (prev && prev !== next) prev.close();
}

export function listAccountRecords(): AccountRecord[] {
  if (!meta) return [];
  return meta.prepare("SELECT id, title, thumbnail FROM accounts ORDER BY created_at").all() as AccountRecord[];
}

export type AccountView = AccountRecord & {
  subscribers: number;
  connected: boolean;
  active: boolean;
  demo: boolean;
};

export function listAccountViews(): AccountView[] {
  if (!meta) return [];
  const active = activeAccountId();
  return listAccountRecords().map((row) => {
    const channel = readChannel(row.id, active);
    return {
      id: row.id,
      title: channel?.title || row.title,
      thumbnail: channel?.thumbnail ?? row.thumbnail,
      subscribers: channel?.subscribers ?? 0,
      connected: row.id !== DEMO_ID && Boolean(secretGet(accountTokenKey(row.id))),
      active: row.id === active,
      demo: row.id === DEMO_ID,
    };
  });
}

function readChannel(
  id: string,
  active: string | null,
): { title: string; thumbnail: string | null; subscribers: number } | null {
  const query = "SELECT title, thumbnail, subscribers FROM channel LIMIT 1";
  if (id === active) {
    const db = peekDatabase();
    if (!db) return null;
    return (db.prepare(query).get() as { title: string; thumbnail: string | null; subscribers: number } | undefined) ?? null;
  }
  const path = accountPath(id);
  if (!existsSync(path)) return null;
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    return (db.prepare(query).get() as { title: string; thumbnail: string | null; subscribers: number } | undefined) ?? null;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export function noteActiveChannel(db: Database.Database): void {
  if (!meta) return;
  const id = activeAccountId();
  if (!id || peekDatabase() !== db) return;
  const ch = db.prepare("SELECT title, thumbnail FROM channel LIMIT 1").get() as
    | { title: string; thumbnail: string | null }
    | undefined;
  if (!ch?.title) return;
  meta.prepare("UPDATE accounts SET title = ?, thumbnail = ? WHERE id = ?").run(ch.title, ch.thumbnail, id);
}

export function saveConnectedChannel(refreshToken: string, channel: ConnectedChannel, locale: Locale, busy: boolean): void {
  if (!secretsAvailable()) throw new AppError(translate(locale, "error.keychain"));
  if (!isAccountId(channel.id) || channel.id === DEMO_ID) throw new AppError(translate(locale, "error.no_channel"));
  secretSet(accountTokenKey(channel.id), refreshToken);
  rememberAccount(channel.id, channel.title, channel.thumbnail);
  const scratch = openDatabase(accountPath(channel.id));
  scratch.prepare("INSERT OR REPLACE INTO channel VALUES (?,?,?,?,?,?,?)").run(
    channel.id,
    channel.title,
    channel.thumbnail,
    channel.subscribers,
    channel.views,
    channel.videoCount,
    nowIso(),
  );
  scratch.close();
  if (busy) return;
  activateAccount(channel.id, locale, false);
}

export function adoptLegacyToken(): void {
  if (!secretsAvailable()) return;
  const id = activeAccountId();
  if (!id || id === DEMO_ID) return;
  const legacy = secretGet(SECRET.refreshToken);
  if (!legacy) return;
  if (!secretGet(accountTokenKey(id))) secretSet(accountTokenKey(id), legacy);
  secretSet(SECRET.refreshToken, null);
}

function migrateLegacy(legacyPath: string): void {
  if (!meta || !rootDir || !existsSync(legacyPath)) return;
  const legacy = openDatabase(legacyPath);
  const channel = legacy.prepare("SELECT id, title, thumbnail FROM channel LIMIT 1").get() as
    | { id: string; title: string; thumbnail: string | null }
    | undefined;
  const demo = kvGet(legacy, "demo") === "1";
  const locale = kvGet(legacy, "locale");
  const settings = kvGet(legacy, "settings");
  legacy.close();

  if (locale && !kvGet(meta, "locale")) kvSet(meta, "locale", locale);
  if (settings && !kvGet(meta, "settings")) kvSet(meta, "settings", settings);

  const id = demo ? DEMO_ID : channel && isAccountId(channel.id) ? channel.id : null;
  if (!id) return;

  const dest = accountPath(id);
  if (!existsSync(dest)) {
    mkdirSync(dirname(dest), { recursive: true });
    renameSync(legacyPath, dest);
    for (const suffix of ["-wal", "-shm"]) {
      if (existsSync(legacyPath + suffix)) renameSync(legacyPath + suffix, dest + suffix);
    }
  }
  rememberAccount(id, channel?.title || (id === DEMO_ID ? "Demo Channel" : id), channel?.thumbnail ?? null);
  if (!kvGet(meta, "active_account")) kvSet(meta, "active_account", id);
}
