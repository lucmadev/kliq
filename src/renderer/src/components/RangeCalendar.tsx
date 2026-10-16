import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { range } from "../format";
import { useI18n } from "../i18n";
import { intlTag, type MessageKey } from "../../../shared/i18n";

type Value = { start: string; end: string };

export default function RangeCalendar({ open, onOpenChange, value, onApply }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: Value;
  onApply: (start: string, end: string) => void;
}) {
  const { t, locale } = useI18n();
  const [start, setStart] = useState<string | null>(value.start || null);
  const [end, setEnd] = useState<string | null>(value.end || null);
  const [hover, setHover] = useState<string | null>(null);
  const [month, setMonth] = useState(() => monthOf(value.start || value.end || todayIso()));
  const picking = useRef(false);
  const anchor = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStart(value.start || null);
    setEnd(value.end || null);
    setHover(null);
    picking.current = false;
    anchor.current = null;
    setMonth(monthOf(value.start || value.end || todayIso()));
  }, [open, value.start, value.end]);

  const previewEnd = start && !end ? hover : end;
  const [lo, hi] = ordered(start, previewEnd);
  const months = [month, addMonths(month, 1)];
  const monthName = new Intl.DateTimeFormat(intlTag(locale), { month: "long", year: "numeric" });

  const pick = (iso: string) => {
    if (!picking.current) {
      picking.current = true;
      anchor.current = iso;
      setStart(iso);
      setEnd(null);
      return;
    }
    const [a, b] = ordered(anchor.current, iso);
    setStart(a);
    setEnd(b);
    picking.current = false;
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[min(42rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-4 text-card-foreground shadow-lg">
          <DialogPrimitive.Title className="text-base font-semibold">{t("period.pick")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            {t("period.pick_help")}
          </DialogPrimitive.Description>
          <div className="mt-3 flex items-center justify-between">
            <Button type="button" variant="outline" size="icon-sm" aria-label={t("period.nav_previous.month")} onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft />
            </Button>
            <Button type="button" variant="outline" size="icon-sm" aria-label={t("period.nav_next.month")} onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight />
            </Button>
          </div>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            {months.map((item) => (
              <div key={isoOf(item)}>
                <div className="mb-2 text-center text-sm font-medium capitalize">{monthName.format(item)}</div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i}>{t(`weekday.${i}` as MessageKey)}</span>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1" onMouseLeave={() => setHover(null)}>
                  {monthCells(item).map((date, index) => {
                    if (!date) return <span key={index} />;
                    const iso = isoOf(date);
                    const selected = iso === start || iso === end;
                    const inside = lo != null && hi != null && iso > lo && iso < hi;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onMouseEnter={() => setHover(iso)}
                        onClick={() => pick(iso)}
                        className={cn(
                          "h-8 rounded-md text-sm hover:bg-accent",
                          inside && "bg-accent",
                          selected && "bg-primary text-primary-foreground hover:bg-primary",
                          iso === todayIso() && !selected && "ring-1 ring-primary",
                        )}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {start && end ? range(start, end, locale) : start ? range(start, start, locale) : ""}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("period.cancel")}</Button>
              <Button type="button" disabled={!start || !end} onClick={() => start && end && onApply(start, end)}>{t("period.apply")}</Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function monthCells(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= days; day++) cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function ordered(a: string | null, b: string | null): [string | null, string | null] {
  if (!a || !b) return [a, b];
  return a <= b ? [a, b] : [b, a];
}

function monthOf(iso: string): Date {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function isoOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function todayIso(): string {
  return isoOf(new Date());
}
