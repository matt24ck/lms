"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminForAction } from "@/lib/guards";
import {
  FootballDataError,
  fetchMatchday,
  fetchTeams,
} from "@/lib/football-data";
import { GameRuleError, lockGameweek, settleGameweek } from "@/lib/lms";
import type { ActionState } from "@/lib/actions/leagues";

/** Pulls the 20 Premier League teams into the local reference table. */
export async function syncTeamsAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdminForAction();
    const teams = await fetchTeams();

    for (const team of teams) {
      await prisma.team.upsert({
        where: { externalId: team.id },
        create: {
          externalId: team.id,
          name: team.name,
          shortName: team.shortName ?? team.name,
          tla: team.tla ?? team.name.slice(0, 3).toUpperCase(),
          crestUrl: team.crest,
        },
        update: {
          name: team.name,
          shortName: team.shortName ?? team.name,
          tla: team.tla ?? team.name.slice(0, 3).toUpperCase(),
          crestUrl: team.crest,
        },
      });
    }

    revalidatePath("/admin");
    return { success: `Synced ${teams.length} Premier League teams.` };
  } catch (error) {
    if (error instanceof FootballDataError) return { error: error.message };
    console.error("syncTeamsAction failed", error);
    return { error: (error as Error).message ?? "Could not sync teams." };
  }
}

/**
 * Creates the next gameweek for a league and caches that matchday's fixtures.
 * Closes the league to new entrants, since joining once results are in would
 * be unfair on everyone who has already survived a round.
 */
export async function launchGameweekAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdminForAction();
  } catch (error) {
    return { error: (error as Error).message };
  }

  const leagueId = String(formData.get("leagueId") ?? "");
  const matchday = Number(formData.get("matchday"));
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();

  if (!leagueId) return { error: "Missing league." };
  if (!Number.isInteger(matchday) || matchday < 1 || matchday > 38) {
    return { error: "Matchday must be a number between 1 and 38." };
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, status: true },
  });
  if (!league) return { error: "League not found." };
  if (league.status === "COMPLETE") {
    return { error: "That league has already finished." };
  }

  const unsettled = await prisma.gameweek.findFirst({
    where: { leagueId, status: { in: ["OPEN", "LOCKED"] } },
    select: { weekNumber: true },
  });
  if (unsettled) {
    return {
      error: `Gameweek ${unsettled.weekNumber} is still open. End it before launching another.`,
    };
  }

  const teamCount = await prisma.team.count();
  if (teamCount === 0) {
    return {
      error: "Sync the Premier League teams first, then launch a gameweek.",
    };
  }

  let matches;
  try {
    matches = await fetchMatchday(matchday);
  } catch (error) {
    if (error instanceof FootballDataError) return { error: error.message };
    console.error("fetchMatchday failed", error);
    return { error: "Could not reach football-data.org. Try again." };
  }

  if (matches.length === 0) {
    return { error: `No fixtures returned for matchday ${matchday}.` };
  }

  // Default the deadline to the first kick-off of the matchday.
  const earliestKickoff = matches
    .map((match) => new Date(match.utcDate).getTime())
    .reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);

  let deadline = new Date(earliestKickoff);
  if (deadlineRaw) {
    const parsed = new Date(deadlineRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "That deadline is not a valid date and time." };
    }
    deadline = parsed;
  }

  const lastWeek = await prisma.gameweek.findFirst({
    where: { leagueId },
    orderBy: { weekNumber: "desc" },
    select: { weekNumber: true },
  });
  const weekNumber = (lastWeek?.weekNumber ?? 0) + 1;

  try {
    await prisma.$transaction(async (tx) => {
      const gameweek = await tx.gameweek.create({
        data: { leagueId, weekNumber, matchday, deadline },
        select: { id: true },
      });

      await tx.fixture.createMany({
        data: matches.map((match) => ({
          gameweekId: gameweek.id,
          externalId: match.id,
          homeTeamId: match.homeTeam.id,
          homeTeamName: match.homeTeam.name,
          homeTeamTla:
            match.homeTeam.tla ?? match.homeTeam.name.slice(0, 3).toUpperCase(),
          homeCrestUrl: match.homeTeam.crest,
          awayTeamId: match.awayTeam.id,
          awayTeamName: match.awayTeam.name,
          awayTeamTla:
            match.awayTeam.tla ?? match.awayTeam.name.slice(0, 3).toUpperCase(),
          awayCrestUrl: match.awayTeam.crest,
          kickoff: new Date(match.utcDate),
        })),
      });

      if (league.status === "OPEN") {
        await tx.league.update({
          where: { id: leagueId },
          data: { status: "IN_PROGRESS" },
        });
      }
    });
  } catch (error) {
    console.error("launchGameweekAction failed", error);
    return { error: "Could not create the gameweek. Try again." };
  }

  revalidatePath(`/admin/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}`);
  return {
    success: `Gameweek ${weekNumber} launched with ${matches.length} fixtures.`,
  };
}

export async function lockGameweekAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdminForAction();
    const gameweekId = String(formData.get("gameweekId") ?? "");
    const leagueId = String(formData.get("leagueId") ?? "");
    if (!gameweekId) return { error: "Missing gameweek." };

    await lockGameweek(gameweekId);

    revalidatePath(`/admin/leagues/${leagueId}`);
    revalidatePath(`/leagues/${leagueId}`);
    return { success: "Picks are now closed for this gameweek." };
  } catch (error) {
    if (error instanceof GameRuleError) return { error: error.message };
    console.error("lockGameweekAction failed", error);
    return { error: "Could not close the gameweek." };
  }
}

/** Ends a gameweek: admin marks the winning teams, eliminations follow. */
export async function settleGameweekAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdminForAction();
  } catch (error) {
    return { error: (error as Error).message };
  }

  const gameweekId = String(formData.get("gameweekId") ?? "");
  const leagueId = String(formData.get("leagueId") ?? "");
  if (!gameweekId) return { error: "Missing gameweek." };

  const winningTeamExternalIds = formData
    .getAll("winners")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  try {
    const summary = await settleGameweek({
      gameweekId,
      winningTeamExternalIds,
    });

    revalidatePath(`/admin/leagues/${leagueId}`);
    revalidatePath(`/leagues/${leagueId}`);

    if (summary.voided) {
      return {
        success:
          "Every remaining player's team failed, so this gameweek was voided. Nobody is out and those teams are selectable again.",
      };
    }

    const parts = [
      `${summary.survived.length} through`,
      `${summary.eliminated.length + summary.missed.length} out`,
    ];
    if (summary.missed.length > 0) {
      parts.push(`${summary.missed.length} missed the deadline`);
    }
    if (summary.poolResets.length > 0) {
      parts.push(`${summary.poolResets.length} team pool reset`);
    }
    if (summary.leagueComplete) {
      parts.push("we have a winner");
    }

    return { success: `Gameweek settled — ${parts.join(", ")}.` };
  } catch (error) {
    if (error instanceof GameRuleError) return { error: error.message };
    console.error("settleGameweekAction failed", error);
    return { error: "Could not settle the gameweek." };
  }
}
