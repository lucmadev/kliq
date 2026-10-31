import type { ReactNode } from "react";
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { pct } from "../format";
import { useI18n } from "../i18n";
import type { MessageKey } from "../../../shared/i18n";

/** A change against the previous period. Colour says good or bad; a change under 1% stays grey. */
export function Delta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  const { t, locale } = useI18n();
  if (value == null) return <span className="text-xs text-muted-foreground">{t("delta.new")}</span>;
  const good = inverse ? value < 0 : value > 0;
  const flat = Math.abs(value) < 1;
  const cls = flat ? "text-muted-foreground" : good ? "text-good" : "text-critical";
  return <span className={cn("num text-xs font-medium whitespace-nowrap", cls)}>{pct(value, locale)}</span>;
}

const FLAG_KEY: Record<string, MessageKey> = {
  new: "flag.new",
  outlier: "flag.outlier",
  rising: "flag.rising",
  falling: "flag.falling",
};

const PILL = {
  tint: "bg-tint-100 text-tint-ink",
  good: "bg-pill-good text-pill-good-ink",
  bad: "bg-pill-bad text-pill-bad-ink",
  neutral: "bg-muted text-muted-foreground",
} as const;

export type PillTone = keyof typeof PILL;

/** A pale tag with dark text of the same hue. Never squeezed. */
export function Pill({ tone = "neutral", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 flex-none items-center rounded-full px-2 align-middle text-[0.75rem] font-medium whitespace-nowrap", PILL[tone], className)}>
      {children}
    </span>
  );
}

const FLAG_TONE: Record<string, PillTone> = { new: "tint", outlier: "good", rising: "good", falling: "bad" };

export function Flag({ flag }: { flag: string | null }) {
  const { t } = useI18n();
  if (!flag) return null;
  const key = FLAG_KEY[flag];
  return <Pill tone={FLAG_TONE[flag] ?? "neutral"} className="ml-2">{key ? t(key) : flag}</Pill>;
}

export function Card({ title, aside, children, className = "", contentClassName = "" }: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className="flex min-w-0 flex-col">
      <ShadcnCard className={cn("flex-1 gap-4 py-5", className)}>
        {(title || aside) && (
          <CardHeader className="flex min-h-7 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5">
            {title && <CardTitle className="text-base font-semibold">{title}</CardTitle>}
            {aside}
          </CardHeader>
        )}
        <CardContent className={cn("flex-1 px-5", contentClassName)}>{children}</CardContent>
      </ShadcnCard>
    </section>
  );
}

export function Aside({ children }: { children: ReactNode }) {
  return <span className="text-[0.8125rem] text-muted-foreground">{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-input px-3 py-2.5 text-sm text-muted-foreground">{children}</p>
  );
}

/** A settings row: what the setting is on the left, its controls in a quiet panel on the right. */
export function SettingsSection({ title, description, children }: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-10 gap-y-3 border-t py-8 first:border-t-0 first:pt-2 max-[900px]:grid-cols-1">
      <div className="pt-1.5">
        <h2 className="text-base font-medium">{title}</h2>
        {description && <p className="mt-1 max-w-[46ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0 rounded-2xl border bg-card p-5">{children}</div>
    </section>
  );
}

/** Minimal markdown for the AI summary: **bold**, bullets, and paragraphs. */
export function MiniMarkdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong className="font-semibold" key={i}>{part.slice(2, -2)}</strong> : part,
    );
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul className="my-1 list-disc pl-4 text-sm" key={blocks.length}>
          {list.map((li, i) => (
            <li key={i}>{inline(li)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      list.push(line.replace(/^([-*•]|\d+\.)\s+/, ""));
    } else {
      flush();
      if (line) {
        const h = line.replace(/^#+\s*/, "");
        blocks.push(<p className="my-1.5 text-sm" key={blocks.length}>{inline(h)}</p>);
      }
    }
  }
  flush();
  return <div>{blocks}</div>;
}
