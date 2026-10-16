import type Database from "better-sqlite3";
import { clipboard, ipcMain } from "electron";
import {
  activateAccount,
  activeAccountId,
  DEMO_ID,
  metaDatabase,
  listAccountViews,
  metaReady,
  rememberAccount,
} from "./accounts";
import { database, kvGet, kvSet, peekDatabase } from "./db";
import { AppError } from "./errors";
import { getReport, getStatus, getWeeks, type Runtime } from "./status";
import { seed } from "./seed";
import { isLocale, translate, type Locale } from "../shared/i18n";
import { isTheme, type ThemeChoice } from "../shared/theme";
import { listVideos, videoDetail } from "./videos";
import { importReach } from "./csv";
import { buildReport, latestReach, saveReport } from "./report";
import { clientView, disconnectAccount, isConfigured, isConnected, saveClient } from "./auth";
import { startLogin } from "./oauth";
import { fetchRetention, isRunning, runSync } from "./youtube";
import { clearLlmKey, llmReady, saveLlmKey, settingsView, summarizeReport, updateSettings } from "./llm";
import { loadSettings } from "./settings";
import { nextSyncIso, rescheduleDailySync } from "./schedule";
import { configureMcp, mcpConfigText, mcpView, rotateMcpToken } from "./mcp";

function prefs(): Database.Database {
  return metaReady() ? metaDatabase() : database();
}

function channelDb(): Database.Database {
  const db = peekDatabase();
  if (!db) throw new AppError(translate(currentLocale(), "error.no_data"), 404);
  return db;
}

export function runtime(): Runtime {
  const settings = loadSettings(prefs());
  return {
    configured: isConfigured(),
    connected: isConnected(),
    syncing: isRunning(),
    nextSync: nextSyncIso(),
    llm: { provider: settings.llmProvider, enabled: llmReady(settings) },
  };
}

function handle(channel: string, fn: (args: unknown) => unknown): void {
  ipcMain.handle(channel, async (_event, args) => {
    try {
      return await fn(args);
    } catch (err) {
      if (err instanceof AppError) throw new Error(err.message);
      console.error(channel, err);
      throw new Error(translate(currentLocale(), "error.generic"));
    }
  });
}

export function currentLocale(): Locale {
  const db = metaReady() ? metaDatabase() : peekDatabase();
  if (!db) return "en";
  const stored = kvGet(db, "locale");
  return isLocale(stored) ? stored : "en";
}

export function currentTheme(): ThemeChoice {
  const db = metaReady() ? metaDatabase() : peekDatabase();
  if (!db) return "system";
  const stored = kvGet(db, "theme");
  return isTheme(stored) ? stored : "system";
}

export function registerIpc(): void {
  handle("locale", () => currentLocale());
  handle("set-locale", (value) => {
    if (!isLocale(value)) throw new AppError(translate(currentLocale(), "error.generic"));
    kvSet(prefs(), "locale", value);
    return value;
  });
  handle("theme", () => currentTheme());
  handle("set-theme", (value) => {
    if (!isTheme(value)) throw new AppError(translate(currentLocale(), "error.generic"));
    kvSet(prefs(), "theme", value);
    return value;
  });
  handle("status", () => {
    const db = peekDatabase();
    if (!db) {
      const settings = loadSettings(prefs());
      return {
        configured: isConfigured(),
        connected: false,
        demo: false,
        channel: null,
        videos: 0,
        data_range: null,
        last_sync: null,
        syncing: isRunning(),
        next_sync: nextSyncIso(),
        llm: { provider: settings.llmProvider, enabled: llmReady(settings) },
        accounts: listAccountViews(),
      };
    }
    return { ...getStatus(db, runtime()), accounts: listAccountViews() };
  });
  handle("weeks", () => getWeeks(channelDb()));
  handle("report", (week) => getReport(channelDb(), typeof week === "string" ? week : null, currentLocale()));
  handle("videos", () => listVideos(channelDb()));
  handle("video", (id) => videoDetail(channelDb(), String(id ?? ""), currentLocale()));
  handle("import-reach", (payload) => {
    const body = payload as { csv?: string; periodStart?: string; periodEnd?: string };
    const imported = importReach(channelDb(), body.csv ?? "", body.periodStart ?? "", body.periodEnd ?? "", currentLocale());
    return { imported };
  });
  handle("reach", () => latestReach(channelDb()));
  handle("client", () => clientView());
  handle("save-client", (payload) => {
    const body = payload as { clientId?: string; clientSecret?: string };
    saveClient(body.clientId ?? "", body.clientSecret ?? "", currentLocale());
    return clientView();
  });
  handle("connect", () => {
    startLogin(currentLocale());
    return { ok: true };
  });
  handle("accounts", () => listAccountViews());
  handle("activate-account", (id) => {
    activateAccount(String(id ?? ""), currentLocale(), isRunning());
    return { ok: true };
  });
  handle("disconnect", (id) => {
    const target = typeof id === "string" && id ? id : activeAccountId();
    if (target) disconnectAccount(target);
    return { ok: true };
  });
  handle("sync", () => {
    const locale = currentLocale();
    if (!isConnected()) throw new AppError(translate(locale, "error.not_connected"));
    if (isRunning()) return { started: false, reason: translate(locale, "error.sync_busy") };
    void runSync(channelDb());
    return { started: true };
  });
  handle("retention", async (id) => {
    const locale = currentLocale();
    if (!isConnected()) throw new AppError(translate(locale, "error.not_connected"));
    return { points: await fetchRetention(channelDb(), String(id ?? ""), locale) };
  });
  handle("seed-demo", async () => {
    const locale = currentLocale();
    if (isRunning()) throw new AppError(translate(locale, "error.sync_busy"));
    if (metaReady()) {
      rememberAccount(DEMO_ID, "Demo Channel", null);
      activateAccount(DEMO_ID, locale, false);
    }
    const n = await seed(channelDb());
    if (metaReady()) {
      const ch = channelDb().prepare("SELECT title, thumbnail FROM channel LIMIT 1").get() as
        | { title: string; thumbnail: string | null }
        | undefined;
      if (ch) rememberAccount(DEMO_ID, ch.title, ch.thumbnail);
    }
    return { videos: n };
  });
  handle("settings", () => settingsView(prefs()));
  handle("save-settings", (payload) => {
    const view = updateSettings(prefs(), payload, currentLocale());
    rescheduleDailySync();
    return view;
  });
  handle("save-llm-key", (key) => saveLlmKey(String(key ?? ""), currentLocale()));
  handle("clear-llm-key", () => clearLlmKey(currentLocale()));
  handle("mcp", () => mcpView(prefs()));
  handle("save-mcp", (payload) => configureMcp(prefs(), payload, currentLocale()));
  handle("rotate-mcp", () => rotateMcpToken(prefs(), currentLocale()));
  handle("copy-mcp", () => {
    clipboard.writeText(mcpConfigText(prefs(), currentLocale()));
    return { copied: true };
  });
  handle("summarize", async (week) => {
    const locale = currentLocale();
    const db = channelDb();
    const report = buildReport(db, typeof week === "string" ? week : null, locale);
    if (!report) throw new AppError(translate(locale, "error.no_data"), 404);
    const summary = await summarizeReport(prefs(), report, locale);
    saveReport(db, report, summary);
    return { summary };
  });
}
