import type Database from "better-sqlite3";
import { AppError } from "./errors";
import { translate, type Locale } from "../shared/i18n";
import { VIDEO_ID } from "./videos";

const MAX_BYTES = 5 * 1024 * 1024;

function norm(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function asInt(value: string | undefined): number {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function asPct(value: string | undefined): number | null {
  const cleaned = (value ?? "").trim().replace("%", "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Studio CSV headers arrive in English or Spanish; these tokens match both. */
function findColumns(headers: string[], locale: Locale): { id: number; impressions: number; ctr: number } {
  const names = headers.map(norm);
  const cols: Partial<{ id: number; impressions: number; ctr: number }> = {};
  names.forEach((name, i) => {
    if ((name === "content" || name === "contenido" || name === "video") && cols.id == null) cols.id = i;
    else if ((name.includes("clic") || name.includes("click")) && name.includes("impres")) cols.ctr = i;
    else if (name.startsWith("impres") && cols.impressions == null) cols.impressions = i;
  });
  if (cols.id == null) cols.id = 0;
  if (cols.impressions == null || cols.ctr == null) {
    throw new AppError(translate(locale, "error.csv_columns"));
  }
  return cols as { id: number; impressions: number; ctr: number };
}

export function importReach(db: Database.Database, content: string, periodStart: string, periodEnd: string, locale: Locale): number {
  if (Buffer.byteLength(content) > MAX_BYTES) throw new AppError(translate(locale, "error.csv_too_big"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    throw new AppError(translate(locale, "error.bad_dates"));
  }
  const text = content.replace(/^\uFEFF/, "");
  const rows = parseCsv(text);
  if (rows.length < 2) throw new AppError(translate(locale, "error.csv_empty"));
  const cols = findColumns(rows[0], locale);
  const insert = db.prepare("INSERT OR REPLACE INTO reach VALUES (?,?,?,?,?)");
  let n = 0;
  const write = db.transaction(() => {
    for (const row of rows.slice(1)) {
      if (row.length <= Math.max(cols.id, cols.impressions, cols.ctr)) continue;
      const id = row[cols.id].trim();
      if (!VIDEO_ID.test(id)) continue;
      insert.run(periodStart, periodEnd, id, asInt(row[cols.impressions]), asPct(row[cols.ctr]));
      n++;
    }
  });
  write();
  if (!n) throw new AppError(translate(locale, "error.csv_no_rows"));
  return n;
}
