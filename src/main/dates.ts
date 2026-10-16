/** Calendar dates in UTC, with no time component. */

function utc(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parse(d: string | Date): string {
  return d instanceof Date ? isoOf(d) : d.slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = utc(parse(iso));
  d.setUTCDate(d.getUTCDate() + days);
  return isoOf(d);
}

/** Monday = 0 … Sunday = 6. */
function weekday(iso: string): number {
  return (utc(iso).getUTCDay() + 6) % 7;
}

export function* daterange(start: string, end: string): Generator<string> {
  let d = parse(start);
  const last = parse(end);
  while (d <= last) {
    yield d;
    d = addDays(d, 1);
  }
}

/** Monday of the week that contains d. */
export function weekStartOf(d: string): string {
  return addDays(parse(d), -weekday(d));
}

/** Monday of the last Monday–Sunday week fully covered through maxDate. */
export function lastCompleteWeekStart(maxDate: string): string {
  const daysSinceSunday = (weekday(maxDate) + 1) % 7;
  const lastSunday = addDays(maxDate, -daysSinceSunday);
  return addDays(lastSunday, -6);
}
