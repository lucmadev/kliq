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
  X,
  type LucideIcon,
} from "lucide-react";
import { slideWidth } from "../motion";
import { Mark } from "./Mark";
import { cn } from "@/lib/utils";
import type { Status } from "../api";
import { ago, num } from "../format";
import { useI18n } from "../i18n";
import type { MessageKey } from "../../../shared/i18n";
import type { SettingsSection } from "../pages/Settings";

export type View = "analytics" | "videos" | SettingsSection;

export const NAV_LABEL: Record<View, MessageKey> = {
  analytics: "nav.analytics",
  videos: "nav.videos",
  appearance: "nav.appearance",
  model: "nav.model",
  mcp: "nav.mcp",
  connection: "nav.connection",
};

const main: { id: View; icon: LucideIcon }[] = [
  { id: "analytics", icon: ChartColumn },
  { id: "videos", icon: Clapperboard },
];

const settings: { id: SettingsSection; icon: LucideIcon }[] = [
  { id: "appearance", icon: Palette },
  { id: "model", icon: KeyRound },
  { id: "mcp", icon: Cable },
  { id: "connection", icon: Link2 },
];

const WIDE = 240;
const RAIL = 64;

export default function Sidebar({ view, status, expanded, menuOpen, onExpand, onSelect, onCloseMenu }: {
  view: View;
  status: Status;
  expanded: boolean;
  menuOpen: boolean;
  onExpand: (next: boolean) => void;
  onSelect: (view: View) => void;
  onCloseMenu: () => void;
}) {
  const { t, locale } = useI18n();
  const aside = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const el = aside.current;
    if (!el) return;
    const width = expanded ? WIDE : RAIL;
    if (first.current) {
      first.current = false;
      el.style.width = `${width}px`;
      return;
    }
    slideWidth(el, width);
  }, [expanded]);

  // The phone sheet always shows labels; the rail is a desktop choice.
  const labelled = expanded || menuOpen;
  const channel = status.channel;
  const initial = (channel?.title ?? "K").trim().charAt(0).toUpperCase();
  const synced = status.last_sync?.finished_at ?? null;

  const item = (id: View, Icon: LucideIcon) => {
    const active = view === id;
    return (
      <button
        key={id}
        type="button"
        aria-label={t(NAV_LABEL[id])}
        aria-current={active ? "page" : undefined}
        onClick={() => onSelect(id)}
        className={cn(
          "group relative flex h-8 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-[760px]:h-11",
          active && "bg-tint-100 font-medium text-tint-ink hover:bg-tint-100 hover:text-tint-ink",
        )}
      >
        <Icon className={cn("size-4 shrink-0", active && "text-primary")} strokeWidth={1.75} />
        {labelled ? (
          <span className="truncate">{t(NAV_LABEL[id])}</span>
        ) : (
          <span className="pointer-events-none absolute left-full z-20 ml-2 hidden rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
            {t(NAV_LABEL[id])}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      ref={aside}
      aria-label={t("nav.menu")}
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden px-3 pb-3",
        !menuOpen && "max-[760px]:hidden",
        menuOpen && "max-[760px]:fixed max-[760px]:inset-0 max-[760px]:z-40 max-[760px]:flex max-[760px]:!w-full max-[760px]:bg-background max-[760px]:px-4",
      )}
      style={{ width: expanded ? WIDE : RAIL }}
    >
      <div className="titlebar flex h-14 shrink-0 items-center gap-2.5 px-1">
        <Mark />
        {labelled && <span className="text-[1.0625rem] font-semibold tracking-[-0.01em]">Kliq</span>}
        {menuOpen && (
          <button type="button" aria-label={t("window.close")} onClick={onCloseMenu}
            className="ml-auto hidden size-11 place-items-center rounded-lg hover:bg-accent max-[760px]:grid">
            <X className="size-5" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSelect("connection")}
        aria-label={t("nav.channel")}
        title={channel?.title ?? t("app.no_channel")}
        className="mt-1 mb-4 flex h-12 shrink-0 items-center gap-2.5 rounded-xl px-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {channel?.thumbnail ? (
          <img src={channel.thumbnail} alt="" className="size-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-tint-100 text-sm font-semibold text-tint-ink" aria-hidden>{initial}</span>
        )}
        {labelled && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{channel?.title ?? t("app.brand_fallback")}</span>
            <span className="num block truncate text-xs text-muted-foreground">
              {channel ? t("app.subscribers", { count: num(channel.subscribers, locale) }) : t("app.no_channel")}
            </span>
          </span>
        )}
      </button>

      <nav className="flex flex-col gap-0.5">
        {main.map((entry) => item(entry.id, entry.icon))}
      </nav>

      <div className="mt-7 flex flex-col gap-0.5">
        {labelled ? (
          <div className="px-2.5 pb-1.5 text-xs text-muted-foreground">{t("nav.settings")}</div>
        ) : (
          <div className="mx-2.5 mb-2 h-px bg-border" />
        )}
        {settings.map((entry) => item(entry.id, entry.icon))}
      </div>

      <div className="mt-auto flex flex-col gap-1 pt-3">
        {labelled && (
          <p className="px-2.5 pb-1 text-xs text-muted-foreground" title={synced ?? undefined}>
            {status.syncing
              ? t("conn.syncing")
              : synced ? t("sidebar.synced", { when: ago(synced, locale) }) : t("sidebar.never_synced")}
          </p>
        )}
        <button
          type="button"
          aria-label={t(expanded ? "nav.collapse" : "nav.expand")}
          title={t(expanded ? "nav.collapse" : "nav.expand")}
          onClick={() => onExpand(!expanded)}
          className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-[760px]:hidden"
        >
          {expanded ? <PanelLeftClose className="size-4 shrink-0" strokeWidth={1.75} /> : <PanelLeftOpen className="size-4 shrink-0" strokeWidth={1.75} />}
          {expanded && <span>{t("nav.collapse")}</span>}
        </button>
      </div>
    </aside>
  );
}
