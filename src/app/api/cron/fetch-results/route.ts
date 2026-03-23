import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getMatchday } from "@/lib/football-api";
import { SelectionResult } from "@/generated/prisma/client";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch fixtures for UPCOMING gameweeks (so pick page shows opponents)
    const upcomingGameweeks = await prisma.gameweek.findMany({
      where: {
        status: "UPCOMING",
        apiMatchday: { not: null },
        competition: { status: "ACTIVE" },
      },
    });

    let fixturesFetched = 0;
    for (const gameweek of upcomingGameweeks) {
      const data = await getMatchday(gameweek.apiMatchday!);
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
        fixturesFetched++;
      }
    }

    // Find active gameweeks with an apiMatchday
    const activeGameweeks = await prisma.gameweek.findMany({
      where: {
        status: "ACTIVE",
        apiMatchday: { not: null },
        competition: { status: "ACTIVE" },
      },
    });

    let totalUpdated = 0;

    for (const gameweek of activeGameweeks) {
      const data = await getMatchday(gameweek.apiMatchday!);

      let allFinished = true;

      for (const match of data.matches) {
        // Update fixture
        await prisma.fixture.upsert({
          where: { apiMatchId: match.id },
          update: {
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

        if (match.status !== "FINISHED") {
          allFinished = false;
          continue;
        }

        // Update selections for this match
        const homeSelections = await prisma.selection.findMany({
          where: {
            gameweekId: gameweek.id,
            teamApiId: match.homeTeam.id,
            result: "PENDING",
          },
        });

        const awaySelections = await prisma.selection.findMany({
          where: {
            gameweekId: gameweek.id,
            teamApiId: match.awayTeam.id,
            result: "PENDING",
          },
        });

        let homeResult: SelectionResult;
        let awayResult: SelectionResult;

        if (match.score.winner === "HOME_TEAM") {
          homeResult = "WIN";
          awayResult = "LOSS";
        } else if (match.score.winner === "AWAY_TEAM") {
          homeResult = "LOSS";
          awayResult = "WIN";
        } else {
          homeResult = "DRAW";
          awayResult = "DRAW";
        }

        for (const sel of homeSelections) {
          await prisma.selection.update({
            where: { id: sel.id },
            data: { result: homeResult },
          });
          totalUpdated++;
        }

        for (const sel of awaySelections) {
          await prisma.selection.update({
            where: { id: sel.id },
            data: { result: awayResult },
          });
          totalUpdated++;
        }
      }

      // If all matches are finished, mark gameweek as completed
      if (allFinished && data.matches.length > 0) {
        await prisma.gameweek.update({
          where: { id: gameweek.id },
          data: { status: "COMPLETED" },
        });
      }
    }

    return NextResponse.json({
      message: `Fetched ${fixturesFetched} fixtures for ${upcomingGameweeks.length} upcoming gameweeks. Updated ${totalUpdated} selections across ${activeGameweeks.length} active gameweeks.`,
    });
  } catch (error) {
    console.error("fetch-results error:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
