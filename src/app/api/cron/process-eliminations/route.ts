import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getResend } from "@/lib/resend";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find completed gameweeks that haven't been fully processed
    const completedGameweeks = await prisma.gameweek.findMany({
      where: {
        status: "COMPLETED",
        competition: { status: "ACTIVE" },
      },
      include: {
        competition: true,
      },
    });

    let eliminated = 0;
    let survived = 0;

    for (const gameweek of completedGameweeks) {
      // Get all active (non-eliminated) players in this competition
      const activePlayers = await prisma.competitionUser.findMany({
        where: {
          competitionId: gameweek.competitionId,
          isEliminated: false,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      for (const player of activePlayers) {
        // Check if they made a selection for this gameweek
        const selection = await prisma.selection.findUnique({
          where: {
            userId_gameweekId: {
              userId: player.userId,
              gameweekId: gameweek.id,
            },
          },
        });

        // Check for free pass
        const freePass = await prisma.freePass.findUnique({
          where: {
            userId_gameweekId: {
              userId: player.userId,
              gameweekId: gameweek.id,
            },
          },
        });

        let shouldEliminate = false;
        let reason = "";

        if (!selection) {
          // No pick = eliminated
          shouldEliminate = true;
          reason = "No pick submitted";
        } else if (selection.result === "LOSS" || selection.result === "DRAW") {
          if (freePass) {
            // Free pass saves them
            survived++;
            continue;
          }
          shouldEliminate = true;
          reason =
            selection.result === "LOSS"
              ? `${selection.teamName} lost`
              : `${selection.teamName} drew`;
        } else if (selection.result === "WIN") {
          survived++;
          continue;
        } else {
          // Result still PENDING - skip
          continue;
        }

        if (shouldEliminate) {
          // Check if already eliminated (idempotency)
          if (!player.isEliminated) {
            await prisma.competitionUser.update({
              where: { id: player.id },
              data: {
                isEliminated: true,
                eliminatedAt: new Date(),
                eliminatedInGameweekId: gameweek.id,
              },
            });
            eliminated++;

            // Send elimination email
            if (player.user.email) {
              try {
                await getResend().emails.send({
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
                });
              } catch (emailError) {
                console.error("Failed to send elimination email:", emailError);
              }
            }
          }
        }
      }

      // Send result emails to surviving players
      const winningSelections = await prisma.selection.findMany({
        where: {
          gameweekId: gameweek.id,
          result: "WIN",
        },
        include: {
          user: { select: { email: true, name: true } },
        },
      });

      for (const sel of winningSelections) {
        if (sel.user.email) {
          try {
            await getResend().emails.send({
              from: process.env.RESEND_FROM_EMAIL!,
              to: sel.user.email,
              subject: `LMS Gameweek ${gameweek.weekNumber} - ${sel.teamName} Won!`,
              html: `
                <h1>Last Man Standing</h1>
                <p>Hi ${sel.user.name ?? "there"},</p>
                <p>Great news! <strong>${sel.teamName}</strong> won in Gameweek ${gameweek.weekNumber}.</p>
                <p>You survive to the next round. Don't forget to make your pick!</p>
              `,
            });
          } catch (emailError) {
            console.error("Failed to send win email:", emailError);
          }
        }
      }
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
