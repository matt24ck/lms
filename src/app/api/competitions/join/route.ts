import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Simple in-memory rate limit: 5 attempts per user per minute
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = attempts.get(userId);
  if (!entry || now > entry.resetAt) {
    attempts.set(userId, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 5;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isRateLimited(session.user.id)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute." },
      { status: 429 }
    );
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
