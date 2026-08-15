import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Tone = "alive" | "out" | "pending" | "gold" | "neutral" | "crimson";

const tones: Record<Tone, string> = {
  alive: "bg-[#12301a] text-pitch border-[#1d5c2c]",
  out: "bg-crimson-night text-flare border-crimson-deep",
  pending: "bg-surface-raised text-ink-muted border-line-bright",
  gold: "bg-[#3a2f0b] text-gold border-[#6b5410]",
  crimson: "bg-crimson text-ink-soft border-crimson-bright",
  neutral: "bg-surface-sunken text-ink-muted border-line",
};

interface BadgeProps extends ComponentProps<"span"> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
