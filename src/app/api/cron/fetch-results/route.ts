import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getMatchday } from "@/lib/football-api";
import { getResend } from "@/lib/resend";
import { SelectionResult } from "@/generated/prisma/client";
import { format } from "date-fns";

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

        // Determine results
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

        // Batch update all selections for this match
        const homeUpdated = await prisma.selection.updateMany({
          where: {
            gameweekId: gameweek.id,
            teamApiId: match.homeTeam.id,
            result: "PENDING",
          },
          data: { result: homeResult },
        });

        const awayUpdated = await prisma.selection.updateMany({
          where: {
            gameweekId: gameweek.id,
            teamApiId: match.awayTeam.id,
            result: "PENDING",
          },
          data: { result: awayResult },
        });

        totalUpdated += homeUpdated.count + awayUpdated.count;
      }

      // If all matches are finished, mark gameweek as completed
      if (allFinished && data.matches.length > 0) {
        await prisma.gameweek.update({
          where: { id: gameweek.id },
          data: { status: "COMPLETED" },
        });
      }
    }

    // Send reminders for upcoming gameweeks where players haven't picked
    let reminded = 0;
    for (const gameweek of upcomingGameweeks) {
      const activePlayers = await prisma.competitionUser.findMany({
        where: {
          competitionId: gameweek.competitionId,
          isEliminated: false,
        },
        select: { userId: true, user: { select: { email: true, name: true } } },
      });

      const existingSelections = await prisma.selection.findMany({
        where: { gameweekId: gameweek.id },
        select: { userId: true },
      });
      const pickedUserIds = new Set(existingSelections.map((s) => s.userId));

      for (const player of activePlayers) {
        if (!pickedUserIds.has(player.userId) && player.user.email) {
          getResend()
            .emails.send({
              from: process.env.RESEND_FROM_EMAIL!,
              to: player.user.email,
              subject: `LMS Reminder - Pick your team for Gameweek ${gameweek.weekNumber}`,
              html: `
                <h1>Last Man Standing</h1>
                <p>Hi ${player.user.name ?? "there"},</p>
                <p>You haven't made your pick for <strong>Gameweek ${gameweek.weekNumber}</strong> yet!</p>
                <p><strong>Deadline:</strong> ${format(gameweek.deadline, "EEEE d MMMM, HH:mm")} UTC</p>
                <p>Don't forget - if you don't pick, you'll be eliminated!</p>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/pick">Make your pick now</a></p>
              `,
            })
            .catch((err) => console.error("Failed to send reminder:", err));
          reminded++;
        }
      }
    }

    return NextResponse.json({
      message: `Fetched ${fixturesFetched} fixtures for ${upcomingGameweeks.length} upcoming gameweeks. Updated ${totalUpdated} selections across ${activeGameweeks.length} active gameweeks. Sent ${reminded} reminders.`,
    });
  } catch (error) {
    console.error("fetch-results error:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
