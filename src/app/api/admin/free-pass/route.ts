import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId, gameweekId, reason } = await req.json();

  if (!userId || !gameweekId) {
    return NextResponse.json(
      { error: "User ID and gameweek ID are required" },
      { status: 400 }
    );
  }

  const freePass = await prisma.freePass.upsert({
    where: {
      userId_gameweekId: { userId, gameweekId },
    },
    update: {
      reason: reason ?? null,
      grantedBy: session.user.id,
    },
    create: {
      userId,
      gameweekId,
      reason: reason ?? null,
      grantedBy: session.user.id,
    },
  });

  // If the user was eliminated in this gameweek, un-eliminate them
  const gameweek = await prisma.gameweek.findUnique({
    where: { id: gameweekId },
  });

  if (gameweek) {
    const competitionUser = await prisma.competitionUser.findUnique({
      where: {
        userId_competitionId: {
          userId,
          competitionId: gameweek.competitionId,
        },
      },
    });

    if (
      competitionUser?.isEliminated &&
      competitionUser.eliminatedInGameweekId === gameweekId
    ) {
      await prisma.competitionUser.update({
        where: { id: competitionUser.id },
        data: {
          isEliminated: false,
          eliminatedAt: null,
          eliminatedInGameweekId: null,
        },
      });
    }
  }

  return NextResponse.json({ freePass });
}
