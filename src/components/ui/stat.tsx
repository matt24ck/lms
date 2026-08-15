import { cn } from "@/lib/utils";

/** Stat tile in the style of the PSA reporting dashboard. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "crimson" | "gold" | "pitch";
  className?: string;
}) {
  const valueTone = {
    default: "text-ink",
    crimson: "text-flare",
    gold: "text-gold",
    pitch: "text-pitch",
  }[tone];

  return (
    <div
      className={cn(
        "bg-surface border-line rounded-[12px] border p-4",
        className,
      )}
    >
      <p className="eyebrow text-ink-faint">{label}</p>
      <p
        className={cn(
          "font-display mt-2 text-3xl leading-none font-extrabold",
          valueTone,
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-ink-muted mt-1.5 text-xs">{hint}</p> : null}
    </div>
  );
}
