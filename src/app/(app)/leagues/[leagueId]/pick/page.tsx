import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { getTeamPool } from "@/lib/lms";
import { formatCountdown, formatDateTime, isPast } from "@/lib/format";
import { GameweekStatus, MemberStatus } from "@/generated/prisma/enums";
import { TeamPicker, type PickableTeam } from "@/components/team-picker";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Make your pick" };

export default async function PickPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const user = await requireUser();

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
    include: {
      league: {
        include: {
          gameweeks: {
            where: { status: { in: [GameweekStatus.OPEN, GameweekStatus.LOCKED] } },
            orderBy: { weekNumber: "desc" },
            take: 1,
            include: { fixtures: { orderBy: { kickoff: "asc" } } },
          },
        },
      },
    },
  });

  if (!membership) notFound();

  const { league } = membership;
  const gameweek = league.gameweeks[0];

  const backLink = (
    <ButtonLink href={`/leagues/${leagueId}`} variant="secondary" size="sm">
      Back to league
    </ButtonLink>
  );

  if (membership.status === MemberStatus.ELIMINATED) {
    return (
      <>
        <PageHeader
          eyebrow={league.name}
          title="You're out of this one"
          actions={backLink}
        />
        <Alert tone="error" title="Eliminated">
          Your run in {league.name} ended
          {membership.eliminatedAt
            ? ` on ${formatDateTime(membership.eliminatedAt)}`
            : ""}
          , so you can no longer submit picks. You can still follow the league
          and see who is left.
        </Alert>
      </>
    );
  }

  if (!gameweek) {
    return (
      <>
        <PageHeader
          eyebrow={league.name}
          title="No gameweek open"
          actions={backLink}
        />
        <EmptyState
          title="Nothing to pick yet"
          description="Your admin hasn't launched the next gameweek. Check back once it's live."
        />
      </>
    );
  }

  const deadlinePassed = isPast(gameweek.deadline);
  const locked = gameweek.status !== GameweekStatus.OPEN || deadlinePassed;

  const [{ teams, poolRound }, currentPick] = await Promise.all([
    getTeamPool(membership.id),
    prisma.pick.findUnique({
      where: {
        memberId_gameweekId: { memberId: membership.id, gameweekId: gameweek.id },
      },
      select: { teamExternalId: true, teamName: true },
    }),
  ]);

  // Map each team to who it faces this gameweek.
  const opponents = new Map<
    number,
    { opponent: string; venue: "H" | "A"; kickoff: Date }
  >();
  for (const fixture of gameweek.fixtures) {
    opponents.set(fixture.homeTeamId, {
      opponent: fixture.awayTeamName,
      venue: "H",
      kickoff: fixture.kickoff,
    });
    opponents.set(fixture.awayTeamId, {
      opponent: fixture.homeTeamName,
      venue: "A",
      kickoff: fixture.kickoff,
    });
  }

  const pickable: PickableTeam[] = teams.map((team) => {
    const fixture = opponents.get(team.externalId);
    return {
      externalId: team.externalId,
      name: team.name,
      shortName: team.shortName,
      tla: team.tla,
      crestUrl: team.crestUrl,
      used: team.used,
      opponent: fixture?.opponent ?? null,
      venue: fixture?.venue ?? null,
      kickoff: fixture?.kickoff.toISOString() ?? null,
    };
  });

  const remaining = pickable.filter((t) => !t.used && t.opponent !== null).length;

  return (
    <>
      <PageHeader
        eyebrow={`${league.name} · Gameweek ${gameweek.weekNumber}`}
        title="Make your pick"
        description={`Deadline ${formatDateTime(gameweek.deadline)} (${formatCountdown(gameweek.deadline)}). ${remaining} team${remaining === 1 ? "" : "s"} still available to you${poolRound > 1 ? ` in pool round ${poolRound}` : ""}.`}
        actions={backLink}
      />

      {locked ? (
        <div className="space-y-6">
          <Alert tone="error" title="Picks are closed">
            The deadline for gameweek {gameweek.weekNumber} has passed.{" "}
            {currentPick
              ? `You are on ${currentPick.teamName}.`
              : "You did not submit a pick, which counts as a loss once the admin settles this gameweek."}
          </Alert>
          <p className="text-ink-muted text-sm">
            <Link href={`/leagues/${leagueId}`} className="text-crimson underline">
              Head back to the league
            </Link>{" "}
            to see how everyone else is getting on.
          </p>
        </div>
      ) : (
        <TeamPicker
          leagueId={leagueId}
          gameweekId={gameweek.id}
          teams={pickable}
          currentPickTeamId={currentPick?.teamExternalId ?? null}
        />
      )}
    </>
  );
}
