import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("eyebrow text-ink-muted block", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "bg-surface-sunken border-line text-ink placeholder:text-ink-faint h-11 w-full rounded-[8px] border px-3 text-sm",
        "focus:border-crimson focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "bg-surface-sunken border-line text-ink h-11 w-full rounded-[8px] border px-3 text-sm",
        "focus:border-crimson focus:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="text-flare mt-1.5 text-sm">{children}</p>;
}
