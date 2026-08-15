import type { Metadata } from "next";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guards";
import { MemberStatus } from "@/generated/prisma/enums";
import { CreateLeagueForm } from "@/components/admin/create-league-form";
import { SyncTeamsButton } from "@/components/admin/sync-teams-button";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
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

export const metadata: Metadata = { title: "Admin" };

/** Season label like "2026/27" from the current date. */
function currentSeasonLabel() {
  const now = new Date();
  // A Premier League season starting in August spans two calendar years.
  const startYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

export default async function AdminPage() {
  await requireAdmin();

  const [leagues, teamCount] = await Promise.all([
    prisma.league.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        members: { select: { status: true } },
        gameweeks: {
          orderBy: { weekNumber: "desc" },
          take: 1,
          select: { weekNumber: true, status: true },
        },
      },
    }),
    prisma.team.count(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Competition control"
        description="Create leagues, launch each gameweek and confirm the results that decide who survives."
        actions={<SyncTeamsButton teamCount={teamCount} />}
      />

      {teamCount === 0 ? (
        <div className="mb-8">
          <Alert tone="error" title="Teams not synced yet">
            Sync the Premier League teams before launching a gameweek — the
            picker has nothing to show until then.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section>
          <h2 className="display-3 rule-crimson mb-5">Leagues</h2>

          {leagues.length === 0 ? (
            <EmptyState
              title="No leagues yet"
              description="Create your first league, then share its join code with your players."
            />
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>League</Th>
                    <Th>Code</Th>
                    <Th>Status</Th>
                    <Th className="text-center">Alive</Th>
                    <Th>Latest gameweek</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {leagues.map((league) => {
                    const alive = league.members.filter(
                      (m) => m.status === MemberStatus.ALIVE,
                    ).length;
                    const gameweek = league.gameweeks[0];

                    return (
                      <Tr key={league.id}>
                        <Td>
                          <Link
                            href={`/admin/leagues/${league.id}`}
                            className="font-medium hover:text-crimson transition-colors"
                          >
                            {league.name}
                          </Link>
                          <span className="text-ink-faint block text-xs">
                            {league.season}
                          </span>
                        </Td>
                        <Td>
                          <span className="font-display text-gold tracking-[0.2em]">
                            {league.joinCode}
                          </span>
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              league.status === "OPEN"
                                ? "alive"
                                : league.status === "IN_PROGRESS"
                                  ? "crimson"
                                  : "neutral"
                            }
                          >
                            {league.status === "IN_PROGRESS"
                              ? "In progress"
                              : league.status === "OPEN"
                                ? "Open"
                                : "Complete"}
                          </Badge>
                        </Td>
                        <Td className="text-center tabular-nums">
                          {alive}/{league.members.length}
                        </Td>
                        <Td className="text-ink-muted text-xs">
                          {gameweek
                            ? `GW${gameweek.weekNumber} · ${gameweek.status.toLowerCase()}`
                            : "None"}
                        </Td>
                        <Td>
                          <ButtonLink
                            href={`/admin/leagues/${league.id}`}
                            variant="secondary"
                            size="sm"
                          >
                            <Settings2 className="size-3.5" aria-hidden />
                            Manage
                          </ButtonLink>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </section>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle>New league</CardTitle>
              <CardDescription>
                A six-character join code is generated automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateLeagueForm defaultSeason={currentSeasonLabel()} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
