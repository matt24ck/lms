import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getResend } from "@/lib/resend";
import { format } from "date-fns";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find upcoming gameweek
    const gameweek = await prisma.gameweek.findFirst({
      where: {
        status: "UPCOMING",
        competition: { status: "ACTIVE" },
      },
      include: { competition: true },
      orderBy: { weekNumber: "asc" },
    });

    if (!gameweek) {
      return NextResponse.json({ message: "No upcoming gameweek" });
    }

    // Find active players who haven't picked yet
    const activePlayers = await prisma.competitionUser.findMany({
      where: {
        competitionId: gameweek.competitionId,
        isEliminated: false,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    let reminded = 0;

    for (const player of activePlayers) {
      const selection = await prisma.selection.findUnique({
        where: {
          userId_gameweekId: {
            userId: player.userId,
            gameweekId: gameweek.id,
          },
        },
      });

      if (!selection && player.user.email) {
        try {
          await getResend().emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to: player.user.email,
            subject: `LMS Reminder - Pick your team for Gameweek ${gameweek.weekNumber}`,
            html: `
              <h1>Last Man Standing</h1>
              <p>Hi ${player.user.name ?? "there"},</p>
              <p>You haven't made your pick for <strong>Gameweek ${gameweek.weekNumber}</strong> yet!</p>
              <p><strong>Deadline:</strong> ${format(gameweek.deadline, "EEEE d MMMM, HH:mm")}</p>
              <p>Don't forget - if you don't pick, you'll be eliminated!</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/pick">Make your pick now</a></p>
            `,
          });
          reminded++;
        } catch (emailError) {
          console.error("Failed to send reminder:", emailError);
        }
      }
    }

    return NextResponse.json({
      message: `Sent ${reminded} reminders for GW ${gameweek.weekNumber}`,
    });
  } catch (error) {
    console.error("send-reminders error:", error);
    return NextResponse.json(
      { error: "Failed to send reminders" },
      { status: 500 }
    );
  }
}
