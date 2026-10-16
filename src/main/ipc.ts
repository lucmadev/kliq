import { ipcMain } from "electron";
import { database, kvGet, kvSet } from "./db";
import { AppError } from "./errors";
import { getReport, getStatus, getWeeks, type Runtime } from "./status";
import { seed } from "./seed";
import { isLocale, translate, type Locale } from "../shared/i18n";
import { listVideos, videoDetail } from "./videos";
import { importReach } from "./csv";
import { buildReport, latestReach, saveReport } from "./report";
import { clientView, disconnectAccount, isConfigured, isConnected, saveClient } from "./auth";
import { startLogin } from "./oauth";
import { fetchRetention, isRunning, runSync } from "./youtube";
import { clearLlmKey, llmReady, saveLlmKey, settingsView, summarizeReport, updateSettings } from "./llm";
import { loadSettings } from "./settings";
import { nextSyncIso, rescheduleDailySync } from "./schedule";

export function runtime(): Runtime {
  const settings = loadSettings(database());
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
  const stored = kvGet(database(), "locale");
  return isLocale(stored) ? stored : "en";
}

export function registerIpc(): void {
  handle("locale", () => currentLocale());
  handle("set-locale", (value) => {
    if (!isLocale(value)) throw new AppError(translate(currentLocale(), "error.generic"));
    kvSet(database(), "locale", value);
    return value;
  });
  handle("status", () => getStatus(database(), runtime()));
  handle("weeks", () => getWeeks(database()));
  handle("report", (week) => getReport(database(), typeof week === "string" ? week : null, currentLocale()));
  handle("videos", () => listVideos(database()));
  handle("video", (id) => videoDetail(database(), String(id ?? ""), currentLocale()));
  handle("import-reach", (payload) => {
    const body = payload as { csv?: string; periodStart?: string; periodEnd?: string };
    const imported = importReach(database(), body.csv ?? "", body.periodStart ?? "", body.periodEnd ?? "", currentLocale());
    return { imported };
  });
  handle("reach", () => latestReach(database()));
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
  handle("disconnect", () => {
    disconnectAccount();
    return { ok: true };
  });
  handle("sync", () => {
    const locale = currentLocale();
    if (!isConnected()) throw new AppError(translate(locale, "error.not_connected"));
    if (isRunning()) return { started: false, reason: translate(locale, "error.sync_busy") };
    void runSync(database());
    return { started: true };
  });
  handle("retention", async (id) => {
    const locale = currentLocale();
    if (!isConnected()) throw new AppError(translate(locale, "error.not_connected"));
    return { points: await fetchRetention(database(), String(id ?? ""), locale) };
  });
  handle("seed-demo", async () => {
    const n = await seed(database());
    return { videos: n };
  });
  handle("settings", () => settingsView(database()));
  handle("save-settings", (payload) => {
    const view = updateSettings(database(), payload, currentLocale());
    rescheduleDailySync();
    return view;
  });
  handle("save-llm-key", (key) => saveLlmKey(String(key ?? ""), currentLocale()));
  handle("clear-llm-key", () => clearLlmKey(currentLocale()));
  handle("summarize", async (week) => {
    const locale = currentLocale();
    const report = buildReport(database(), typeof week === "string" ? week : null, locale);
    if (!report) throw new AppError(translate(locale, "error.no_data"), 404);
    const summary = await summarizeReport(database(), report, locale);
    saveReport(database(), report, summary);
    return { summary };
  });
}
