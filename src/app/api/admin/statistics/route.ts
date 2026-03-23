import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const gameweekId = searchParams.get("gameweekId");

  if (!gameweekId) {
    return NextResponse.json(
      { error: "gameweekId is required" },
      { status: 400 }
    );
  }

  // Pick distribution for the gameweek
  const selections = await prisma.selection.findMany({
    where: { gameweekId },
    include: {
      user: {
        select: { discordUsername: true },
      },
    },
  });

  const teamCounts: Record<string, { count: number; users: string[] }> = {};
  for (const sel of selections) {
    if (!teamCounts[sel.teamName]) {
      teamCounts[sel.teamName] = { count: 0, users: [] };
    }
    teamCounts[sel.teamName].count++;
    teamCounts[sel.teamName].users.push(sel.user.discordUsername);
  }

  // Sort by count descending
  const distribution = Object.entries(teamCounts)
    .map(([team, data]) => ({ team, ...data }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ distribution, total: selections.length });
}
