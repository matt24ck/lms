"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { GameRuleError, submitPick } from "@/lib/lms";
import type { ActionState } from "@/lib/actions/leagues";

export async function submitPickAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to sign in." };

  const leagueId = String(formData.get("leagueId") ?? "");
  const gameweekId = String(formData.get("gameweekId") ?? "");
  const teamExternalId = Number(formData.get("teamExternalId"));

  if (!leagueId || !gameweekId || !Number.isFinite(teamExternalId)) {
    return { error: "Pick a team to continue." };
  }

  const member = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: user.id } },
    select: { id: true },
  });
  if (!member) return { error: "You are not in this league." };

  try {
    const pick = await submitPick({
      memberId: member.id,
      gameweekId,
      teamExternalId,
    });

    revalidatePath(`/leagues/${leagueId}`);
    revalidatePath(`/leagues/${leagueId}/pick`);
    return { success: `${pick.teamName} locked in.` };
  } catch (error) {
    if (error instanceof GameRuleError) return { error: error.message };
    console.error("submitPickAction failed", error);
    return { error: "Could not save your pick. Try again." };
  }
}
