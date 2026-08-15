"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminForAction } from "@/lib/guards";
import { GameRuleError, reviveMember } from "@/lib/lms";
import type { ActionState } from "@/lib/actions/leagues";

async function memberInLeague(memberId: string, leagueId: string) {
  const member = await prisma.leagueMember.findUnique({
    where: { id: memberId },
    select: { id: true, leagueId: true, user: { select: { name: true } } },
  });
  if (!member || member.leagueId !== leagueId) return null;
  return member;
}

/** Adds or removes one lifeline. Never drops below zero. */
export async function adjustLifelineAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdminForAction();
  } catch (error) {
    return { error: (error as Error).message };
  }

  const memberId = String(formData.get("memberId") ?? "");
  const leagueId = String(formData.get("leagueId") ?? "");
  const delta = Number(formData.get("delta"));

  if (!memberId || !leagueId || (delta !== 1 && delta !== -1)) {
    return { error: "Invalid lifeline change." };
  }

  const member = await memberInLeague(memberId, leagueId);
  if (!member) return { error: "That player is not in this league." };

  if (delta === 1) {
    await prisma.leagueMember.update({
      where: { id: memberId },
      data: { lifelines: { increment: 1 } },
    });
  } else {
    // Guarded decrement: a concurrent settle may have burned the last one.
    const result = await prisma.leagueMember.updateMany({
      where: { id: memberId, lifelines: { gt: 0 } },
      data: { lifelines: { decrement: 1 } },
    });
    if (result.count === 0) {
      return { error: `${member.user.name ?? "That player"} has no lifelines to remove.` };
    }
  }

  revalidatePath(`/admin/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}`);
  return {
    success:
      delta === 1
        ? `Lifeline granted to ${member.user.name ?? "player"}.`
        : `Lifeline removed from ${member.user.name ?? "player"}.`,
  };
}

/** Brings an eliminated player back into the competition. */
export async function reviveMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdminForAction();
  } catch (error) {
    return { error: (error as Error).message };
  }

  const memberId = String(formData.get("memberId") ?? "");
  const leagueId = String(formData.get("leagueId") ?? "");
  if (!memberId || !leagueId) return { error: "Missing player." };

  const member = await memberInLeague(memberId, leagueId);
  if (!member) return { error: "That player is not in this league." };

  try {
    const { leagueReopened } = await reviveMember(memberId);

    revalidatePath(`/admin/leagues/${leagueId}`);
    revalidatePath(`/leagues/${leagueId}`);
    return {
      success: `${member.user.name ?? "Player"} is back in the game${
        leagueReopened ? " — the league has been reopened" : ""
      }.`,
    };
  } catch (error) {
    if (error instanceof GameRuleError) return { error: error.message };
    console.error("reviveMemberAction failed", error);
    return { error: "Could not revive that player." };
  }
}
