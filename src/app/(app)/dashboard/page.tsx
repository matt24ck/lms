import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, Target, Users, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JoinCompetitionForm } from "@/components/join-competition-form";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeCompetition = await prisma.competition.findFirst({
    where: { status: "ACTIVE" },
    include: {
      gameweeks: {
        orderBy: { weekNumber: "desc" },
        take: 1,
      },
      competitionUsers: {
        where: { isEliminated: false },
      },
      _count: {
        select: { competitionUsers: true },
      },
    },
  });

  const competitionUser = activeCompetition
    ? await prisma.competitionUser.findUnique({
        where: {
          userId_competitionId: {
            userId: session.user.id,
            competitionId: activeCompetition.id,
          },
        },
      })
    : null;

  const currentGameweek = activeCompetition?.gameweeks[0] ?? null;

  const currentSelection = currentGameweek
    ? await prisma.selection.findUnique({
        where: {
          userId_gameweekId: {
            userId: session.user.id,
            gameweekId: currentGameweek.id,
          },
        },
      })
    : null;

  const recentSelections = activeCompetition
    ? await prisma.selection.findMany({
        where: { userId: session.user.id },
        include: { gameweek: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  const alive = activeCompetition?.competitionUsers.length ?? 0;
  const total = activeCompetition?._count.competitionUsers ?? 0;
  const isEliminated = competitionUser?.isEliminated ?? false;
  const isInCompetition = !!competitionUser;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user.name}
        </p>
      </div>

      {/* Status Banner */}
      {isInCompetition && (
        <div
          className={`rounded-xl border p-6 ${
            isEliminated
              ? "border-destructive/50 bg-destructive/10"
              : "border-[#22c55e]/50 bg-[#22c55e]/10"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                isEliminated ? "bg-destructive" : "bg-[#22c55e]"
              }`}
            />
            <span className="font-heading text-xl font-bold uppercase">
              {isEliminated ? "Eliminated" : "You Are Alive"}
            </span>
          </div>
        </div>
      )}

      {!isInCompetition && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading uppercase">
              Join a Competition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <JoinCompetitionForm />
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gameweek
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold">
              {currentGameweek?.weekNumber ?? "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Players Alive
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-heading text-3xl font-bold text-[#22c55e]">
              {alive}
            </div>
            <p className="text-xs text-muted-foreground">of {total} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Your Pick
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-heading text-lg font-bold">
              {currentSelection?.teamName ?? "None"}
            </div>
            {currentSelection && (
              <Badge
                variant={
                  currentSelection.result === "WIN"
                    ? "default"
                    : currentSelection.result === "PENDING"
                      ? "secondary"
                      : "destructive"
                }
                className="mt-1"
              >
                {currentSelection.result}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Competition
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-heading text-lg font-bold">
              {activeCompetition?.name ?? "None"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {isInCompetition && !isEliminated && (
        <div className="flex gap-4">
          <Link href="/pick">
            <Button size="lg">Make Your Pick</Button>
          </Link>
          <Link href="/fixtures">
            <Button size="lg" variant="secondary">
              View Fixtures
            </Button>
          </Link>
        </div>
      )}

      {/* Recent Results */}
      {recentSelections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading uppercase">
              Recent Picks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSelections.map((sel) => (
                <div
                  key={sel.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
                >
                  <div>
                    <span className="text-sm text-muted-foreground">
                      GW {sel.gameweek.weekNumber}
                    </span>
                    <p className="font-medium">{sel.teamName}</p>
                  </div>
                  <Badge
                    variant={
                      sel.result === "WIN"
                        ? "default"
                        : sel.result === "PENDING"
                          ? "secondary"
                          : "destructive"
                    }
                    className={
                      sel.result === "WIN"
                        ? "bg-[#22c55e] hover:bg-[#22c55e]/80"
                        : ""
                    }
                  >
                    {sel.result}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
