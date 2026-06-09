import { prisma } from "@/lib/prisma";
import { getMatchday } from "@/lib/football-api";

// Fetches fixtures for a matchday from football-data.org and upserts them
// for the gameweek. Never touches `result` on existing fixtures, so manually
// entered results survive refreshes (kickoff/team changes still update).
export async function fetchAndUpsertFixtures(
  gameweekId: string,
  apiMatchday: number
): Promise<number> {
  const { matches } = await getMatchday(apiMatchday);

  for (const match of matches) {
    await prisma.fixture.upsert({
      where: { apiMatchId: match.id },
      update: {
        gameweekId,
        homeTeamId: match.homeTeam.id,
        homeTeam: match.homeTeam.name,
        awayTeamId: match.awayTeam.id,
        awayTeam: match.awayTeam.name,
        kickoff: new Date(match.utcDate),
      },
      create: {
        gameweekId,
        apiMatchId: match.id,
        homeTeamId: match.homeTeam.id,
        homeTeam: match.homeTeam.name,
        awayTeamId: match.awayTeam.id,
        awayTeam: match.awayTeam.name,
        kickoff: new Date(match.utcDate),
      },
    });
  }

  // Remove fixtures that have left this matchday (e.g. rescheduled to another
  // gameweek), but only if no result has been entered for them.
  const apiMatchIds = matches.map((m) => m.id);
  await prisma.fixture.deleteMany({
    where: {
      gameweekId,
      apiMatchId: { notIn: apiMatchIds },
      result: null,
    },
  });

  return matches.length;
}
