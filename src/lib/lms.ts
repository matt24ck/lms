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
 * • Lifelines: an admin-granted shield held by a player. When a settle would
 *   eliminate them (loss or missed pick), one lifeline burns instead and they
 *   survive. A losing pick saved this way still counts as a used team.
 * • If settling would eliminate every remaining player at once, the gameweek is
 *   voided instead — nobody goes out and no lifelines burn — so the league can
 *   still find a winner.
 * • Entries: a league stays open to new players until its first real result is
 *   settled (a voided week doesn't count). Joining is also blocked whenever the
 *   current gameweek's picks are closed — deadline passed or locked — because a
 *   new entrant could no longer take part in it.
 * • Revive: an admin can restore an eliminated player to the game at any time.
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
  /** Members who would have gone out but burned a lifeline instead. */
  saved: string[];
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
        league: { select: { status: true } },
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
      select: { id: true, poolRound: true, lifelines: true },
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

    // Everyone's team failed together — void the round instead. Lifelines are
    // deliberately untouched here: a scrubbed week shouldn't cost anyone their
    // shield.
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
        saved: [],
        eliminated: [],
        missed,
        poolResets: [],
        leagueComplete: false,
        winnerMemberIds: [],
      };
    }

    // A player who would go out burns a lifeline instead, whether they lost
    // or simply never picked.
    const lifelinesById = new Map(aliveMembers.map((m) => [m.id, m.lifelines]));
    const savedFromLoss = lost.filter((id) => (lifelinesById.get(id) ?? 0) > 0);
    const savedFromMiss = missed.filter((id) => (lifelinesById.get(id) ?? 0) > 0);
    const saved = [...savedFromLoss, ...savedFromMiss];
    const eliminatedLost = lost.filter((id) => !savedFromLoss.includes(id));
    const eliminatedMissed = missed.filter((id) => !savedFromMiss.includes(id));

    if (survived.length > 0) {
      await tx.pick.updateMany({
        where: { gameweekId, memberId: { in: survived } },
        data: { outcome: PickOutcome.WON },
      });
    }
    if (savedFromLoss.length > 0) {
      await tx.pick.updateMany({
        where: { gameweekId, memberId: { in: savedFromLoss } },
        data: { outcome: PickOutcome.SAVED },
      });
    }
    if (eliminatedLost.length > 0) {
      await tx.pick.updateMany({
        where: { gameweekId, memberId: { in: eliminatedLost } },
        data: { outcome: PickOutcome.LOST },
      });
    }

    if (saved.length > 0) {
      await tx.leagueMember.updateMany({
        where: { id: { in: saved } },
        data: { lifelines: { decrement: 1 } },
      });
    }

    const eliminated = [...eliminatedLost, ...eliminatedMissed];
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

    // Anyone who consumed a team this week and has now used the whole pool
    // gets a fresh set. A lifeline save still consumed the team, so saved
    // pickers are included; saved no-picks used nothing.
    const totalTeams = await tx.team.count();
    const poolResets: string[] = [];

    for (const memberId of [...survived, ...savedFromLoss]) {
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

    // One player left standing ends the competition. A lifeline save counts
    // as standing.
    const aliveAfter = [...survived, ...saved];
    const leagueComplete = aliveAfter.length === 1;
    if (leagueComplete) {
      await tx.league.update({
        where: { id: gameweek.leagueId },
        data: { status: "COMPLETE" },
      });
    } else if (gameweek.league.status === "OPEN") {
      // The first settled result closes the league to new entrants — joining
      // once results are in would be unfair on everyone who survived them.
      // A voided week counts for nobody, so it returns early above and leaves
      // entries open.
      await tx.league.update({
        where: { id: gameweek.leagueId },
        data: { status: "IN_PROGRESS" },
      });
    }

    return {
      voided: false,
      survived,
      saved,
      eliminated: eliminatedLost,
      missed: eliminatedMissed,
      poolResets,
      leagueComplete,
      winnerMemberIds: leagueComplete ? aliveAfter : [],
    };
  });
}

/**
 * Restores an eliminated player to the competition. Their pick history is
 * untouched — the losing pick stays on the record and its team stays used.
 * Reviving into a league that had already crowned a winner reopens it.
 */
export async function reviveMember(memberId: string) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.leagueMember.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        status: true,
        league: { select: { id: true, status: true } },
      },
    });

    if (!member) throw new GameRuleError("Membership not found.");
    if (member.status !== MemberStatus.ELIMINATED) {
      throw new GameRuleError("That player has not been eliminated.");
    }

    await tx.leagueMember.update({
      where: { id: memberId },
      data: {
        status: MemberStatus.ALIVE,
        eliminatedAt: null,
        eliminatedAtGameweekId: null,
      },
    });

    if (member.league.status === "COMPLETE") {
      await tx.league.update({
        where: { id: member.league.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    return { leagueReopened: member.league.status === "COMPLETE" };
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
