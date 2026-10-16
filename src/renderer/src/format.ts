const nf = new Intl.NumberFormat("es-AR");
const dec1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export const num = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));
// Formato compacto propio: ICU es-AR mezcla "k" y "K" según el rango
export const short = (n: number | null | undefined) => {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e6) return `${dec1.format(n / 1e6)} M`;
  if (a >= 1e3) return `${dec1.format(n / 1e3)} K`;
  return nf.format(n);
};

export function secs(s: number | null | undefined) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(r).padStart(2, "0")}`;
}

export function pct(p: number | null | undefined, digits = 1) {
  if (p == null) return "—";
  const sign = p > 0 ? "+" : p < 0 ? "−" : "";
  return `${sign}${Math.abs(p).toFixed(digits).replace(".", ",")}%`;
}

const dfmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
export function day(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return dfmt.format(new Date(y, m - 1, d));
}

export function range(a: string, b: string) {
  return `${day(a)} – ${day(b)}`;
}

export function ago(iso: string | null | undefined) {
  if (!iso) return "nunca";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "recién";
  if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
  return `hace ${Math.round(diff / 86400)} días`;
}
