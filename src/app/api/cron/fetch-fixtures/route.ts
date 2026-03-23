import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getCompetitionInfo, getMatchday } from "@/lib/football-api";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activeCompetition = await prisma.competition.findFirst({
      where: { status: "ACTIVE" },
    });

    if (!activeCompetition) {
      return NextResponse.json({ message: "No active competition" });
    }

    // Get current PL matchday
    const competitionInfo = await getCompetitionInfo();
    const currentMatchday = competitionInfo.currentSeason.currentMatchday;

    // Find the gameweek that maps to this matchday
    const gameweek = await prisma.gameweek.findFirst({
      where: {
        competitionId: activeCompetition.id,
        apiMatchday: currentMatchday,
      },
    });

    if (!gameweek) {
      return NextResponse.json({
        message: `No gameweek mapped to matchday ${currentMatchday}`,
      });
    }

    // Fetch fixtures from API
    const data = await getMatchday(currentMatchday);

    let upserted = 0;
    for (const match of data.matches) {
      await prisma.fixture.upsert({
        where: { apiMatchId: match.id },
        update: {
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          homeTeamId: match.homeTeam.id,
          awayTeamId: match.awayTeam.id,
          kickoff: new Date(match.utcDate),
          status: match.status,
          homeScore: match.score.fullTime.home,
          awayScore: match.score.fullTime.away,
        },
        create: {
          gameweekId: gameweek.id,
          apiMatchId: match.id,
          homeTeamId: match.homeTeam.id,
          homeTeam: match.homeTeam.name,
          awayTeamId: match.awayTeam.id,
          awayTeam: match.awayTeam.name,
          kickoff: new Date(match.utcDate),
          status: match.status,
          homeScore: match.score.fullTime.home,
          awayScore: match.score.fullTime.away,
        },
      });
      upserted++;
    }

    return NextResponse.json({
      message: `Fetched ${upserted} fixtures for matchday ${currentMatchday}`,
    });
  } catch (error) {
    console.error("fetch-fixtures error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fixtures" },
      { status: 500 }
    );
  }
}
