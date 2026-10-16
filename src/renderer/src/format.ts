import { intlTag, translate, type Locale, type MessageKey } from "../../shared/i18n";

export function num(n: number | null | undefined, locale: Locale) {
  if (n == null) return "—";
  return new Intl.NumberFormat(intlTag(locale)).format(n);
}

export function short(n: number | null | undefined, locale: Locale) {
  if (n == null) return "—";
  const tag = intlTag(locale);
  const abs = Math.abs(n);
  const dec = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  const fmt = new Intl.NumberFormat(tag);
  if (abs >= 1e6) return `${dec.format(n / 1e6)} M`;
  if (abs >= 1e3) return `${dec.format(n / 1e3)} K`;
  return fmt.format(n);
}

export function secs(s: number | null | undefined) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(r).padStart(2, "0")}`;
}

export function pct(p: number | null | undefined, locale: Locale, digits = 1) {
  if (p == null) return "—";
  const sign = p > 0 ? "+" : p < 0 ? "−" : "";
  const body = new Intl.NumberFormat(intlTag(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(p));
  return `${sign}${body}%`;
}

export function day(iso: string | null | undefined, locale: Locale) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(intlTag(locale), { day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
}

export function range(a: string, b: string, locale: Locale) {
  return `${day(a, locale)} – ${day(b, locale)}`;
}

export function ago(iso: string | null | undefined, locale: Locale) {
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
  if (!iso) return t("ago.never");
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t("ago.just");
  if (diff < 3600) return t("ago.minutes", { n: Math.round(diff / 60) });
  if (diff < 86400) return t("ago.hours", { n: Math.round(diff / 3600) });
  return t("ago.days", { n: Math.round(diff / 86400) });
}
