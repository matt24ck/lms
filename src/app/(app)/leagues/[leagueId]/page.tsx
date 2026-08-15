import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Crown, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { formatCountdown, formatDateTime, formatTime, isPast } from "@/lib/format";
import {
  GameweekStatus,
  MemberStatus,
  PickOutcome,
} from "@/generated/prisma/enums";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { Alert } from "@/components/ui/alert";
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
  return { title: league?.name ?? "League" };
}

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const user = await requireUser();

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
    select: { id: true, status: true, poolRound: true },
  });
  if (!membership) notFound();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: {
        include: { user: { select: { name: true, image: true } } },
      },
      gameweeks: {
        orderBy: { weekNumber: "desc" },
        include: {
          fixtures: { orderBy: { kickoff: "asc" } },
          winningTeams: { orderBy: { teamName: "asc" } },
          picks: {
            select: {
              memberId: true,
              teamName: true,
              teamTla: true,
              outcome: true,
              poolRound: true,
            },
          },
        },
      },
    },
  });
  if (!league) notFound();

  const alive = league.members.filter((m) => m.status === MemberStatus.ALIVE);
  const out = league.members.filter((m) => m.status === MemberStatus.ELIMINATED);

  // The gameweek in play is the newest one not yet settled; otherwise the
  // most recently settled week.
  const activeGameweek =
    league.gameweeks.find((gw) => gw.status !== GameweekStatus.SETTLED) ?? null;
  const latestSettled =
    league.gameweeks.find((gw) => gw.status === GameweekStatus.SETTLED) ?? null;
  const focus = activeGameweek ?? latestSettled;

  const deadlinePassed = focus ? isPast(focus.deadline) : false;
  const revealPicks = focus
    ? focus.status !== GameweekStatus.OPEN || deadlinePassed
    : false;

  const myPick = focus?.picks.find((p) => p.memberId === membership.id) ?? null;
  const canPick =
    membership.status === MemberStatus.ALIVE &&
    activeGameweek?.status === GameweekStatus.OPEN &&
    !deadlinePassed;

  // Teams used in each member's *current* pool round — after a reset the
  // count starts again, matching what the player can actually still pick.
  const poolRounds = new Map(league.members.map((m) => [m.id, m.poolRound]));
  const usedCounts = new Map<string, number>();
  for (const gw of league.gameweeks) {
    for (const pick of gw.picks) {
      if (pick.outcome === PickOutcome.VOID) continue;
      if (pick.poolRound !== poolRounds.get(pick.memberId)) continue;
      usedCounts.set(pick.memberId, (usedCounts.get(pick.memberId) ?? 0) + 1);
    }
  }

  const winner = league.status === "COMPLETE" && alive.length === 1 ? alive[0] : null;
  const settledWeeks = league.gameweeks.filter(
    (gw) => gw.status === GameweekStatus.SETTLED,
  );

  return (
    <>
      <PageHeader
        eyebrow={`${league.season} · Join code ${league.joinCode}`}
        title={league.name}
        description={
          activeGameweek
            ? `Gameweek ${activeGameweek.weekNumber} is ${activeGameweek.status === GameweekStatus.OPEN ? "open" : "closed and awaiting results"}.`
            : "No gameweek is currently open."
        }
        actions={
          canPick ? (
            <ButtonLink href={`/leagues/${leagueId}/pick`}>
              {myPick ? "Change pick" : "Make your pick"}
            </ButtonLink>
          ) : undefined
        }
      />

      {winner ? (
        <div className="mb-8">
          <Alert tone="success" title="We have a winner">
            <span className="inline-flex items-center gap-2">
              <Crown className="size-4" aria-hidden />
              {winner.user.name ?? "A player"} is the last man standing in{" "}
              {league.name}.
            </span>
          </Alert>
        </div>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Still standing" value={alive.length} tone="pitch" />
        <Stat label="Eliminated" value={out.length} tone="crimson" />
        <Stat
          label="Gameweek"
          value={focus ? focus.weekNumber : "—"}
          hint={focus ? `Matchday ${focus.matchday}` : undefined}
        />
        <Stat
          label="Your status"
          value={membership.status === MemberStatus.ALIVE ? "In" : "Out"}
          tone={membership.status === MemberStatus.ALIVE ? "pitch" : "crimson"}
          hint={
            myPick
              ? `This week: ${myPick.teamName}`
              : membership.status === MemberStatus.ALIVE
                ? "No pick submitted"
                : undefined
          }
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          {/* Players */}
          <section>
            <h2 className="display-3 rule-crimson mb-5">Players</h2>
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Player</Th>
                    <Th>Status</Th>
                    <Th className="text-center">Teams used</Th>
                    <Th>
                      {focus ? `GW${focus.weekNumber} pick` : "Latest pick"}
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {[...alive, ...out].map((member) => {
                    const pick =
                      focus?.picks.find((p) => p.memberId === member.id) ?? null;
                    const isMe = member.id === membership.id;
                    const showPick = revealPicks || isMe;

                    return (
                      <Tr key={member.id}>
                        <Td>
                          <span className="flex items-center gap-2.5">
                            {member.user.image ? (
                              <Image
                                src={member.user.image}
                                alt=""
                                width={24}
                                height={24}
                                className="border-line size-6 rounded-full border"
                              />
                            ) : (
                              <span className="bg-surface-raised size-6 rounded-full" />
                            )}
                            <span className="font-medium">
                              {member.user.name ?? "Player"}
                            </span>
                            {isMe ? (
                              <span className="text-ink-faint text-xs">(you)</span>
                            ) : null}
                          </span>
                        </Td>
                        <Td>
                          {member.status === MemberStatus.ALIVE ? (
                            <Badge tone="alive">In</Badge>
                          ) : (
                            <Badge tone="out">Out</Badge>
                          )}
                        </Td>
                        <Td className="text-center tabular-nums">
                          {usedCounts.get(member.id) ?? 0}
                        </Td>
                        <Td>
                          {!pick ? (
                            <span className="text-ink-faint text-xs">
                              {member.status === MemberStatus.ELIMINATED
                                ? "—"
                                : "No pick"}
                            </span>
                          ) : showPick ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="font-display text-sm font-bold uppercase">
                                {pick.teamName}
                              </span>
                              {pick.outcome === PickOutcome.WON ? (
                                <Badge tone="alive">Won</Badge>
                              ) : pick.outcome === PickOutcome.LOST ? (
                                <Badge tone="out">Lost</Badge>
                              ) : pick.outcome === PickOutcome.VOID ? (
                                <Badge tone="pending">Void</Badge>
                              ) : null}
                            </span>
                          ) : (
                            <Badge tone="pending">Hidden until deadline</Badge>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableWrap>
            {!revealPicks && activeGameweek ? (
              <p className="text-ink-faint mt-3 text-xs">
                Everyone&apos;s picks are revealed once the deadline passes.
              </p>
            ) : null}
          </section>

          {/* Results history */}
          <section>
            <h2 className="display-3 rule-crimson mb-5">Previous gameweeks</h2>
            {settledWeeks.length === 0 ? (
              <EmptyState
                title="No results yet"
                description="Once your admin ends a gameweek, the winning teams and casualties show up here."
              />
            ) : (
              <div className="space-y-4">
                {settledWeeks.map((gw) => {
                  const casualties = league.members.filter(
                    (m) => m.eliminatedAtGameweekId === gw.id,
                  );

                  return (
                    <Card key={gw.id}>
                      <CardHeader className="flex-row items-center justify-between gap-4">
                        <div>
                          <CardTitle>Gameweek {gw.weekNumber}</CardTitle>
                          <CardDescription>
                            Matchday {gw.matchday} ·{" "}
                            {gw.settledAt
                              ? `settled ${formatDateTime(gw.settledAt)}`
                              : "settled"}
                          </CardDescription>
                        </div>
                        {gw.isVoid ? (
                          <Badge tone="gold">Void week</Badge>
                        ) : (
                          <Badge tone={casualties.length > 0 ? "out" : "alive"}>
                            {casualties.length} out
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {gw.isVoid ? (
                          <p className="text-gold">
                            Every remaining player&apos;s team failed, so this
                            gameweek was voided — nobody went out and those teams
                            became available again.
                          </p>
                        ) : null}
                        <div>
                          <p className="eyebrow text-ink-faint mb-1.5">
                            Winning teams
                          </p>
                          <p className="text-ink-muted">
                            {gw.winningTeams.length === 0
                              ? "None recorded"
                              : gw.winningTeams
                                  .map((team) => team.teamName)
                                  .join(", ")}
                          </p>
                        </div>
                        {casualties.length > 0 ? (
                          <div>
                            <p className="eyebrow text-ink-faint mb-1.5">
                              Knocked out
                            </p>
                            <p className="text-flare">
                              {casualties
                                .map((m) => m.user.name ?? "Player")
                                .join(", ")}
                            </p>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Fixtures */}
        <aside>
          <Card>
            <CardHeader>
              <CardTitle>
                {focus ? `Gameweek ${focus.weekNumber} fixtures` : "Fixtures"}
              </CardTitle>
              {focus ? (
                <CardDescription>
                  Deadline {formatDateTime(focus.deadline)}
                  {focus.status === GameweekStatus.OPEN
                    ? ` (${formatCountdown(focus.deadline)})`
                    : ""}
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent>
              {!focus || focus.fixtures.length === 0 ? (
                <p className="text-ink-muted text-sm">
                  No fixtures loaded yet.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {focus.fixtures.map((fixture) => {
                    const wonIds = new Set(
                      focus.winningTeams.map((w) => w.teamExternalId),
                    );
                    return (
                      <li
                        key={fixture.id}
                        className="border-line flex items-center justify-between gap-3 border-b pb-2.5 text-sm last:border-b-0 last:pb-0"
                      >
                        <span className="flex flex-col">
                          <span
                            className={
                              wonIds.has(fixture.homeTeamId)
                                ? "text-pitch font-semibold"
                                : ""
                            }
                          >
                            {fixture.homeTeamName}
                          </span>
                          <span
                            className={
                              wonIds.has(fixture.awayTeamId)
                                ? "text-pitch font-semibold"
                                : "text-ink-muted"
                            }
                          >
                            {fixture.awayTeamName}
                          </span>
                        </span>
                        <span className="text-ink-faint shrink-0 text-xs">
                          {formatTime(fixture.kickoff)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {league.status === "COMPLETE" ? (
            <Card className="mt-4">
              <CardContent className="flex items-center gap-3">
                <Trophy className="text-gold size-5 shrink-0" aria-hidden />
                <p className="text-ink-muted text-sm">
                  This competition has finished.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
