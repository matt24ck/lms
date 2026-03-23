import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function HistoryPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeCompetition = await prisma.competition.findFirst({
    where: { status: "ACTIVE" },
  });

  const selections = activeCompetition
    ? await prisma.selection.findMany({
        where: {
          userId: session.user.id,
          gameweek: { competitionId: activeCompetition.id },
        },
        include: {
          gameweek: { select: { weekNumber: true, deadline: true } },
        },
        orderBy: { gameweek: { weekNumber: "desc" } },
      })
    : [];

  const freePasses = activeCompetition
    ? await prisma.freePass.findMany({
        where: {
          userId: session.user.id,
          gameweek: { competitionId: activeCompetition.id },
        },
        include: {
          gameweek: { select: { weekNumber: true } },
        },
      })
    : [];

  const freePassWeeks = new Set(
    freePasses.map((fp) => fp.gameweek.weekNumber)
  );

  const wins = selections.filter((s) => s.result === "WIN").length;
  const losses = selections.filter(
    (s) => s.result === "LOSS" || s.result === "DRAW"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight">
          Pick History
        </h1>
        <p className="text-muted-foreground">
          Your selections across {activeCompetition?.name ?? "the competition"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="font-heading text-4xl font-bold text-[#22c55e]">
              {wins}
            </div>
            <p className="text-sm text-muted-foreground">Wins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="font-heading text-4xl font-bold text-destructive">
              {losses}
            </div>
            <p className="text-sm text-muted-foreground">Losses / Draws</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="font-heading text-4xl font-bold">
              {selections.length}
            </div>
            <p className="text-sm text-muted-foreground">Total Picks</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading uppercase">All Picks</CardTitle>
        </CardHeader>
        <CardContent>
          {selections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No picks made yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GW</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Free Pass</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selections.map((sel) => (
                  <TableRow key={sel.id}>
                    <TableCell className="font-heading font-bold">
                      {sel.gameweek.weekNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      {sel.teamName}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      {freePassWeeks.has(sel.gameweek.weekNumber) && (
                        <Badge variant="outline">Free Pass</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
