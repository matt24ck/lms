import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const activeCompetition = await prisma.competition.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeCompetition) {
    return NextResponse.json({ gameweeks: [] });
  }

  const gameweeks = await prisma.gameweek.findMany({
    where: { competitionId: activeCompetition.id },
    orderBy: { weekNumber: "desc" },
    select: { id: true, weekNumber: true, status: true, deadline: true },
  });

  return NextResponse.json({ gameweeks });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { competitionId, weekNumber, deadline, apiMatchday } = await req.json();

  if (!competitionId || !weekNumber || !deadline) {
    return NextResponse.json(
      { error: "competitionId, weekNumber, and deadline are required" },
      { status: 400 }
    );
  }

  const gameweek = await prisma.gameweek.create({
    data: {
      competitionId,
      weekNumber,
      deadline: new Date(deadline),
      apiMatchday: apiMatchday ?? null,
    },
  });

  return NextResponse.json({ gameweek });
}

export async function DELETE(req: Request) {
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

    // Delete the gameweek (cascade deletes selections, fixtures, free passes)
    await tx.gameweek.delete({
      where: { id: gameweekId },
    });
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { gameweekId, status, deadline } = await req.json();

  if (!gameweekId) {
    return NextResponse.json(
      { error: "gameweekId is required" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (deadline) data.deadline = new Date(deadline);

  const gameweek = await prisma.gameweek.update({
    where: { id: gameweekId },
    data,
  });

  return NextResponse.json({ gameweek });
}
