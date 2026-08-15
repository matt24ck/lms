import { prisma } from "@/lib/prisma";
import { GameweekStatus, MemberStatus, PickOutcome } from "@/generated/prisma/enums";

/**
 * Rules implemented here
 * ──────────────────────
 * • One team per gameweek, and a team cannot be reused until the player's pool
 *   resets. VOID picks (see below) do not count as used.
 * • When a player has used every team in the pool, their pool round increments
 *   and all teams become available again.
 * • Settling a gameweek: the admin marks the teams that won. A pick on a team
 *   not in that list is a loss, and no pick at all is a miss. Both eliminate.
 * • If settling would eliminate every remaining player at once, the gameweek is
 *   voided instead — nobody goes out — so the league can still find a winner.
 */

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}

/** Teams a member may pick this gameweek, with used ones flagged. */
export async function getTeamPool(memberId: string) {
  const member = await prisma.leagueMember.findUnique({
    where: { id: memberId },
    select: { poolRound: true },
  });

  if (!member) throw new GameRuleError("Membership not found.");

  const [teams, usedPicks] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.pick.findMany({
      where: {
        memberId,
        poolRound: member.poolRound,
        outcome: { not: PickOutcome.VOID },
      },
      select: { teamExternalId: true, gameweekId: true },
    }),
  ]);

  const usedByGameweek = new Map(
    usedPicks.map((pick) => [pick.teamExternalId, pick.gameweekId]),
  );

  return {
    poolRound: member.poolRound,
    teams: teams.map((team) => ({
      ...team,
      used: usedByGameweek.has(team.externalId),
      usedInGameweekId: usedByGameweek.get(team.externalId) ?? null,
    })),
  };
}

/**
 * Records a pick. Enforces that the player is alive, the gameweek is open, the
 * deadline has not passed, the team is playing this gameweek, and the team has
 * not already been used.
 */
export async function submitPick({
  memberId,
  gameweekId,
  teamExternalId,
}: {
  memberId: string;
  gameweekId: string;
  teamExternalId: number;
}) {
  const [member, gameweek] = await Promise.all([
    prisma.leagueMember.findUnique({
      where: { id: memberId },
      select: { id: true, leagueId: true, status: true, poolRound: true },
    }),
    prisma.gameweek.findUnique({
      where: { id: gameweekId },
      select: {
        id: true,
        leagueId: true,
        status: true,
        deadline: true,
        fixtures: {
          select: { homeTeamId: true, awayTeamId: true },
        },
      },
    }),
  ]);

  if (!member) throw new GameRuleError("You are not in this league.");
  if (!gameweek) throw new GameRuleError("Gameweek not found.");
  if (gameweek.leagueId !== member.leagueId) {
    throw new GameRuleError("That gameweek belongs to a different league.");
  }
  if (member.status === MemberStatus.ELIMINATED) {
    throw new GameRuleError("You have been eliminated and cannot pick.");
  }
  if (gameweek.status !== GameweekStatus.OPEN) {
    throw new GameRuleError("This gameweek is closed for picks.");
  }
  if (gameweek.deadline.getTime() <= Date.now()) {
    throw new GameRuleError("The deadline for this gameweek has passed.");
  }

  const playing = gameweek.fixtures.some(
    (fixture) =>
      fixture.homeTeamId === teamExternalId ||
      fixture.awayTeamId === teamExternalId,
  );
  if (!playing) {
    throw new GameRuleError("That team is not playing this gameweek.");
  }

  const team = await prisma.team.findUnique({
    where: { externalId: teamExternalId },
    select: { externalId: true, name: true, tla: true },
  });
  if (!team) throw new GameRuleError("Unknown team.");

  const alreadyUsed = await prisma.pick.findFirst({
    where: {
      memberId,
      poolRound: member.poolRound,
      teamExternalId,
      outcome: { not: PickOutcome.VOID },
      gameweekId: { not: gameweekId },
    },
    select: { id: true },
  });
  if (alreadyUsed) {
    throw new GameRuleError(`You have already used ${team.name}.`);
  }

  return prisma.pick.upsert({
    where: { memberId_gameweekId: { memberId, gameweekId } },
    create: {
      memberId,
      gameweekId,
      teamExternalId: team.externalId,
      teamName: team.name,
      teamTla: team.tla,
      poolRound: member.poolRound,
      outcome: PickOutcome.PENDING,
    },
    update: {
      teamExternalId: team.externalId,
      teamName: team.name,
      teamTla: team.tla,
      outcome: PickOutcome.PENDING,
    },
  });
}

export interface SettleSummary {
  voided: boolean;
  survived: string[];
  eliminated: string[];
  missed: string[];
  poolResets: string[];
  leagueComplete: boolean;
  winnerMemberIds: string[];
}

/**
 * Settles a gameweek from the admin's list of winning teams and processes
 * eliminations. Runs in one transaction so a partial settle can't strand the
 * league in a half-eliminated state.
 */
