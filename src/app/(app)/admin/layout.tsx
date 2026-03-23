import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/selections", label: "Selections" },
  { href: "/admin/statistics", label: "Statistics" },
  { href: "/admin/gameweeks", label: "Gameweeks" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user.isAdmin) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-primary">
          Admin Panel
        </h1>
        <nav className="mt-4 flex flex-wrap gap-2">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
