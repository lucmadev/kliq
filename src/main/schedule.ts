/** Sync once per local calendar day while the app is open. */

type ZoneParts = { y: number; m: number; d: number; h: number; min: number };

export type DailySyncDeps = {
  timeZone: () => string;
  shouldRun: () => boolean;
  run: () => void;
};

let deps: DailySyncDeps | null = null;
let timer: NodeJS.Timeout | null = null;
let nextAt: Date | null = null;

function zoneParts(date: Date, tz: string): ZoneParts {
  const bag: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date)) {
    bag[part.type] = part.value;
  }
  return {
    y: Number(bag.year),
    m: Number(bag.month),
    d: Number(bag.day),
    h: Number(bag.hour),
    min: Number(bag.minute),
  };
}

function zoneOffsetMs(date: Date, tz: string): number {
  const parts = zoneParts(date, tz);
  const wallAsUtc = Date.UTC(parts.y, parts.m - 1, parts.d, parts.h, parts.min, 0);
  return wallAsUtc - date.getTime();
}

function zonedToUtc(y: number, m: number, d: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, hour, minute, 0);
  const corrected = new Date(guess - zoneOffsetMs(new Date(guess), tz));
  return new Date(guess - zoneOffsetMs(corrected, tz));
}

export function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function localDateKey(date: Date, tz: string): string {
  const parts = zoneParts(date, safeZone(tz));
  return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

export function nextLocalMidnight(now: Date, tz: string): Date {
  const zone = safeZone(tz);
  const parts = zoneParts(now, zone);
  const next = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + 1));
  return zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, zone);
}

export function syncedOnLocalDay(finishedAt: string | null, now: Date, tz: string): boolean {
  if (!finishedAt) return false;
  const when = new Date(finishedAt);
  if (Number.isNaN(when.getTime())) return false;
  return localDateKey(when, tz) === localDateKey(now, tz);
}

function arm(): void {
  if (!deps) return;
  if (timer) clearTimeout(timer);
  nextAt = nextLocalMidnight(new Date(), deps.timeZone());
  const delay = Math.max(1000, nextAt.getTime() - Date.now());
  timer = setTimeout(() => {
    if (deps?.shouldRun()) deps.run();
    arm();
  }, delay);
  timer.unref();
}

export function startDailySync(next: DailySyncDeps): void {
  deps = next;
  if (next.shouldRun()) next.run();
  arm();
}

export function nextSyncIso(): string | null {
  return nextAt ? nextAt.toISOString() : null;
}