export async function settleGameweek({
  gameweekId,
  winningTeamExternalIds,
}: {
  gameweekId: string;
  winningTeamExternalIds: number[];
}): Promise<SettleSummary> {
  const winners = new Set(winningTeamExternalIds);

  return prisma.$transaction(async (tx) => {
    const gameweek = await tx.gameweek.findUnique({
      where: { id: gameweekId },
      select: {
        id: true,
        leagueId: true,
        status: true,
        fixtures: { select: { homeTeamId: true, awayTeamId: true } },
      },
    });

    if (!gameweek) throw new GameRuleError("Gameweek not found.");
    if (gameweek.status === GameweekStatus.SETTLED) {
      throw new GameRuleError("This gameweek has already been settled.");
    }

    // A winning team must actually have played in this gameweek.
    const playingTeamIds = new Set(
      gameweek.fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId]),
    );
    for (const teamId of winners) {
      if (!playingTeamIds.has(teamId)) {
        throw new GameRuleError(
          "One of the selected winning teams is not playing in this gameweek.",
        );
      }
    }

    const aliveMembers = await tx.leagueMember.findMany({
      where: { leagueId: gameweek.leagueId, status: MemberStatus.ALIVE },
      select: { id: true, poolRound: true },
    });

    if (aliveMembers.length === 0) {
      throw new GameRuleError("This league has no players left to settle.");
    }

    const picks = await tx.pick.findMany({
      where: { gameweekId },
      select: { id: true, memberId: true, teamExternalId: true },
    });
    const pickByMember = new Map(picks.map((pick) => [pick.memberId, pick]));

    const survived: string[] = [];
    const lost: string[] = [];
    const missed: string[] = [];

    for (const member of aliveMembers) {
      const pick = pickByMember.get(member.id);
      if (!pick) {
        missed.push(member.id);
      } else if (winners.has(pick.teamExternalId)) {
        survived.push(member.id);
      } else {
        lost.push(member.id);
      }
    }

    // Everyone still in would go out together — void the round instead.
    const voided = survived.length === 0;

    const teamNames = await tx.team.findMany({
      where: { externalId: { in: [...winners] } },
      select: { externalId: true, name: true },
    });

    await tx.winningTeam.deleteMany({ where: { gameweekId } });
    if (teamNames.length > 0) {
      await tx.winningTeam.createMany({
        data: teamNames.map((team) => ({
          gameweekId,
          teamExternalId: team.externalId,
          teamName: team.name,
        })),
      });
    }

    if (voided) {
      await tx.pick.updateMany({
        where: { gameweekId },
        data: { outcome: PickOutcome.VOID },
      });
      await tx.gameweek.update({
        where: { id: gameweekId },
        data: {
          status: GameweekStatus.SETTLED,
          isVoid: true,
          settledAt: new Date(),
        },
      });

      return {
        voided: true,
        survived: aliveMembers.map((m) => m.id),
        eliminated: [],
        missed,
        poolResets: [],
        leagueComplete: false,
        winnerMemberIds: [],
      };
    }

    if (survived.length > 0) {
      await tx.pick.updateMany({
        where: { gameweekId, memberId: { in: survived } },
        data: { outcome: PickOutcome.WON },
      });
    }
    if (lost.length > 0) {
      await tx.pick.updateMany({
        where: { gameweekId, memberId: { in: lost } },
        data: { outcome: PickOutcome.LOST },
      });
    }

    const eliminated = [...lost, ...missed];
    if (eliminated.length > 0) {
      await tx.leagueMember.updateMany({
        where: { id: { in: eliminated } },
        data: {
          status: MemberStatus.ELIMINATED,
          eliminatedAt: new Date(),
          eliminatedAtGameweekId: gameweekId,
        },
      });
    }

    // Survivors who have now used the whole pool get a fresh set of teams.
    const totalTeams = await tx.team.count();
    const poolResets: string[] = [];

    for (const memberId of survived) {
      const member = aliveMembers.find((m) => m.id === memberId);
      if (!member) continue;

      const used = await tx.pick.count({
        where: {
          memberId,
          poolRound: member.poolRound,
          outcome: { not: PickOutcome.VOID },
        },
      });

      if (totalTeams > 0 && used >= totalTeams) {
        await tx.leagueMember.update({
          where: { id: memberId },
          data: { poolRound: { increment: 1 } },
        });
        poolResets.push(memberId);
      }
    }

    await tx.gameweek.update({
      where: { id: gameweekId },
      data: { status: GameweekStatus.SETTLED, settledAt: new Date() },
    });

    // One player left standing ends the competition.
    const leagueComplete = survived.length === 1;
    if (leagueComplete) {
      await tx.league.update({
        where: { id: gameweek.leagueId },
        data: { status: "COMPLETE" },
      });
    }

    return {
      voided: false,
      survived,
      eliminated: lost,
      missed,
      poolResets,
      leagueComplete,
      winnerMemberIds: leagueComplete ? survived : [],
    };
  });
}

/** Closes picks without settling — useful when the deadline passes. */
export async function lockGameweek(gameweekId: string) {
  const gameweek = await prisma.gameweek.findUnique({
    where: { id: gameweekId },
    select: { status: true },
  });

  if (!gameweek) throw new GameRuleError("Gameweek not found.");
  if (gameweek.status === GameweekStatus.SETTLED) {
    throw new GameRuleError("This gameweek has already been settled.");
  }

  return prisma.gameweek.update({
    where: { id: gameweekId },
    data: { status: GameweekStatus.LOCKED },
  });
}
