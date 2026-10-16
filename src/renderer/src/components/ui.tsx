import type { ReactNode } from "react";
import { pct } from "../format";
import { useI18n } from "../i18n";
import type { MessageKey } from "../../../shared/i18n";

export function Delta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  const { t, locale } = useI18n();
  if (value == null) return <span className="delta neutral">{t("delta.new")}</span>;
  const good = inverse ? value < 0 : value > 0;
  const flat = Math.abs(value) < 1;
  const cls = flat ? "neutral" : good ? "up" : "down";
  const arrow = flat ? "→" : value > 0 ? "▲" : "▼";
  return (
    <span className={`delta ${cls}`}>
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

export function Flag({ flag }: { flag: string | null }) {
  const { t } = useI18n();
  if (!flag) return null;
  const key = FLAG_KEY[flag];
  return <span className={`flag flag-${flag}`}>{key ? t(key) : flag}</span>;
}

export function Card({ title, aside, children, className = "" }: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || aside) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {aside && <div className="card-aside">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
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
        <ul key={blocks.length}>
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
        blocks.push(<p key={blocks.length}>{inline(h)}</p>);
      }
    }
  }
  flush();
  return <div className="md">{blocks}</div>;
}
