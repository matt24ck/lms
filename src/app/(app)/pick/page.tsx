import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TeamGrid } from "@/components/team-grid";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { format } from "date-fns";

export default async function PickPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeCompetition = await prisma.competition.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeCompetition) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">
          Make Your Pick
        </h1>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No active competition right now.
          </p>
        </div>
      </div>
    );
  }

  const competitionUser = await prisma.competitionUser.findUnique({
    where: {
      userId_competitionId: {
        userId: session.user.id,
        competitionId: activeCompetition.id,
      },
    },
  });

  if (!competitionUser) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">
          Make Your Pick
        </h1>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            You are not in the current competition. Ask the admin to add you.
          </p>
        </div>
      </div>
    );
  }

  const currentGameweek = await prisma.gameweek.findFirst({
    where: {
      competitionId: activeCompetition.id,
      status: { in: ["UPCOMING", "ACTIVE"] },
    },
    orderBy: { weekNumber: "asc" },
  });

  if (!currentGameweek) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">
          Make Your Pick
        </h1>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No gameweek available for picks right now.
          </p>
        </div>
      </div>
    );
  }

  const teams = await prisma.team.findMany({
    orderBy: { shortName: "asc" },
  });

  // Fetch fixtures for this gameweek to show opponents
  const fixtures = await prisma.fixture.findMany({
    where: { gameweekId: currentGameweek.id },
  });

  const fixtureMap: Record<number, { opponent: string; isHome: boolean }> = {};
  for (const f of fixtures) {
    fixtureMap[f.homeTeamId] = { opponent: f.awayTeam, isHome: true };
    fixtureMap[f.awayTeamId] = { opponent: f.homeTeam, isHome: false };
  }

  // Get all teams the user has already used in this competition
  const usedSelections = await prisma.selection.findMany({
    where: {
      userId: session.user.id,
      gameweek: { competitionId: activeCompetition.id },
      NOT: { gameweekId: currentGameweek.id },
    },
    include: { gameweek: { select: { weekNumber: true } } },
  });

  const usedTeams = usedSelections.map((s) => ({
    teamApiId: s.teamApiId,
    weekNumber: s.gameweek.weekNumber,
  }));

  const currentSelection = await prisma.selection.findUnique({
    where: {
      userId_gameweekId: {
        userId: session.user.id,
        gameweekId: currentGameweek.id,
      },
    },
  });

  const isLocked =
    currentGameweek.status === "ACTIVE" ||
    new Date() > currentGameweek.deadline;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">
            Make Your Pick
          </h1>
          <p className="text-muted-foreground">
            Gameweek {currentGameweek.weekNumber}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Deadline
          </div>
          <p className="font-heading font-bold">
            {format(currentGameweek.deadline, "EEE d MMM, HH:mm")} UTC
          </p>
        </div>
      </div>

      {competitionUser.isEliminated && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4">
          <p className="font-medium text-destructive">
            You have been eliminated from this competition.
          </p>
        </div>
      )}

      {isLocked && !competitionUser.isEliminated && (
        <div className="rounded-xl border border-border bg-muted p-4">
          <Badge variant="secondary">Locked</Badge>
          <p className="mt-1 text-sm text-muted-foreground">
            Selections are locked for this gameweek.
          </p>
        </div>
      )}

      {currentSelection && (
        <div className="rounded-xl border border-primary/50 bg-primary/10 p-4">
          <p className="text-sm text-muted-foreground">Your current pick:</p>
          <p className="font-heading text-xl font-bold">
            {currentSelection.teamName}
          </p>
          {!isLocked && (
            <p className="mt-1 text-xs text-muted-foreground">
              You can change your pick before the deadline.
            </p>
          )}
        </div>
      )}

      <TeamGrid
        teams={teams.map((t) => ({
          apiTeamId: t.apiTeamId,
          name: t.name,
          shortName: t.shortName,
          tla: t.tla,
          crestUrl: t.crestUrl,
        }))}
        usedTeams={usedTeams}
        currentSelectionTeamId={currentSelection?.teamApiId ?? null}
        gameweekId={currentGameweek.id}
        gameweekNumber={currentGameweek.weekNumber}
        isLocked={isLocked}
        isEliminated={competitionUser.isEliminated}
        fixtures={fixtureMap}
      />
    </div>
  );
}
