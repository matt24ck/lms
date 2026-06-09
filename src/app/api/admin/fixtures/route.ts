import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  FixtureResult,
  SelectionResult,
} from "@/generated/prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const gameweekId = searchParams.get("gameweekId");

  if (!gameweekId) {
    return NextResponse.json(
      { error: "gameweekId is required" },
      { status: 400 }
    );
  }

  const fixtures = await prisma.fixture.findMany({
    where: { gameweekId },
    orderBy: { kickoff: "asc" },
    select: {
      id: true,
      homeTeamId: true,
      homeTeam: true,
      awayTeamId: true,
      awayTeam: true,
      kickoff: true,
      result: true,
    },
  });

  return NextResponse.json({ fixtures });
}

const VALID_RESULTS = ["HOME_WIN", "DRAW", "AWAY_WIN", "POSTPONED"] as const;

// Maps a fixture result to the selection results for the home and away teams
function deriveSelectionResults(result: FixtureResult | null): {
  home: SelectionResult;
  away: SelectionResult;
} {
  switch (result) {
    case "HOME_WIN":
      return { home: "WIN", away: "LOSS" };
    case "AWAY_WIN":
      return { home: "LOSS", away: "WIN" };
    case "DRAW":
      return { home: "DRAW", away: "DRAW" };
    case "POSTPONED":
      return { home: "VOID", away: "VOID" };
    default:
      return { home: "PENDING", away: "PENDING" };
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { fixtureId, result } = await req.json();

  if (!fixtureId) {
    return NextResponse.json(
      { error: "fixtureId is required" },
      { status: 400 }
    );
  }

  if (result !== null && !VALID_RESULTS.includes(result)) {
    return NextResponse.json(
      { error: "result must be HOME_WIN, DRAW, AWAY_WIN, POSTPONED, or null" },
      { status: 400 }
    );
  }

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: { gameweek: true },
  });

  if (!fixture) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  if (fixture.gameweek.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Gameweek is finalized. Unfinalize it before editing results." },
      { status: 409 }
    );
  }

  const derived = deriveSelectionResults(result);

  // No PENDING filter on the updates — corrections overwrite previous results
  const updated = await prisma.$transaction(async (tx) => {
    const updatedFixture = await tx.fixture.update({
      where: { id: fixtureId },
      data: { result },
    });

    await tx.selection.updateMany({
      where: {
        gameweekId: fixture.gameweekId,
        teamApiId: fixture.homeTeamId,
      },
      data: { result: derived.home },
    });

    await tx.selection.updateMany({
      where: {
        gameweekId: fixture.gameweekId,
        teamApiId: fixture.awayTeamId,
      },
      data: { result: derived.away },
    });

    return updatedFixture;
  });

  return NextResponse.json({ fixture: updated });
}
