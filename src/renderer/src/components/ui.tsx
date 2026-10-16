import type { ReactNode } from "react";
import { pct } from "../format";

export function Delta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value == null) return <span className="delta neutral">nuevo</span>;
  const good = inverse ? value < 0 : value > 0;
  const flat = Math.abs(value) < 1;
  const cls = flat ? "neutral" : good ? "up" : "down";
  const arrow = flat ? "→" : value > 0 ? "▲" : "▼";
  return (
    <span className={`delta ${cls}`}>
      <span aria-hidden>{arrow}</span> {pct(value)}
    </span>
  );
}

const FLAG_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  outlier: "Outlier",
  subiendo: "Subiendo",
  cayendo: "Cayendo",
};

export function Flag({ flag }: { flag: string | null }) {
  if (!flag) return null;
  return <span className={`flag flag-${flag}`}>{FLAG_LABEL[flag] ?? flag}</span>;
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

/** Markdown mínimo para el resumen IA: **negrita**, bullets y párrafos. */
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
