import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchAndUpsertFixtures } from "@/lib/fixtures";

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

  if (gameweek.apiMatchday === null) {
    return NextResponse.json(
      { error: "This gameweek has no PL matchday set, so fixtures cannot be fetched" },
      { status: 400 }
    );
  }

  try {
    const fixtureCount = await fetchAndUpsertFixtures(
      gameweekId,
      gameweek.apiMatchday
    );
    return NextResponse.json({ fixtureCount });
  } catch (error) {
    console.error("refresh-fixtures error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fixtures from football-data.org" },
      { status: 502 }
    );
  }
}
