import { Minus, Square, X } from "lucide-react";
import { api } from "../api";
import { useI18n } from "../i18n";

export default function TitleBar() {
  const { t } = useI18n();
  return (
    <div className="titlebar flex h-12 shrink-0 items-center justify-end gap-1 px-2">
      <button type="button" aria-label={t("window.minimize")} className="grid size-11 place-items-center rounded-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => void api.windowMinimize()}>
        <Minus className="size-4" />
      </button>
      <button type="button" aria-label={t("window.maximize")} className="grid size-11 place-items-center rounded-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => void api.windowToggleMaximize()}>
        <Square className="size-3.5" />
      </button>
      <button type="button" aria-label={t("window.close")} className="grid size-11 place-items-center rounded-md hover:bg-destructive hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => void api.windowClose()}>
        <X className="size-4" />
      </button>
    </div>
  );
}
