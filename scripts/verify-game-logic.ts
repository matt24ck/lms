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
import { GameRuleError, getTeamPool, settleGameweek, submitPick } from "@/lib/lms";
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

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("\nHarness crashed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
