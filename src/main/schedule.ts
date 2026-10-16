/** Daily sync while the app is open. Fires at minute 7 of the configured hour. */

const MINUTE = 7;

type ZoneParts = { y: number; m: number; d: number; h: number; min: number };

export type DailySyncDeps = {
  read: () => { tz: string; hour: number };
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

function addCalendarDay(parts: ZoneParts): ZoneParts {
  const next = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + 1));
  return { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate(), h: 0, min: 0 };
}

function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function nextDailyRun(now: Date, tz: string, hour: number): Date {
  const zone = safeZone(tz);
  const h = Math.min(23, Math.max(0, Math.trunc(hour)));
  const parts = zoneParts(now, zone);
  let at = zonedToUtc(parts.y, parts.m, parts.d, h, MINUTE, zone);
  if (at.getTime() <= now.getTime()) {
    const tomorrow = addCalendarDay(parts);
    at = zonedToUtc(tomorrow.y, tomorrow.m, tomorrow.d, h, MINUTE, zone);
  }
  return at;
}

function arm(): void {
  if (!deps) return;
  if (timer) clearTimeout(timer);
  const { tz, hour } = deps.read();
  nextAt = nextDailyRun(new Date(), tz, hour);
  const delay = Math.max(0, nextAt.getTime() - Date.now());
  timer = setTimeout(() => {
    if (deps?.shouldRun()) deps.run();
    arm();
  }, delay);
  timer.unref();
}

export function startDailySync(next: DailySyncDeps): void {
  deps = next;
  arm();
}

export function rescheduleDailySync(): void {
  if (deps) arm();
}

export function nextSyncIso(): string | null {
  return nextAt ? nextAt.toISOString() : null;
}
