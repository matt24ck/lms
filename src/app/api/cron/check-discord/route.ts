import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { isUserInGuild } from "@/lib/discord";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activeCompetition = await prisma.competition.findFirst({
      where: { status: "ACTIVE" },
    });

    if (!activeCompetition) {
      return NextResponse.json({ message: "No active competition" });
    }

    // Get all non-eliminated players
    const activePlayers = await prisma.competitionUser.findMany({
      where: {
        competitionId: activeCompetition.id,
        isEliminated: false,
      },
      include: {
        user: { select: { discordId: true, discordUsername: true } },
      },
    });

    let removed = 0;

    for (const player of activePlayers) {
      try {
        const inGuild = await isUserInGuild(player.user.discordId);

        if (!inGuild) {
          await prisma.competitionUser.update({
            where: { id: player.id },
            data: {
              isEliminated: true,
              eliminatedAt: new Date(),
            },
          });
          removed++;
          console.log(
            `Removed ${player.user.discordUsername} - no longer in Discord server`
          );
        }
      } catch (error) {
        console.error(
          `Failed to check Discord membership for ${player.user.discordUsername}:`,
          error
        );
      }
    }

    return NextResponse.json({
      message: `Checked ${activePlayers.length} players, removed ${removed}`,
    });
  } catch (error) {
    console.error("check-discord error:", error);
    return NextResponse.json(
      { error: "Failed to check Discord membership" },
      { status: 500 }
    );
  }
}
