import { requireUser } from "@/lib/guards";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * Everything under (app) requires a signed-in player. Because database
 * sessions need Prisma — which cannot run in edge middleware — this layout is
 * the authoritative gate rather than middleware.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <>
      <SiteHeader />
      <div className="shell flex-1 py-10">{children}</div>
    </>
  );
}
