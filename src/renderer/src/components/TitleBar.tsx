import { Minus, Square, X } from "lucide-react";
import { api } from "../api";
import { useI18n } from "../i18n";

const BUTTON = "grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The frameless window's own controls. They sit at the right end of the page's title row. */
export default function WindowControls() {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 items-center gap-0.5 max-[760px]:hidden">
      <button type="button" aria-label={t("window.minimize")} className={BUTTON} onClick={() => void api.windowMinimize()}>
        <Minus className="size-4" strokeWidth={1.75} />
      </button>
      <button type="button" aria-label={t("window.maximize")} className={BUTTON} onClick={() => void api.windowToggleMaximize()}>
        <Square className="size-3.5" strokeWidth={1.75} />
      </button>
      <button type="button" aria-label={t("window.close")} className={`${BUTTON} hover:bg-destructive hover:text-white`} onClick={() => void api.windowClose()}>
        <X className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
