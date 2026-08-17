/**
 * Exercises the Last Man Standing rules against a real Postgres database.
 *
 * DESTRUCTIVE — it truncates every table, so it must only ever be pointed at a
 * scratch database. The LMS_ALLOW_WIPE guard below exists so a stray
 * DATABASE_URL pointing at Supabase cannot delete a live competition.
 *
 *   LMS_ALLOW_WIPE=1 DATABASE_URL=postgresql://... npx tsx scripts/verify-game-logic.ts
 */
if (process.env.LMS_ALLOW_WIPE !== "1") {
  console.error(
    "Refusing to run: this harness deletes all data.\n" +
      "Point DATABASE_URL at a scratch database and set LMS_ALLOW_WIPE=1 to proceed.",
  );
  process.exit(1);
}

import { prisma } from "@/lib/prisma";
import {
  GameRuleError,
  getTeamPool,
  reviveMember,
  settleGameweek,
  submitPick,
} from "@/lib/lms";
import { GameweekStatus, MemberStatus, PickOutcome } from "@/generated/prisma/enums";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function expectRuleError(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(name, false, "expected a GameRuleError but the call succeeded");
  } catch (error) {
    check(
      name,
      error instanceof GameRuleError,
      `threw ${(error as Error).name}: ${(error as Error).message}`,
    );
  }
}

const HOUR = 3600_000;
let fixtureSeq = 1000;

async function wipe() {
  await prisma.pick.deleteMany();
  await prisma.winningTeam.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.leagueMember.deleteMany();
  await prisma.gameweek.deleteMany();
  await prisma.league.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
}

async function seedTeams() {
  await prisma.team.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      externalId: i + 1,
      name: `Team ${i + 1}`,
      shortName: `Team ${i + 1}`,
      tla: `T${String(i + 1).padStart(2, "0")}`,
    })),
  });
}

async function makeUser(name: string) {
  return prisma.user.create({
    data: { name, email: `${name.toLowerCase()}@example.com` },
  });
}

async function makeLeague(name: string, joinCode: string, creatorId: string) {
  return prisma.league.create({
    data: { name, season: "2026/27", joinCode, createdById: creatorId },
  });
}

/** Creates a gameweek with 10 fixtures pairing teams 1v2, 3v4 … 19v20. */
async function makeGameweek(
  leagueId: string,
  weekNumber: number,
  opts: { deadlineOffsetMs?: number; status?: "OPEN" | "LOCKED" | "SETTLED" } = {},
) {
  const gameweek = await prisma.gameweek.create({
    data: {
      leagueId,
      weekNumber,
      matchday: weekNumber,
      deadline: new Date(Date.now() + (opts.deadlineOffsetMs ?? 24 * HOUR)),
      status: (opts.status ?? "OPEN") as GameweekStatus,
    },
  });

  await prisma.fixture.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({
      gameweekId: gameweek.id,
      externalId: fixtureSeq++,
      homeTeamId: i * 2 + 1,
      homeTeamName: `Team ${i * 2 + 1}`,
      homeTeamTla: `T${String(i * 2 + 1).padStart(2, "0")}`,
      awayTeamId: i * 2 + 2,
      awayTeamName: `Team ${i * 2 + 2}`,
      awayTeamTla: `T${String(i * 2 + 2).padStart(2, "0")}`,
      kickoff: new Date(Date.now() + 25 * HOUR),
    })),
  });

  return gameweek;
}

async function statusOf(memberId: string) {
  const member = await prisma.leagueMember.findUniqueOrThrow({
    where: { id: memberId },
  });
  return member;
}

async function outcomeOf(memberId: string, gameweekId: string) {
  const pick = await prisma.pick.findUnique({
    where: { memberId_gameweekId: { memberId, gameweekId } },
  });
  return pick?.outcome ?? null;
}

