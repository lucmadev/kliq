import { useEffect, useRef } from "react";
import {
  Cable,
  ChartColumn,
  Clapperboard,
  KeyRound,
  Link2,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { slideWidth } from "../motion";
import { cn } from "@/lib/utils";
import { useI18n } from "../i18n";
import type { MessageKey } from "../../../shared/i18n";
import type { SettingsSection } from "../pages/Settings";

export type View = "analytics" | "videos" | SettingsSection;

const main: { id: View; icon: LucideIcon; label: MessageKey }[] = [
  { id: "analytics", icon: ChartColumn, label: "nav.analytics" },
  { id: "videos", icon: Clapperboard, label: "nav.videos" },
];

const settings: { id: SettingsSection; icon: LucideIcon; label: MessageKey }[] = [
  { id: "appearance", icon: Palette, label: "nav.appearance" },
  { id: "model", icon: KeyRound, label: "nav.model" },
  { id: "mcp", icon: Cable, label: "nav.mcp" },
  { id: "connection", icon: Link2, label: "nav.connection" },
];

export default function Sidebar({ view, expanded, onExpand, onSelect }: {
  view: View;
  expanded: boolean;
  onExpand: (next: boolean) => void;
  onSelect: (view: View) => void;
}) {
  const { t } = useI18n();
  const aside = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = aside.current;
    if (!el) return;
    el.classList.remove("w-16");
    slideWidth(el, expanded ? 224 : 64);
  }, [expanded]);

  const item = (id: View, Icon: LucideIcon, label: MessageKey) => (
    <button
      key={id}
      type="button"
      aria-label={t(label)}
      aria-current={view === id ? "page" : undefined}
      onClick={() => onSelect(id)}
      className={cn(
        "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        view === id && "bg-accent text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {expanded ? (
        <span className="truncate">{t(label)}</span>
      ) : (
        <span className="pointer-events-none absolute left-full z-20 ml-2 hidden rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow group-hover:block group-focus-visible:block">
          {t(label)}
        </span>
      )}
    </button>
  );

  return (
    <aside ref={aside} className="flex h-full w-16 shrink-0 flex-col gap-1 overflow-hidden border-r bg-card px-2 py-3">
      <div className="mb-2 grid size-10 place-items-center rounded-[10px] bg-primary" aria-hidden>
        <svg className="size-5 fill-none stroke-current text-primary-foreground stroke-[3]" viewBox="0 0 32 32"><path d="M8 22l6-7 4 4 6-9" /></svg>
      </div>
      {main.map((entry) => item(entry.id, entry.icon, entry.label))}
      <div className="mt-auto flex flex-col gap-1 border-t pt-2">
        {expanded && <div className="px-3 py-1 text-xs text-muted-foreground">{t("nav.settings")}</div>}
        {settings.map((entry) => item(entry.id, entry.icon, entry.label))}
        <button
          type="button"
          aria-label={t(expanded ? "nav.collapse" : "nav.expand")}
          title={t(expanded ? "nav.collapse" : "nav.expand")}
          onClick={() => onExpand(!expanded)}
          className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {expanded ? <PanelLeftClose className="size-4 shrink-0" /> : <PanelLeftOpen className="size-4 shrink-0" />}
          {expanded && <span>{t("nav.collapse")}</span>}
        </button>
      </div>
    </aside>
  );
}
