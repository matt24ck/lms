import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Wrap tables so wide content scrolls itself instead of the page body. */
export function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-line w-full overflow-x-auto rounded-[12px] border",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full border-collapse text-left text-sm", className)}
      {...props}
    />
  );
}

export function Thead({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={cn("bg-surface-sunken text-ink-muted", className)}
      {...props}
    />
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "eyebrow border-line border-b px-4 py-3 font-bold whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function Tbody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={className} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-line hover:bg-surface-raised/60 border-b transition-colors last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}
