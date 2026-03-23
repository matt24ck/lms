import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AdminOverviewPage() {
  const activeCompetition = await prisma.competition.findFirst({
    where: { status: "ACTIVE" },
    include: {
      _count: { select: { competitionUsers: true, gameweeks: true } },
      gameweeks: { orderBy: { weekNumber: "desc" }, take: 1 },
    },
  });

  const aliveCount = activeCompetition
    ? await prisma.competitionUser.count({
        where: {
          competitionId: activeCompetition.id,
          isEliminated: false,
        },
      })
    : 0;

  const currentGameweek = activeCompetition?.gameweeks[0] ?? null;

  const pickedCount = currentGameweek
    ? await prisma.selection.count({
        where: { gameweekId: currentGameweek.id },
      })
    : 0;

  const notPickedCount = aliveCount - pickedCount;

  return (
    <div className="space-y-6">
      {!activeCompetition && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              No active competition. Create one to get started.
            </p>
            <Link href="/admin/gameweeks">
              <Button>Create Competition</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {activeCompetition && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Competition
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-heading text-lg font-bold">
                  {activeCompetition.name}
                </p>
                <Badge className="mt-1">{activeCompetition.status}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Players Alive
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-heading text-3xl font-bold text-[#22c55e]">
                  {aliveCount}
                </p>
                <p className="text-xs text-muted-foreground">
                  of {activeCompetition._count.competitionUsers} total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Current Gameweek
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-heading text-3xl font-bold">
                  {currentGameweek?.weekNumber ?? "-"}
                </p>
                <Badge variant="secondary" className="mt-1">
                  {currentGameweek?.status ?? "N/A"}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Picks This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-heading text-3xl font-bold">{pickedCount}</p>
                {notPickedCount > 0 && (
                  <p className="text-xs text-destructive">
                    {notPickedCount} still need to pick
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
