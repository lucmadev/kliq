import { ipcMain } from "electron";
import { database, kvGet, kvSet } from "./db";
import { AppError } from "./errors";
import { getReport, getStatus, getWeeks, type Runtime } from "./status";
import { seed } from "./seed";
import { isLocale, translate, type Locale } from "../shared/i18n";

export function runtime(): Runtime {
  return {
    configured: false,
    connected: false,
    syncing: false,
    nextSync: null,
    llm: { provider: "none", enabled: false },
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
  handle("seed-demo", async () => {
    const n = await seed(database());
    return { videos: n };
  });
}
