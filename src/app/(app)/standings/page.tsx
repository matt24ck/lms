import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function StandingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeCompetition = await prisma.competition.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeCompetition) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">
          Standings
        </h1>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No active competition.</p>
        </div>
      </div>
    );
  }

  const competitionUsers = await prisma.competitionUser.findMany({
    where: { competitionId: activeCompetition.id },
    include: {
      user: {
        select: {
          name: true,
          image: true,
          discordUsername: true,
        },
      },
    },
    orderBy: [{ isEliminated: "asc" }, { joinedAt: "asc" }],
  });

  // Count survived gameweeks per user
  const selectionCounts = await prisma.selection.groupBy({
    by: ["userId"],
    where: {
      result: "WIN",
      gameweek: { competitionId: activeCompetition.id },
    },
    _count: true,
  });

  const winsMap = new Map(
    selectionCounts.map((s) => [s.userId, s._count])
  );

  const alive = competitionUsers.filter((cu) => !cu.isEliminated);
  const eliminated = competitionUsers.filter((cu) => cu.isEliminated);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">
          Standings
        </h1>
        <p className="text-muted-foreground">{activeCompetition.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="font-heading text-4xl font-bold text-[#22c55e]">
              {alive.length}
            </div>
            <p className="text-sm text-muted-foreground">Alive</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="font-heading text-4xl font-bold text-destructive">
              {eliminated.length}
            </div>
            <p className="text-sm text-muted-foreground">Eliminated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="font-heading text-4xl font-bold">
              {competitionUsers.length}
            </div>
            <p className="text-sm text-muted-foreground">Total Players</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading uppercase">All Players</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Wins</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitionUsers.map((cu, i) => (
                <TableRow
                  key={cu.id}
                  className={cu.isEliminated ? "opacity-50" : ""}
                >
                  <TableCell className="font-mono">{i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={cu.user.image ?? undefined} />
                        <AvatarFallback className="bg-muted text-xs">
                          {cu.user.name?.[0]?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {cu.user.discordUsername}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {cu.isEliminated ? (
                      <Badge variant="destructive">Eliminated</Badge>
                    ) : (
                      <Badge className="bg-[#22c55e] hover:bg-[#22c55e]/80">
                        Alive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-heading font-bold">
                    {winsMap.get(cu.userId) ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