async function main() {
  await wipe();
  await seedTeams();

  // ── Scenario 1: a normal gameweek ────────────────────────────────
  console.log("\nScenario 1 — settling a gameweek eliminates losers and no-picks");

  const [alice, bob, cara, dan] = await Promise.all([
    makeUser("Alice"),
    makeUser("Bob"),
    makeUser("Cara"),
    makeUser("Dan"),
  ]);

  const league = await makeLeague("Test League", "ABC234", alice.id);
  const members = await Promise.all(
    [alice, bob, cara, dan].map((user) =>
      prisma.leagueMember.create({
        data: { leagueId: league.id, userId: user.id },
      }),
    ),
  );
  const [mAlice, mBob, mCara, mDan] = members;

  const gw1 = await makeGameweek(league.id, 1);

  await submitPick({ memberId: mAlice.id, gameweekId: gw1.id, teamExternalId: 1 });
  await submitPick({ memberId: mBob.id, gameweekId: gw1.id, teamExternalId: 2 });
  await submitPick({ memberId: mDan.id, gameweekId: gw1.id, teamExternalId: 3 });
  // Cara deliberately submits nothing.

  const summary1 = await settleGameweek({
    gameweekId: gw1.id,
    winningTeamExternalIds: [1, 3],
  });

  check("Alice survives on a winning team", (await statusOf(mAlice.id)).status === MemberStatus.ALIVE);
  check("Dan survives on a winning team", (await statusOf(mDan.id)).status === MemberStatus.ALIVE);
  check("Bob is eliminated on a losing team", (await statusOf(mBob.id)).status === MemberStatus.ELIMINATED);
  check("Cara is eliminated for not picking", (await statusOf(mCara.id)).status === MemberStatus.ELIMINATED);
  check("Bob's pick is marked LOST", (await outcomeOf(mBob.id, gw1.id)) === PickOutcome.LOST);
  check("Alice's pick is marked WON", (await outcomeOf(mAlice.id, gw1.id)) === PickOutcome.WON);
  check("summary reports 2 survivors", summary1.survived.length === 2, JSON.stringify(summary1.survived));
  check("summary reports Cara as a miss", summary1.missed.length === 1);
  check("gameweek is SETTLED", (await prisma.gameweek.findUniqueOrThrow({ where: { id: gw1.id } })).status === GameweekStatus.SETTLED);
  check("eliminations record the gameweek", (await statusOf(mBob.id)).eliminatedAtGameweekId === gw1.id);
  check(
    "first settled result closes the league to entrants",
    (await prisma.league.findUniqueOrThrow({ where: { id: league.id } })).status === "IN_PROGRESS",
  );

  // ── Scenario 2: pick validation ──────────────────────────────────
  console.log("\nScenario 2 — pick rules are enforced");

  const gw2 = await makeGameweek(league.id, 2);

  await expectRuleError("cannot reuse a team already used", () =>
    submitPick({ memberId: mAlice.id, gameweekId: gw2.id, teamExternalId: 1 }),
  );
  await expectRuleError("eliminated players cannot pick", () =>
    submitPick({ memberId: mBob.id, gameweekId: gw2.id, teamExternalId: 5 }),
  );
  await expectRuleError("cannot pick a team that is not playing", () =>
    submitPick({ memberId: mAlice.id, gameweekId: gw2.id, teamExternalId: 999 }),
  );
  await expectRuleError("cannot settle an already settled gameweek", () =>
    settleGameweek({ gameweekId: gw1.id, winningTeamExternalIds: [1] }),
  );
  await expectRuleError("winning team must have played that gameweek", () =>
    settleGameweek({ gameweekId: gw2.id, winningTeamExternalIds: [999] }),
  );

  const pool = await getTeamPool(mAlice.id);
  check("team pool marks used teams", pool.teams.find((t) => t.externalId === 1)?.used === true);
  check("team pool leaves unused teams available", pool.teams.find((t) => t.externalId === 5)?.used === false);
  check("team pool has all 20 teams", pool.teams.length === 20);

  // Changing your mind before the deadline is allowed.
  await submitPick({ memberId: mAlice.id, gameweekId: gw2.id, teamExternalId: 5 });
  await submitPick({ memberId: mAlice.id, gameweekId: gw2.id, teamExternalId: 7 });
  const changed = await prisma.pick.findUnique({
    where: { memberId_gameweekId: { memberId: mAlice.id, gameweekId: gw2.id } },
  });
  check("a pick can be changed before the deadline", changed?.teamExternalId === 7);

  // ── Scenario 3: the all-out round is voided ──────────────────────
  console.log("\nScenario 3 — a gameweek that would wipe everyone out is voided");

  await submitPick({ memberId: mDan.id, gameweekId: gw2.id, teamExternalId: 9 });

  // Alice (7) and Dan (9) both lose: their opponents win instead.
  const summary2 = await settleGameweek({
    gameweekId: gw2.id,
    winningTeamExternalIds: [8, 10],
  });

  check("gameweek reports as voided", summary2.voided);
  check("nobody is eliminated in a void week", summary2.eliminated.length === 0);
  check("Alice stays alive through a void week", (await statusOf(mAlice.id)).status === MemberStatus.ALIVE);
  check("Dan stays alive through a void week", (await statusOf(mDan.id)).status === MemberStatus.ALIVE);
  check("void week is flagged on the gameweek", (await prisma.gameweek.findUniqueOrThrow({ where: { id: gw2.id } })).isVoid);
  check("picks in a void week are marked VOID", (await outcomeOf(mAlice.id, gw2.id)) === PickOutcome.VOID);

  const poolAfterVoid = await getTeamPool(mAlice.id);
  check(
    "a team used in a void week becomes selectable again",
    poolAfterVoid.teams.find((t) => t.externalId === 7)?.used === false,
  );
  check(
    "a team used in a real week stays used after a void week",
    poolAfterVoid.teams.find((t) => t.externalId === 1)?.used === true,
  );

  // ── Scenario 3b: a voided first week keeps entries open ──────────
  console.log("\nScenario 3b — a voided first gameweek leaves the league OPEN");

  const [una, vic] = await Promise.all([makeUser("Una"), makeUser("Vic")]);
  const voidLeague = await makeLeague("Void Opener", "VOID42", una.id);
  const [mUna, mVic] = await Promise.all(
    [una, vic].map((user) =>
      prisma.leagueMember.create({
        data: { leagueId: voidLeague.id, userId: user.id },
      }),
    ),
  );

  const vgw1 = await makeGameweek(voidLeague.id, 1);
  await submitPick({ memberId: mUna.id, gameweekId: vgw1.id, teamExternalId: 1 });
  await submitPick({ memberId: mVic.id, gameweekId: vgw1.id, teamExternalId: 3 });

  const sVoid = await settleGameweek({
    gameweekId: vgw1.id,
    winningTeamExternalIds: [2, 4],
  });

  check("first week voids when everyone loses", sVoid.voided);
  check(
    "a voided first week leaves the league OPEN to entrants",
    (await prisma.league.findUniqueOrThrow({ where: { id: voidLeague.id } })).status === "OPEN",
  );

  // Relaunching a matchday snapshots the same football-data match ids into a
  // new gameweek — that must not collide (regression: externalId was globally
  // unique, so launching a matchday twice blew up with P2002).
  const vgw2 = await makeGameweek(voidLeague.id, 2);
  const reused = await prisma.fixture.findFirstOrThrow({
    where: { gameweekId: vgw1.id },
  });
  const duplicateAllowed = await prisma.fixture
    .create({
      data: {
        gameweekId: vgw2.id,
        externalId: reused.externalId,
        homeTeamId: reused.homeTeamId,
        homeTeamName: reused.homeTeamName,
        homeTeamTla: reused.homeTeamTla,
        awayTeamId: reused.awayTeamId,
        awayTeamName: reused.awayTeamName,
        awayTeamTla: reused.awayTeamTla,
        kickoff: reused.kickoff,
      },
    })
    .then(() => true)
    .catch(() => false);
  check("a match id can appear in two gameweeks' fixtures", duplicateAllowed);

  // ── Scenario 4: deadline lock ────────────────────────────────────
  console.log("\nScenario 4 — the deadline closes picks");

  const gw3 = await makeGameweek(league.id, 3, { deadlineOffsetMs: -HOUR });
  await expectRuleError("cannot pick after the deadline", () =>
    submitPick({ memberId: mAlice.id, gameweekId: gw3.id, teamExternalId: 11 }),
  );

  // ── Scenario 5: last player standing completes the league ────────
  console.log("\nScenario 5 — the final survivor completes the league");

  await prisma.pick.createMany({
    data: [
      { memberId: mAlice.id, gameweekId: gw3.id, teamExternalId: 11, teamName: "Team 11", teamTla: "T11", poolRound: 1 },
      { memberId: mDan.id, gameweekId: gw3.id, teamExternalId: 13, teamName: "Team 13", teamTla: "T13", poolRound: 1 },
    ],
  });

  const summary3 = await settleGameweek({
    gameweekId: gw3.id,
    winningTeamExternalIds: [11, 14],
  });

  check("one survivor remains", summary3.survived.length === 1);
  check("league is reported complete", summary3.leagueComplete);
  check("Dan is eliminated", (await statusOf(mDan.id)).status === MemberStatus.ELIMINATED);
  check(
    "league status is COMPLETE",
    (await prisma.league.findUniqueOrThrow({ where: { id: league.id } })).status === "COMPLETE",
  );

  // ── Scenario 6: pool reset after all 20 teams are used ───────────
  console.log("\nScenario 6 — the team pool resets once all 20 are used");

  const eve = await makeUser("Eve");
  const frank = await makeUser("Frank");
  const league2 = await makeLeague("Pool League", "XYZ789", eve.id);
  const mEve = await prisma.leagueMember.create({
    data: { leagueId: league2.id, userId: eve.id },
  });
  const mFrank = await prisma.leagueMember.create({
    data: { leagueId: league2.id, userId: frank.id },
  });

  // Eve has already used teams 1–19 across settled weeks.
  for (let week = 1; week <= 19; week += 1) {
    const gw = await prisma.gameweek.create({
      data: {
        leagueId: league2.id,
        weekNumber: week,
        matchday: week,
        deadline: new Date(Date.now() - (30 - week) * 24 * HOUR),
        status: GameweekStatus.SETTLED,
        settledAt: new Date(),
      },
    });
    await prisma.pick.create({
      data: {
        memberId: mEve.id,
        gameweekId: gw.id,
        teamExternalId: week,
        teamName: `Team ${week}`,
        teamTla: `T${String(week).padStart(2, "0")}`,
        poolRound: 1,
        outcome: PickOutcome.WON,
      },
    });
  }

  const poolBeforeReset = await getTeamPool(mEve.id);
  check(
    "19 of 20 teams show as used before the reset",
    poolBeforeReset.teams.filter((t) => t.used).length === 19,
  );

  const gw20 = await makeGameweek(league2.id, 20);
  await submitPick({ memberId: mEve.id, gameweekId: gw20.id, teamExternalId: 20 });
  await submitPick({ memberId: mFrank.id, gameweekId: gw20.id, teamExternalId: 1 });

  const summary4 = await settleGameweek({
    gameweekId: gw20.id,
    winningTeamExternalIds: [1, 20],
  });

  check("Eve's pool round increments", (await statusOf(mEve.id)).poolRound === 2);
  check("the reset is reported", summary4.poolResets.includes(mEve.id));
  check("Frank's pool does not reset", (await statusOf(mFrank.id)).poolRound === 1);

  const poolAfterReset = await getTeamPool(mEve.id);
  check(
    "every team is selectable again after a reset",
    poolAfterReset.teams.every((t) => !t.used),
    `${poolAfterReset.teams.filter((t) => t.used).length} still marked used`,
  );
  check(
    "Frank keeps his used team after Eve's reset",
    (await getTeamPool(mFrank.id)).teams.find((t) => t.externalId === 1)?.used === true,
  );

  // ── Scenario 7: a lifeline saves a losing pick ───────────────────
  console.log("\nScenario 7 — a lifeline burns instead of eliminating a loser");

  const gina = await makeUser("Gina");
  const hank = await makeUser("Hank");
  const league3 = await makeLeague("Lifeline League", "QQQ222", gina.id);
  const mGina = await prisma.leagueMember.create({
    data: { leagueId: league3.id, userId: gina.id, lifelines: 1 },
  });
  const mHank = await prisma.leagueMember.create({
    data: { leagueId: league3.id, userId: hank.id },
  });

  const l3gw1 = await makeGameweek(league3.id, 1);
  await submitPick({ memberId: mGina.id, gameweekId: l3gw1.id, teamExternalId: 1 });
  await submitPick({ memberId: mHank.id, gameweekId: l3gw1.id, teamExternalId: 3 });

  const s7 = await settleGameweek({
    gameweekId: l3gw1.id,
    winningTeamExternalIds: [2, 3],
  });

  check("saved list contains the lifeline holder", s7.saved.includes(mGina.id));
  check("lifeline holder stays alive after losing", (await statusOf(mGina.id)).status === MemberStatus.ALIVE);
  check("lifeline count decrements to zero", (await statusOf(mGina.id)).lifelines === 0);
  check("saved pick is marked SAVED", (await outcomeOf(mGina.id, l3gw1.id)) === PickOutcome.SAVED);
  check("winner is unaffected by another's lifeline", (await outcomeOf(mHank.id, l3gw1.id)) === PickOutcome.WON);
  check("league is not complete with two still alive", !s7.leagueComplete);
  check(
    "a SAVED team still counts as used",
    (await getTeamPool(mGina.id)).teams.find((t) => t.externalId === 1)?.used === true,
  );

  // ── Scenario 8: a lifeline saves a missed pick ───────────────────
  console.log("\nScenario 8 — a lifeline saves a player who never picked");

  await prisma.leagueMember.update({
    where: { id: mGina.id },
    data: { lifelines: 1 },
  });

  const l3gw2 = await makeGameweek(league3.id, 2);
  await submitPick({ memberId: mHank.id, gameweekId: l3gw2.id, teamExternalId: 5 });

  const s8 = await settleGameweek({
    gameweekId: l3gw2.id,
    winningTeamExternalIds: [5],
  });

  check("no-pick player with lifeline is saved", s8.saved.includes(mGina.id));
  check("no-pick player stays alive", (await statusOf(mGina.id)).status === MemberStatus.ALIVE);
  check("lifeline burned by the missed pick", (await statusOf(mGina.id)).lifelines === 0);
  check("nobody reported eliminated", s8.eliminated.length === 0 && s8.missed.length === 0);

  // ── Scenario 9: void weeks never burn lifelines ──────────────────
  console.log("\nScenario 9 — a void week leaves lifelines untouched");

  await prisma.leagueMember.update({
    where: { id: mGina.id },
    data: { lifelines: 1 },
  });

  const l3gw3 = await makeGameweek(league3.id, 3);
  await submitPick({ memberId: mGina.id, gameweekId: l3gw3.id, teamExternalId: 7 });
  await submitPick({ memberId: mHank.id, gameweekId: l3gw3.id, teamExternalId: 9 });

  const s9 = await settleGameweek({
    gameweekId: l3gw3.id,
    winningTeamExternalIds: [8, 10],
  });

  check("all-fail round still voids with lifelines in hand", s9.voided);
  check("lifeline is not burned in a void week", (await statusOf(mGina.id)).lifelines === 1);

  // ── Scenario 10: exhausted lifelines, then revive ────────────────
  console.log("\nScenario 10 — elimination after the last lifeline, then revive");

  const l3gw4 = await makeGameweek(league3.id, 4);
  await submitPick({ memberId: mGina.id, gameweekId: l3gw4.id, teamExternalId: 9 });
  await submitPick({ memberId: mHank.id, gameweekId: l3gw4.id, teamExternalId: 11 });
  await settleGameweek({ gameweekId: l3gw4.id, winningTeamExternalIds: [11] });

  check("last lifeline burned on second loss", (await statusOf(mGina.id)).lifelines === 0);
  check("still alive after burning last lifeline", (await statusOf(mGina.id)).status === MemberStatus.ALIVE);

  const l3gw5 = await makeGameweek(league3.id, 5);
  await submitPick({ memberId: mGina.id, gameweekId: l3gw5.id, teamExternalId: 13 });
  await submitPick({ memberId: mHank.id, gameweekId: l3gw5.id, teamExternalId: 15 });
  const s10 = await settleGameweek({
    gameweekId: l3gw5.id,
    winningTeamExternalIds: [15],
  });

  check("no lifeline left — player is eliminated", (await statusOf(mGina.id)).status === MemberStatus.ELIMINATED);
  check("league completes with one survivor", s10.leagueComplete);
  check(
    "league marked COMPLETE",
    (await prisma.league.findUniqueOrThrow({ where: { id: league3.id } })).status === "COMPLETE",
  );

  await expectRuleError("cannot revive a player who is still alive", () =>
    reviveMember(mHank.id),
  );

  const reviveResult = await reviveMember(mGina.id);
  const revived = await statusOf(mGina.id);

  check("revived player is alive again", revived.status === MemberStatus.ALIVE);
  check("revive clears the elimination gameweek", revived.eliminatedAtGameweekId === null);
  check("revive clears the elimination timestamp", revived.eliminatedAt === null);
  check("reviving into a finished league reopens it", reviveResult.leagueReopened);
  check(
    "league back to IN_PROGRESS after revive",
    (await prisma.league.findUniqueOrThrow({ where: { id: league3.id } })).status === "IN_PROGRESS",
  );
  check(
    "revived player keeps their used teams",
    (await getTeamPool(mGina.id)).teams.find((t) => t.externalId === 13)?.used === true,
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("\nHarness crashed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
