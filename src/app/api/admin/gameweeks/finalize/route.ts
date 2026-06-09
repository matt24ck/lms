import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  processEliminationsForGameweek,
  EliminationError,
} from "@/lib/eliminations";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { gameweekId, sendEmails, confirmNoFixtures } = await req.json();

  if (!gameweekId) {
    return NextResponse.json(
      { error: "gameweekId is required" },
      { status: 400 }
    );
  }

  const gameweek = await prisma.gameweek.findUnique({
    where: { id: gameweekId },
    include: { fixtures: true },
  });

  if (!gameweek) {
    return NextResponse.json({ error: "Gameweek not found" }, { status: 404 });
  }

  if (gameweek.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Only an active gameweek can be finalized" },
      { status: 400 }
    );
  }

  if (gameweek.eliminationsProcessed) {
    return NextResponse.json(
      { error: "Eliminations have already been processed for this gameweek" },
      { status: 409 }
    );
  }

  if (new Date() < gameweek.deadline) {
    return NextResponse.json(
      { error: "Cannot finalize before the gameweek deadline" },
      { status: 400 }
    );
  }

  const missingResults = gameweek.fixtures.filter((f) => f.result === null);
  if (missingResults.length > 0) {
    return NextResponse.json(
      {
        error: `${missingResults.length} fixture(s) still need a result: ${missingResults
          .map((f) => `${f.homeTeam} vs ${f.awayTeam}`)
          .join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (gameweek.fixtures.length === 0 && !confirmNoFixtures) {
    return NextResponse.json(
      {
        error:
          "This gameweek has no fixtures. Confirm to finalize anyway — only players without a pick will be eliminated.",
        requiresConfirmation: true,
      },
      { status: 400 }
    );
  }

  await prisma.gameweek.update({
    where: { id: gameweekId },
    data: { status: "COMPLETED" },
  });

  try {
    const { eliminated, survived } = await processEliminationsForGameweek(
      gameweekId,
      { sendEmails: sendEmails ?? true }
    );
    return NextResponse.json({ eliminated, survived });
  } catch (error) {
    // Roll back the status change so the admin can retry
    await prisma.gameweek.update({
      where: { id: gameweekId },
      data: { status: "ACTIVE" },
    });
    if (error instanceof EliminationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("finalize gameweek error:", error);
    return NextResponse.json(
      { error: "Failed to process eliminations" },
      { status: 500 }
    );
  }
}
