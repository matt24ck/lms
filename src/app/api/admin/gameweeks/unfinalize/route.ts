import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { gameweekId } = await req.json();

  if (!gameweekId) {
    return NextResponse.json(
      { error: "gameweekId is required" },
      { status: 400 }
    );
  }

  const gameweek = await prisma.gameweek.findUnique({
    where: { id: gameweekId },
  });

  if (!gameweek) {
    return NextResponse.json({ error: "Gameweek not found" }, { status: 404 });
  }

  if (gameweek.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Only a completed gameweek can be unfinalized" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    // Un-eliminate all players who were eliminated in this gameweek
    await tx.competitionUser.updateMany({
      where: { eliminatedInGameweekId: gameweekId },
      data: {
        isEliminated: false,
        eliminatedAt: null,
        eliminatedInGameweekId: null,
      },
    });

    await tx.gameweek.update({
      where: { id: gameweekId },
      data: { status: "ACTIVE", eliminationsProcessed: false },
    });
  });

  return NextResponse.json({ success: true });
}
