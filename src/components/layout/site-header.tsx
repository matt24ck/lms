import Image from "next/image";
import Link from "next/link";
import { Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "@/components/auth-buttons";
import { cn } from "@/lib/utils";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-line bg-surface-sunken/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="shell flex h-16 items-center justify-between gap-2 sm:gap-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="bg-crimson font-display flex size-8 items-center justify-center rounded-[8px] text-sm font-black text-white">
            LMS
          </span>
          <span className="font-display hidden text-sm font-extrabold tracking-[0.08em] uppercase sm:block">
            Last Man Standing
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/dashboard">Dashboard</NavLink>
          {user?.isAdmin ? (
            <NavLink href="/admin">
              <Shield className="size-3.5" aria-hidden />
              Admin
            </NavLink>
          ) : null}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden items-center gap-2 sm:flex">
                {user.image ? (
                  <Image
                    src={user.image}
                    alt=""
                    width={28}
                    height={28}
                    className="border-line rounded-full border"
                  />
                ) : null}
                <span className="text-ink-muted max-w-[10rem] truncate text-sm">
                  {user.name ?? "Player"}
                </span>
              </span>
              <SignOutButton />
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-display text-ink-muted hover:bg-surface-raised hover:text-ink inline-flex items-center gap-1.5 rounded-[8px] px-2 py-2 text-xs font-bold tracking-[0.06em] uppercase transition-colors sm:px-3",
        className,
      )}
    >
      {children}
    </Link>
  );
}
