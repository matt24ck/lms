import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guards";
import { formatCountdown, formatDateTime, isPast } from "@/lib/format";
import { GameweekStatus, MemberStatus } from "@/generated/prisma/enums";
import { LaunchGameweekForm } from "@/components/admin/launch-gameweek-form";
import { LockGameweekButton } from "@/components/admin/lock-gameweek-button";
import {
  LifelineControl,
  ReviveButton,
} from "@/components/admin/member-actions";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}): Promise<Metadata> {
  const { leagueId } = await params;
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { name: true },
  });
  return { title: league ? `Manage ${league.name}` : "Manage league" };
}

export default async function AdminLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  await requireAdmin();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      gameweeks: {
        orderBy: { weekNumber: "desc" },
        include: {
          _count: { select: { picks: true, fixtures: true } },
        },
      },
    },
  });
  if (!league) notFound();

  const alive = league.members.filter((m) => m.status === MemberStatus.ALIVE);
  const openGameweek = league.gameweeks.find(
    (gw) => gw.status !== GameweekStatus.SETTLED,
  );

  const openGameweekPicks = openGameweek
    ? await prisma.pick.findMany({
        where: { gameweekId: openGameweek.id },
        select: {
          memberId: true,
          teamName: true,
          teamTla: true,
          teamExternalId: true,
        },
      })
    : [];
  const pickByMemberId = new Map(
    openGameweekPicks.map((pick) => [pick.memberId, pick]),
  );

  // Pick counts per team for the gameweek in play, surviving players only.
  // Teams nobody has picked don't get a column.
  const teamCountMap = new Map<
    number,
    { id: number; name: string; tla: string; count: number }
  >();
  const yetToPick: string[] = [];
  for (const member of alive) {
    const pick = pickByMemberId.get(member.id);
    if (!pick) {
      yetToPick.push(member.user.name ?? "Player");
      continue;
    }
    const entry = teamCountMap.get(pick.teamExternalId);
    if (entry) entry.count += 1;
    else
      teamCountMap.set(pick.teamExternalId, {
        id: pick.teamExternalId,
        name: pick.teamName,
        tla: pick.teamTla,
        count: 1,
      });
  }
  const teamCounts = [...teamCountMap.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  const maxCount = teamCounts[0]?.count ?? 0;
  yetToPick.sort((a, b) => a.localeCompare(b));
  const lastMatchday = league.gameweeks[0]?.matchday ?? 0;

  const launchBlockedReason =
    league.status === "COMPLETE"
      ? "This league has finished, so no further gameweeks can be launched."
      : openGameweek
        ? `Gameweek ${openGameweek.weekNumber} is still ${openGameweek.status.toLowerCase()}. End it before launching the next one.`
        : undefined;

  return (
    <>
      <PageHeader
        eyebrow={`Admin · ${league.season}`}
        title={league.name}
        description={`Join code ${league.joinCode} · ${league.members.length} player${league.members.length === 1 ? "" : "s"} enrolled.`}
        actions={
          <ButtonLink href="/admin" variant="secondary" size="sm">
            All leagues
          </ButtonLink>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Still standing" value={alive.length} tone="pitch" />
        <Stat
          label="Eliminated"
          value={league.members.length - alive.length}
          tone="crimson"
        />
        <Stat label="Gameweeks played" value={league.gameweeks.length} />
        <Stat
          label="League status"
          value={
            league.status === "IN_PROGRESS"
              ? "In progress"
              : league.status === "OPEN"
                ? "Open"
                : "Complete"
          }
          hint={
            league.status === "OPEN"
              ? "Players can join with the code until gameweek 1's picks close"
              : league.status === "IN_PROGRESS"
                ? "Closed to new players"
                : undefined
          }
        />
      </div>

      <div className="space-y-8">
        {/* Launch */}
        <Card>
          <CardHeader>
            <CardTitle>Launch next gameweek</CardTitle>
            <CardDescription>
              Pulls that matchday&apos;s fixtures and opens picks for every
              surviving player.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LaunchGameweekForm
              leagueId={league.id}
              nextWeekNumber={(league.gameweeks[0]?.weekNumber ?? 0) + 1}
              suggestedMatchday={Math.min(lastMatchday + 1, 38)}
              disabledReason={launchBlockedReason}
            />
          </CardContent>
        </Card>

        {/* Current picks */}
        {openGameweek ? (
          <section>
            <h2 className="display-3 rule-crimson mb-5">
              Gameweek {openGameweek.weekNumber} picks
            </h2>
            {teamCounts.length === 0 ? (
              <EmptyState
                title="No picks yet"
                description={
                  alive.length === 0
                    ? "There is nobody left to make a pick this gameweek."
                    : "Nobody has made a pick for this gameweek yet."
                }
              />
            ) : (
              <>
                <div className="border-line bg-surface w-full overflow-x-auto rounded-[12px] border p-5">
                  <div className="flex min-w-fit">
                    {teamCounts.map((team) => (
                      <div
                        key={team.id}
                        className="flex max-w-24 min-w-14 flex-1 flex-col"
                        title={`${team.name}: ${team.count} pick${team.count === 1 ? "" : "s"}`}
                      >
                        <div className="border-line flex h-40 flex-col items-center justify-end gap-1.5 border-b px-1.5">
                          <span className="text-ink-soft text-sm font-semibold tabular-nums">
                            {team.count}
                          </span>
                          <div
                            aria-hidden
                            className="bg-crimson w-full max-w-10 rounded-t-[4px]"
                            style={{
                              height: `${Math.max((team.count / maxCount) * 120, 4)}px`,
                            }}
                          />
                        </div>
                        <span
                          className="eyebrow text-ink-muted truncate pt-2 text-center"
                          title={team.name}
                        >
                          {team.tla}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {yetToPick.length > 0 ||
                openGameweek.status === GameweekStatus.OPEN ? (
                  <p className="text-ink-faint mt-3 text-xs">
                    {yetToPick.length > 0
                      ? `Yet to pick: ${yetToPick.join(", ")}. `
                      : null}
                    {openGameweek.status === GameweekStatus.OPEN
                      ? "Players can still change their pick until the deadline."
                      : null}
                  </p>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {/* Gameweeks */}
        <section>
          <h2 className="display-3 rule-crimson mb-5">Gameweeks</h2>
          {league.gameweeks.length === 0 ? (
            <EmptyState
              title="No gameweeks yet"
              description="Launch gameweek 1 to get the competition under way."
            />
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>GW</Th>
                    <Th>Matchday</Th>
                    <Th>Deadline</Th>
                    <Th>Status</Th>
                    <Th className="text-center">Picks</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {league.gameweeks.map((gameweek) => {
                    const deadlinePassed = isPast(gameweek.deadline);

                    return (
                      <Tr key={gameweek.id}>
                        <Td className="font-display font-bold">
                          {gameweek.weekNumber}
                        </Td>
                        <Td className="text-ink-muted">{gameweek.matchday}</Td>
                        <Td className="text-ink-muted text-xs">
                          {formatDateTime(gameweek.deadline)}
                          {gameweek.status === GameweekStatus.OPEN ? (
                            <span className="text-ink-faint block">
                              {formatCountdown(gameweek.deadline)}
                            </span>
                          ) : null}
                        </Td>
                        <Td>
                          {gameweek.isVoid ? (
                            <Badge tone="gold">Void</Badge>
                          ) : gameweek.status === GameweekStatus.SETTLED ? (
                            <Badge tone="neutral">Settled</Badge>
                          ) : gameweek.status === GameweekStatus.LOCKED ? (
                            <Badge tone="pending">Awaiting results</Badge>
                          ) : (
                            <Badge tone="alive">Open</Badge>
                          )}
                        </Td>
                        <Td className="text-center tabular-nums">
                          {gameweek._count.picks}
                          <span className="text-ink-faint">
                            /{alive.length}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-2">
                            {gameweek.status === GameweekStatus.OPEN &&
                            deadlinePassed ? (
                              <LockGameweekButton
                                leagueId={league.id}
                                gameweekId={gameweek.id}
                              />
                            ) : null}
                            {gameweek.status !== GameweekStatus.SETTLED ? (
                              <ButtonLink
                                href={`/admin/leagues/${league.id}/gameweeks/${gameweek.id}`}
                                size="sm"
                              >
                                End gameweek
                              </ButtonLink>
                            ) : (
                              <ButtonLink
                                href={`/admin/leagues/${league.id}/gameweeks/${gameweek.id}`}
                                variant="secondary"
                                size="sm"
                              >
                                View
                              </ButtonLink>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </section>

        {/* Players */}
        <section>
          <h2 className="display-3 rule-crimson mb-5">Players</h2>
          {league.members.length === 0 ? (
            <EmptyState
              title="Nobody has joined yet"
              description={`Share join code ${league.joinCode} so players can enter.`}
            />
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Player</Th>
                    <Th>Status</Th>
                    <Th className="text-center">Lifelines</Th>
                    <Th className="text-center">Pool round</Th>
                    <Th>Joined</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {league.members.map((member) => (
                    <Tr key={member.id}>
                      <Td>
                        <span className="font-medium">
                          {member.user.name ?? "Player"}
                        </span>
                      </Td>
                      <Td>
                        {member.status === MemberStatus.ALIVE ? (
                          <Badge tone="alive">In</Badge>
                        ) : (
                          <Badge tone="out">Out</Badge>
                        )}
                      </Td>
                      <Td className="text-center">
                        <LifelineControl
                          leagueId={league.id}
                          memberId={member.id}
                          lifelines={member.lifelines}
                        />
                      </Td>
                      <Td className="text-center tabular-nums">
                        {member.poolRound}
                      </Td>
                      <Td className="text-ink-muted text-xs">
                        {formatDateTime(member.joinedAt)}
                      </Td>
                      <Td>
                        {member.status === MemberStatus.ELIMINATED ? (
                          <ReviveButton
                            leagueId={league.id}
                            memberId={member.id}
                            playerName={member.user.name ?? "this player"}
                          />
                        ) : (
                          <span className="text-ink-faint text-xs">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </section>
      </div>
    </>
  );
}
