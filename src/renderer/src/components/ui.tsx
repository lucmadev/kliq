import type { ReactNode } from "react";
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pct } from "../format";
import { useI18n } from "../i18n";
import type { MessageKey } from "../../../shared/i18n";

export function Delta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  const { t, locale } = useI18n();
  if (value == null) return <span className="font-mono text-xs font-semibold text-muted-foreground">{t("delta.new")}</span>;
  const good = inverse ? value < 0 : value > 0;
  const flat = Math.abs(value) < 1;
  const cls = flat ? "text-muted-foreground" : good ? "text-good" : "text-critical";
  const arrow = flat ? "→" : value > 0 ? "▲" : "▼";
  return (
    <span className={`font-mono text-xs font-semibold whitespace-nowrap ${cls}`}>
      <span aria-hidden>{arrow}</span> {pct(value, locale)}
    </span>
  );
}

const FLAG_KEY: Record<string, MessageKey> = {
  new: "flag.new",
  outlier: "flag.outlier",
  rising: "flag.rising",
  falling: "flag.falling",
};

const FLAG_CLASS: Record<string, string> = {
  new: "bg-accent text-primary",
  outlier: "bg-good/15 text-good",
  rising: "bg-good/10 text-good",
  falling: "bg-critical/15 text-critical",
};

export function Flag({ flag }: { flag: string | null }) {
  const { t } = useI18n();
  if (!flag) return null;
  const key = FLAG_KEY[flag];
  const mark = flag === "outlier" ? "★ " : flag === "rising" ? "▲ " : flag === "falling" ? "▼ " : "";
  return (
    <span className={`ml-1.5 inline-block rounded-md px-1.5 align-middle text-[0.7rem] font-semibold ${FLAG_CLASS[flag] ?? ""}`}>
      {mark}{key ? t(key) : flag}
    </span>
  );
}

export function Card({ title, aside, children, className = "" }: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section>
      <ShadcnCard className={`gap-3 py-4 ${className}`}>
        {(title || aside) && (
          <CardHeader className="flex flex-row items-center justify-between gap-3 px-4">
            {title && <CardTitle className="text-[0.98rem]">{title}</CardTitle>}
            {aside}
          </CardHeader>
        )}
        <CardContent className="px-4">{children}</CardContent>
      </ShadcnCard>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="my-1.5 text-sm text-muted-foreground">{children}</p>;
}

/** Minimal markdown for the AI summary: **bold**, bullets, and paragraphs. */
export function MiniMarkdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
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
