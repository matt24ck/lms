import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { selectionId } = await req.json();

  if (!selectionId) {
    return NextResponse.json(
      { error: "Selection ID is required" },
      { status: 400 }
    );
  }

  const selection = await prisma.selection.findUnique({
    where: { id: selectionId },
    include: { gameweek: true },
  });

  if (!selection) {
    return NextResponse.json(
      { error: "Selection not found" },
      { status: 404 }
    );
  }

  // Delete the selection
  await prisma.selection.delete({
    where: { id: selectionId },
  });

  // If user was eliminated because of this selection, un-eliminate them
  const competitionUser = await prisma.competitionUser.findUnique({
    where: {
      userId_competitionId: {
        userId: selection.userId,
        competitionId: selection.gameweek.competitionId,
      },
    },
  });

  if (
    competitionUser?.isEliminated &&
    competitionUser.eliminatedInGameweekId === selection.gameweekId
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

  return NextResponse.json({ success: true });
}
