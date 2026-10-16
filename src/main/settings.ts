import type Database from "better-sqlite3";
import { kvGet, kvSet } from "./db";

export type LlmProvider = "none" | "anthropic" | "openai" | "compatible";

export type Settings = {
  tz: string;
  syncHour: number;
  syncDaysBack: number;
  initialDaysBack: number;
  llmProvider: LlmProvider;
  llmModel: string;
  llmBaseUrl: string;
  mcpEnabled: boolean;
  mcpPort: number;
};

export const DEFAULT_SETTINGS: Settings = {
  tz: "America/Argentina/Buenos_Aires",
  syncHour: 6,
  syncDaysBack: 28,
  initialDaysBack: 120,
  llmProvider: "none",
  llmModel: "",
  llmBaseUrl: "http://127.0.0.1:11434/v1",
  mcpEnabled: false,
  mcpPort: 47321,
};

export function loadSettings(db: Database.Database): Settings {
  const raw = kvGet(db, "settings");
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(db: Database.Database, patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(db), ...patch };
  kvSet(db, "settings", JSON.stringify(next));
  return next;
}
