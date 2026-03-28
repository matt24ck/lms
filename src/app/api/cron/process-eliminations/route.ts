import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getResend } from "@/lib/resend";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find completed gameweeks that haven't been processed for eliminations yet
    const completedGameweeks = await prisma.gameweek.findMany({
      where: {
        status: "COMPLETED",
        eliminationsProcessed: false,
        competition: { status: "ACTIVE" },
      },
      include: {
        competition: true,
      },
    });

    let eliminated = 0;
    let survived = 0;

    for (const gameweek of completedGameweeks) {
      // Safety check: don't eliminate for "no pick" if deadline hasn't passed
      if (new Date() < gameweek.deadline) {
        continue;
      }

      // Batch-fetch all data for this gameweek in 3 queries instead of 2 per player
      const activePlayers = await prisma.competitionUser.findMany({
        where: {
          competitionId: gameweek.competitionId,
          isEliminated: false,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      const allSelections = await prisma.selection.findMany({
        where: { gameweekId: gameweek.id },
      });
      const selectionsByUser = new Map(
        allSelections.map((s) => [s.userId, s])
      );

      const allFreePasses = await prisma.freePass.findMany({
        where: { gameweekId: gameweek.id },
      });
      const freePassByUser = new Set(allFreePasses.map((fp) => fp.userId));

      // Determine who to eliminate
      const toEliminate: {
        player: (typeof activePlayers)[0];
        reason: string;
      }[] = [];

      for (const player of activePlayers) {
        const selection = selectionsByUser.get(player.userId);

        if (!selection) {
          toEliminate.push({ player, reason: "No pick submitted" });
        } else if (
          selection.result === "LOSS" ||
          selection.result === "DRAW"
        ) {
          if (freePassByUser.has(player.userId)) {
            survived++;
            continue;
          }
          const reason =
            selection.result === "LOSS"
              ? `${selection.teamName} lost`
              : `${selection.teamName} drew`;
          toEliminate.push({ player, reason });
        } else if (selection.result === "WIN") {
          survived++;
        }
        // PENDING results are skipped (no action)
      }

      // Batch eliminate all at once
      if (toEliminate.length > 0) {
        const eliminateIds = toEliminate.map((e) => e.player.id);
        await prisma.competitionUser.updateMany({
          where: { id: { in: eliminateIds } },
          data: {
            isEliminated: true,
            eliminatedAt: new Date(),
            eliminatedInGameweekId: gameweek.id,
          },
        });
        eliminated += toEliminate.length;

        // Send elimination emails (non-blocking, don't await each one)
        for (const { player, reason } of toEliminate) {
          if (player.user.email) {
            getResend()
              .emails.send({
                from: process.env.RESEND_FROM_EMAIL!,
                to: player.user.email,
                subject: `LMS Gameweek ${gameweek.weekNumber} - You've been eliminated`,
                html: `
                  <h1>Last Man Standing</h1>
                  <p>Hi ${player.user.name ?? "there"},</p>
                  <p>Unfortunately, you've been eliminated in Gameweek ${gameweek.weekNumber}.</p>
                  <p><strong>Reason:</strong> ${reason}</p>
                  <p>Better luck next time!</p>
                `,
              })
              .catch((err) =>
                console.error("Failed to send elimination email:", err)
              );
          }
        }
      }

      // Send win emails (non-blocking)
      const winningSelections = allSelections.filter(
        (s) => s.result === "WIN"
      );
      if (winningSelections.length > 0) {
        // Need user emails for winners — fetch in one query
        const winnerUserIds = winningSelections.map((s) => s.userId);
        const winnerUsers = await prisma.user.findMany({
          where: { id: { in: winnerUserIds } },
          select: { id: true, email: true, name: true },
        });
        const userMap = new Map(winnerUsers.map((u) => [u.id, u]));

        for (const sel of winningSelections) {
          const user = userMap.get(sel.userId);
          if (user?.email) {
            getResend()
              .emails.send({
                from: process.env.RESEND_FROM_EMAIL!,
                to: user.email,
                subject: `LMS Gameweek ${gameweek.weekNumber} - ${sel.teamName} Won!`,
                html: `
                  <h1>Last Man Standing</h1>
                  <p>Hi ${user.name ?? "there"},</p>
                  <p>Great news! <strong>${sel.teamName}</strong> won in Gameweek ${gameweek.weekNumber}.</p>
                  <p>You survive to the next round. Don't forget to make your pick!</p>
                `,
              })
              .catch((err) =>
                console.error("Failed to send win email:", err)
              );
          }
        }
      }

      // Mark this gameweek as processed so it won't be re-processed
      await prisma.gameweek.update({
        where: { id: gameweek.id },
        data: { eliminationsProcessed: true },
      });
    }

    return NextResponse.json({
      message: `Processed: ${eliminated} eliminated, ${survived} survived`,
    });
  } catch (error) {
    console.error("process-eliminations error:", error);
    return NextResponse.json(
      { error: "Failed to process eliminations" },
      { status: 500 }
    );
  }
}
