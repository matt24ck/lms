import { prisma } from "@/lib/prisma";
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
import { UndoSelectionButton } from "@/components/admin/undo-selection-button";
import { GrantFreePassButton } from "@/components/admin/grant-free-pass-button";

export default async function AdminSelectionsPage() {
  const activeCompetition = await prisma.competition.findFirst({
    where: { status: "ACTIVE" },
    include: {
      gameweeks: { orderBy: { weekNumber: "desc" } },
    },
  });

  if (!activeCompetition) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">No active competition.</p>
        </CardContent>
      </Card>
    );
  }

  const gameweeks = activeCompetition.gameweeks;

  // Get selections for each gameweek
  const selectionsData = await Promise.all(
    gameweeks.slice(0, 5).map(async (gw) => {
      const selections = await prisma.selection.findMany({
        where: { gameweekId: gw.id },
        include: {
          user: { select: { discordUsername: true } },
        },
        orderBy: { teamName: "asc" },
      });

      const freePasses = await prisma.freePass.findMany({
        where: { gameweekId: gw.id },
      });

      return { gameweek: gw, selections, freePasses };
    })
  );

  return (
    <div className="space-y-6">
      {selectionsData.map(({ gameweek, selections, freePasses }) => {
        const freePassUserIds = new Set(freePasses.map((fp) => fp.userId));

        return (
          <Card key={gameweek.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading uppercase">
                  Gameweek {gameweek.weekNumber}
                </CardTitle>
                <Badge variant="secondary">{gameweek.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {selections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No selections yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Free Pass</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selections.map((sel) => (
                      <TableRow key={sel.id}>
                        <TableCell className="font-medium">
                          {sel.user.discordUsername}
                        </TableCell>
                        <TableCell>{sel.teamName}</TableCell>
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
                          {freePassUserIds.has(sel.userId) ? (
                            <Badge variant="outline">Granted</Badge>
                          ) : (
                            <GrantFreePassButton
                              userId={sel.userId}
                              gameweekId={gameweek.id}
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <UndoSelectionButton selectionId={sel.id} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
