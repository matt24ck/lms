import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { discordId, competitionId } = await req.json();

  if (!discordId || !competitionId) {
    return NextResponse.json(
      { error: "Discord ID and competition ID are required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { discordId },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found. They must sign in at least once first." },
      { status: 404 }
    );
  }

  const existing = await prisma.competitionUser.findUnique({
    where: {
      userId_competitionId: {
        userId: user.id,
        competitionId,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "User is already in this competition" },
      { status: 400 }
    );
  }

  await prisma.competitionUser.create({
    data: {
      userId: user.id,
      competitionId,
    },
  });

  return NextResponse.json({
    success: true,
    username: user.discordUsername,
  });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId, competitionId } = await req.json();

  if (!userId || !competitionId) {
    return NextResponse.json(
      { error: "User ID and competition ID are required" },
      { status: 400 }
    );
  }

  await prisma.competitionUser.delete({
    where: {
      userId_competitionId: {
        userId,
        competitionId,
      },
    },
  });

  return NextResponse.json({ success: true });
}
