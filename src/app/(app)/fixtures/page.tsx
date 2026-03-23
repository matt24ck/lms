import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function FixturesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeCompetition = await prisma.competition.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeCompetition) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">
          Fixtures
        </h1>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No active competition.</p>
        </div>
      </div>
    );
  }

  const gameweeks = await prisma.gameweek.findMany({
    where: { competitionId: activeCompetition.id },
    include: {
      fixtures: {
        orderBy: { kickoff: "asc" },
      },
    },
    orderBy: { weekNumber: "desc" },
    take: 3,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">
        Fixtures
      </h1>

      {gameweeks.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No fixtures available yet. They will appear once the admin sets up
            gameweeks.
          </p>
        </div>
      )}

      {gameweeks.map((gw) => (
        <Card key={gw.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading uppercase">
                Gameweek {gw.weekNumber}
              </CardTitle>
              <Badge
                variant={
                  gw.status === "COMPLETED"
                    ? "secondary"
                    : gw.status === "ACTIVE"
                      ? "default"
                      : "outline"
                }
              >
                {gw.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {gw.fixtures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No fixtures loaded for this gameweek.
              </p>
            ) : (
              <div className="space-y-2">
                {gw.fixtures.map((fixture) => (
                  <div
                    key={fixture.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
                  >
                    <div className="flex-1 text-right">
                      <span className="font-medium">{fixture.homeTeam}</span>
                    </div>

                    <div className="mx-4 flex items-center gap-2">
                      {fixture.status === "FINISHED" ? (
                        <span className="font-heading text-lg font-bold">
                          {fixture.homeScore} - {fixture.awayScore}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {format(fixture.kickoff, "EEE HH:mm")}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <span className="font-medium">{fixture.awayTeam}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
