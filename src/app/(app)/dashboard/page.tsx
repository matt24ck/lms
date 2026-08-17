import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guards";
import { formatCountdown, formatDateTime, isFuture } from "@/lib/format";
import { MemberStatus } from "@/generated/prisma/enums";
import { JoinLeagueForm } from "@/components/join-league-form";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();

  const memberships = await prisma.leagueMember.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "desc" },
    include: {
      league: {
        include: {
          gameweeks: { orderBy: { weekNumber: "desc" }, take: 1 },
        },
      },
    },
  });

  const leagueIds = memberships.map((m) => m.leagueId);
  const latestGameweekIds = memberships
    .map((m) => m.league.gameweeks[0]?.id)
    .filter((id): id is string => Boolean(id));

  const [memberCounts, myPicks] = await Promise.all([
    leagueIds.length
      ? prisma.leagueMember.groupBy({
          by: ["leagueId", "status"],
          where: { leagueId: { in: leagueIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    latestGameweekIds.length
      ? prisma.pick.findMany({
          where: {
            gameweekId: { in: latestGameweekIds },
            memberId: { in: memberships.map((m) => m.id) },
          },
          select: { memberId: true, gameweekId: true, teamName: true },
        })
      : Promise.resolve([]),
  ]);

  function countsFor(leagueId: string) {
    const alive =
      memberCounts.find(
        (row) => row.leagueId === leagueId && row.status === MemberStatus.ALIVE,
      )?._count._all ?? 0;
    const out =
      memberCounts.find(
        (row) =>
          row.leagueId === leagueId && row.status === MemberStatus.ELIMINATED,
      )?._count._all ?? 0;
    return { alive, total: alive + out };
  }

  return (
    <>
      <PageHeader
        eyebrow="Your competitions"
        title={`Welcome, ${user.name?.split(" ")[0] ?? "player"}`}
        description="Pick a league to see this week's fixtures, make your selection and check who is still standing."
      />

      {/* min-w-0 lets each column shrink below its content's intrinsic width,
          keeping long league names and codes from stretching the page. */}
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section className="min-w-0 space-y-4">
          {memberships.length === 0 ? (
            <EmptyState
              title="You're not in a league yet"
              description="Ask your league admin for the six-character join code, then enter it on the right to get started."
            />
          ) : (
            memberships.map((membership) => {
              const { league } = membership;
              const gameweek = league.gameweeks[0];
              const { alive, total } = countsFor(league.id);
              const pick = myPicks.find(
                (p) =>
                  p.memberId === membership.id &&
                  p.gameweekId === gameweek?.id,
              );
              const isOut = membership.status === MemberStatus.ELIMINATED;
              const canPick =
                !isOut &&
                gameweek?.status === "OPEN" &&
                isFuture(gameweek.deadline);

              return (
                <Card key={membership.id}>
                  <CardHeader className="flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle>
                        <Link
                          href={`/leagues/${league.id}`}
                          className="hover:text-crimson transition-colors"
                        >
                          {league.name}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {league.season} · code{" "}
                        <span className="font-display text-gold tracking-[0.2em]">
                          {league.joinCode}
                        </span>
                      </CardDescription>
                    </div>
                    <Badge tone={isOut ? "out" : "alive"}>
                      {isOut ? "Eliminated" : "Still in"}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="text-ink-muted flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-4" aria-hidden />
                        {alive} of {total} still standing
                      </span>
                      {gameweek ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="size-4" aria-hidden />
                          GW{gameweek.weekNumber} deadline{" "}
                          {formatDateTime(gameweek.deadline)} (
                          {formatCountdown(gameweek.deadline)})
                        </span>
                      ) : (
                        <span>No gameweek launched yet</span>
                      )}
                    </div>

                    <div className="border-line flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                      <p className="text-sm">
                        {isOut ? (
                          <span className="text-ink-faint">
                            Your run ended — you can still follow the league.
                          </span>
                        ) : pick ? (
                          <>
                            <span className="text-ink-muted">This week: </span>
                            <span className="font-display font-bold uppercase">
                              {pick.teamName}
                            </span>
                          </>
                        ) : gameweek ? (
                          <span className="text-gold">No pick submitted yet</span>
                        ) : (
                          <span className="text-ink-faint">
                            Waiting for the admin to launch a gameweek.
                          </span>
                        )}
                      </p>

                      <div className="flex gap-2">
                        {canPick ? (
                          <ButtonLink
                            href={`/leagues/${league.id}/pick`}
                            size="sm"
                          >
                            {pick ? "Change pick" : "Make your pick"}
                          </ButtonLink>
                        ) : null}
                        <ButtonLink
                          href={`/leagues/${league.id}`}
                          variant="secondary"
                          size="sm"
                        >
                          View league
                          <ArrowRight className="size-3.5" aria-hidden />
                        </ButtonLink>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>

        <aside className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Join a league</CardTitle>
              <CardDescription>
                Enter the code your admin gave you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JoinLeagueForm />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
