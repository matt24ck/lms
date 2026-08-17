"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireAdminForAction } from "@/lib/guards";
import {
  JOIN_CODE_LENGTH,
  generateJoinCode,
  isValidJoinCodeShape,
  normaliseJoinCode,
} from "@/lib/join-code";

export interface ActionState {
  error?: string;
  success?: string;
}

const createLeagueSchema = z.object({
  name: z.string().trim().min(3, "Give the league a name of at least 3 characters.").max(60),
  season: z
    .string()
    .trim()
    .min(4, "Enter the season, for example 2026/27.")
    .max(12),
});

export async function createLeagueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let user;
  try {
    user = await requireAdminForAction();
  } catch (error) {
    return { error: (error as Error).message };
  }

  const parsed = createLeagueSchema.safeParse({
    name: formData.get("name"),
    season: formData.get("season"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }

  // Retry on the astronomically unlikely code collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = generateJoinCode();
    const existing = await prisma.league.findUnique({
      where: { joinCode },
      select: { id: true },
    });
    if (existing) continue;

    const league = await prisma.league.create({
      data: {
        name: parsed.data.name,
        season: parsed.data.season,
        joinCode,
        createdById: user.id,
        // The creator is enrolled so they can play too.
        members: { create: { userId: user.id } },
      },
      select: { id: true, joinCode: true },
    });

    revalidatePath("/admin");
    revalidatePath("/dashboard");
    return {
      success: `League created. Share join code ${league.joinCode}.`,
    };
  }

  return { error: "Could not generate a unique join code. Try again." };
}

export async function joinLeagueAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You need to sign in." };

  const raw = String(formData.get("joinCode") ?? "");
  const joinCode = normaliseJoinCode(raw);

  if (joinCode.length !== JOIN_CODE_LENGTH || !isValidJoinCodeShape(joinCode)) {
    return { error: `Enter the ${JOIN_CODE_LENGTH}-character join code.` };
  }

  const league = await prisma.league.findUnique({
    where: { joinCode },
    select: { id: true, name: true, status: true },
  });

  if (!league) {
    return { error: "No league found with that code. Check it and try again." };
  }
  if (league.status !== "OPEN") {
    return {
      error:
        league.status === "COMPLETE"
          ? "That league has finished."
          : "That league is already under way and is not taking new players.",
    };
  }

  // The league stays OPEN through its first gameweek so latecomers can still
  // get a pick in — but once that gameweek's picks close (deadline passed or
  // locked early), a new entrant couldn't play it, so entries pause until the
  // week is settled. A real result then closes the league for good; a voided
  // week reopens entries.
  const activeGameweek = await prisma.gameweek.findFirst({
    where: { leagueId: league.id, status: { in: ["OPEN", "LOCKED"] } },
    select: { status: true, deadline: true },
  });
  if (
    activeGameweek &&
    (activeGameweek.status === "LOCKED" ||
      activeGameweek.deadline.getTime() <= Date.now())
  ) {
    return {
      error:
        "Picks for that league's current gameweek have closed, so it is not taking new players right now.",
    };
  }

  const existing = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: league.id, userId: user.id } },
    select: { id: true },
  });
  if (existing) {
    return { error: `You are already in ${league.name}.` };
  }

  await prisma.leagueMember.create({
    data: { leagueId: league.id, userId: user.id },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/leagues/${league.id}`);
  return { success: `You're in — welcome to ${league.name}.` };
}
