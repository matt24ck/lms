import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await req.json();

  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { error: "Join code is required" },
      { status: 400 }
    );
  }

  const competition = await prisma.competition.findUnique({
    where: { joinCode: code.toUpperCase().trim() },
  });

  if (!competition) {
    return NextResponse.json(
      { error: "Invalid join code" },
      { status: 404 }
    );
  }

  if (competition.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "This competition is no longer accepting players" },
      { status: 400 }
    );
  }

  const existing = await prisma.competitionUser.findUnique({
    where: {
      userId_competitionId: {
        userId: session.user.id,
        competitionId: competition.id,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "You are already in this competition" },
      { status: 409 }
    );
  }

  await prisma.competitionUser.create({
    data: {
      userId: session.user.id,
      competitionId: competition.id,
    },
  });

  return NextResponse.json({
    message: `Joined "${competition.name}" successfully`,
    competitionName: competition.name,
  });
}
