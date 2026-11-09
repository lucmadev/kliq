import { cn } from "@/lib/utils";

/** Kliq's mark: a rising play-count line in the creator's accent. */
export function Mark({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary", className)} aria-hidden>
      <svg className="size-[18px] fill-none stroke-current text-primary-foreground" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 32 32">
        <path d="M6 23l7-8 5 5 8-11" />
      </svg>
    </span>
  );
}
