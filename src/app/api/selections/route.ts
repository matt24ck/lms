import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const selectionSchema = z.object({
  gameweekId: z.string(),
  teamApiId: z.number(),
  teamName: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = selectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { gameweekId, teamApiId, teamName } = parsed.data;

  // Get the gameweek and its competition
  const gameweek = await prisma.gameweek.findUnique({
    where: { id: gameweekId },
    include: { competition: true },
  });

  if (!gameweek) {
    return NextResponse.json(
      { error: "Gameweek not found" },
      { status: 404 }
    );
  }

  // Check deadline
  if (new Date() > gameweek.deadline || gameweek.status !== "UPCOMING") {
    return NextResponse.json(
      { error: "Selections are locked for this gameweek" },
      { status: 400 }
    );
  }

  // Check user is in the competition and not eliminated
  const competitionUser = await prisma.competitionUser.findUnique({
    where: {
      userId_competitionId: {
        userId: session.user.id,
        competitionId: gameweek.competitionId,
      },
    },
  });

  if (!competitionUser) {
    return NextResponse.json(
      { error: "You are not in this competition" },
      { status: 403 }
    );
  }

  if (competitionUser.isEliminated) {
    return NextResponse.json(
      { error: "You have been eliminated" },
      { status: 403 }
    );
  }

  // Check if team was already used in a different gameweek of this competition
  const previousUse = await prisma.selection.findFirst({
    where: {
      userId: session.user.id,
      teamApiId,
      gameweek: {
        competitionId: gameweek.competitionId,
        id: { not: gameweekId },
      },
    },
  });

  if (previousUse) {
    return NextResponse.json(
      { error: "You have already used this team in a previous gameweek" },
      { status: 400 }
    );
  }

  // Upsert the selection (allows changing pick before deadline)
  const selection = await prisma.selection.upsert({
    where: {
      userId_gameweekId: {
        userId: session.user.id,
        gameweekId,
      },
    },
    update: {
      teamApiId,
      teamName,
      result: "PENDING",
    },
    create: {
      userId: session.user.id,
      gameweekId,
      teamApiId,
      teamName,
      result: "PENDING",
    },
  });

  return NextResponse.json({ selection });
}
