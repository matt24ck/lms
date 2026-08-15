import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guards";
import { formatDateTime, isFuture } from "@/lib/format";
import {
  GameweekStatus,
  MemberStatus,
  PickOutcome,
} from "@/generated/prisma/enums";
import {
  SettleGameweekForm,
  type SettleFixture,
} from "@/components/admin/settle-gameweek-form";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

export const metadata: Metadata = { title: "End gameweek" };

export default async function SettleGameweekPage({
  params,
}: {
  params: Promise<{ leagueId: string; gameweekId: string }>;
}) {
  const { leagueId, gameweekId } = await params;
  await requireAdmin();

  const gameweek = await prisma.gameweek.findUnique({
    where: { id: gameweekId },
    include: {
      league: { select: { id: true, name: true, season: true } },
      fixtures: { orderBy: { kickoff: "asc" } },
      winningTeams: { orderBy: { teamName: "asc" } },
      picks: {
        include: {
          member: {
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!gameweek || gameweek.leagueId !== leagueId) notFound();

  const aliveMembers = await prisma.leagueMember.findMany({
    where: { leagueId, status: MemberStatus.ALIVE },
    include: { user: { select: { name: true } } },
  });

  // Only picks from players who were still alive going into this gameweek
  // matter for the survival maths.
  const aliveIds = new Set(aliveMembers.map((m) => m.id));
  const relevantPicks = gameweek.picks.filter((p) => aliveIds.has(p.memberId));

  const pickCounts = new Map<number, number>();
  for (const pick of relevantPicks) {
    pickCounts.set(
      pick.teamExternalId,
      (pickCounts.get(pick.teamExternalId) ?? 0) + 1,
    );
  }

  const fixtures: SettleFixture[] = gameweek.fixtures.map((fixture) => ({
    id: fixture.id,
    homeTeamId: fixture.homeTeamId,
    homeTeamName: fixture.homeTeamName,
    awayTeamId: fixture.awayTeamId,
    awayTeamName: fixture.awayTeamName,
    kickoff: fixture.kickoff.toISOString(),
    homePicks: pickCounts.get(fixture.homeTeamId) ?? 0,
    awayPicks: pickCounts.get(fixture.awayTeamId) ?? 0,
  }));

  const playersWithoutPick = aliveMembers.filter(
    (member) => !relevantPicks.some((pick) => pick.memberId === member.id),
  );

  const isSettled = gameweek.status === GameweekStatus.SETTLED;

  return (
    <>
      <PageHeader
        eyebrow={`${gameweek.league.name} · Matchday ${gameweek.matchday}`}
        title={`Gameweek ${gameweek.weekNumber}`}
        description={`Deadline ${formatDateTime(gameweek.deadline)}. Mark the teams that won, then end the gameweek to process eliminations.`}
        actions={
          <ButtonLink
            href={`/admin/leagues/${leagueId}`}
            variant="secondary"
            size="sm"
          >
            Back to league
          </ButtonLink>
        }
      />

      {isSettled ? (
        <div className="space-y-8">
          <Alert
            tone={gameweek.isVoid ? "info" : "success"}
            title={gameweek.isVoid ? "Gameweek voided" : "Gameweek settled"}
          >
            {gameweek.isVoid
              ? "Every remaining player's team failed, so this gameweek was voided. Nobody was eliminated and those teams became selectable again."
              : `Settled ${gameweek.settledAt ? formatDateTime(gameweek.settledAt) : ""}. Winning teams: ${
                  gameweek.winningTeams.length > 0
                    ? gameweek.winningTeams.map((t) => t.teamName).join(", ")
                    : "none recorded"
                }.`}
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Picks and outcomes</CardTitle>
              <CardDescription>
                How every player fared in gameweek {gameweek.weekNumber}.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <TableWrap className="rounded-none border-0">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Player</Th>
                      <Th>Pick</Th>
                      <Th>Outcome</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {gameweek.picks.map((pick) => (
                      <Tr key={pick.id}>
                        <Td>{pick.member.user.name ?? "Player"}</Td>
                        <Td className="font-display font-bold uppercase">
                          {pick.teamName}
                        </Td>
                        <Td>
                          {pick.outcome === PickOutcome.WON ? (
                            <Badge tone="alive">Won</Badge>
                          ) : pick.outcome === PickOutcome.LOST ? (
                            <Badge tone="out">Lost</Badge>
                          ) : pick.outcome === PickOutcome.VOID ? (
                            <Badge tone="gold">Void</Badge>
                          ) : (
                            <Badge tone="pending">Pending</Badge>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-8">
          {playersWithoutPick.length > 0 ? (
            <Alert tone="error" title="Players with no pick">
              {playersWithoutPick.map((m) => m.user.name ?? "Player").join(", ")}{" "}
              did not submit a pick and will be eliminated when you end this
              gameweek.
            </Alert>
          ) : null}

          {gameweek.status === GameweekStatus.OPEN &&
          isFuture(gameweek.deadline) ? (
            <Alert tone="info" title="Deadline has not passed">
              Picks are still open until {formatDateTime(gameweek.deadline)}.
              You can still settle now, but late players will be eliminated.
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                Set each match, then end the gameweek. Anything other than a win
                for a player&apos;s team knocks them out.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettleGameweekForm
                leagueId={leagueId}
                gameweekId={gameweek.id}
                weekNumber={gameweek.weekNumber}
                fixtures={fixtures}
                playersWithoutPick={playersWithoutPick.length}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
