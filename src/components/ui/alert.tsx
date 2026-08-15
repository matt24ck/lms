import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "error";

const tones: Record<Tone, { wrap: string; Icon: typeof Info }> = {
  info: { wrap: "bg-surface-raised border-line text-ink-muted", Icon: Info },
  success: {
    wrap: "bg-[#12301a] border-[#1d5c2c] text-pitch",
    Icon: CheckCircle2,
  },
  error: {
    wrap: "bg-crimson-night border-crimson-deep text-flare",
    Icon: AlertTriangle,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { wrap, Icon } = tones[tone];

  return (
    <div
      className={cn("flex gap-3 rounded-[8px] border p-4 text-sm", wrap, className)}
      role={tone === "error" ? "alert" : undefined}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title ? (
          <p className="font-display font-bold tracking-[0.04em] uppercase">
            {title}
          </p>
        ) : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}
