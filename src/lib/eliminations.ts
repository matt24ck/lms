import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";

export class EliminationError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "EliminationError";
  }
}

export async function processEliminationsForGameweek(
  gameweekId: string,
  opts: { sendEmails?: boolean } = {}
): Promise<{ eliminated: number; survived: number }> {
  const sendEmails = opts.sendEmails ?? true;

  const gameweek = await prisma.gameweek.findUnique({
    where: { id: gameweekId },
    include: { competition: true },
  });

  if (!gameweek) {
    throw new EliminationError("Gameweek not found", 404);
  }
  if (gameweek.eliminationsProcessed) {
    throw new EliminationError(
      "Eliminations have already been processed for this gameweek",
      409
    );
  }
  // Safety check: don't eliminate for "no pick" if deadline hasn't passed
  if (new Date() < gameweek.deadline) {
    throw new EliminationError(
      "Cannot process eliminations before the gameweek deadline",
      400
    );
  }

  let eliminated = 0;
  let survived = 0;

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
  const selectionsByUser = new Map(allSelections.map((s) => [s.userId, s]));

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
    } else if (selection.result === "LOSS" || selection.result === "DRAW") {
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
    } else if (selection.result === "VOID") {
      // Fixture postponed/void — pick is safe, no email
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
    if (sendEmails) {
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
  }

  // Send win emails (non-blocking)
  if (sendEmails) {
    const winningSelections = allSelections.filter((s) => s.result === "WIN");
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
            .catch((err) => console.error("Failed to send win email:", err));
        }
      }
    }
  }

  // Mark this gameweek as processed so it won't be re-processed
  await prisma.gameweek.update({
    where: { id: gameweek.id },
    data: { eliminationsProcessed: true },
  });

  return { eliminated, survived };
}
