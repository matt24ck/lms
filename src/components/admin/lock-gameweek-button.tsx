"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { lockGameweekAction } from "@/lib/actions/gameweeks";
import type { ActionState } from "@/lib/actions/leagues";
import { Button } from "@/components/ui/button";

const initialState: ActionState = {};

export function LockGameweekButton({
  leagueId,
  gameweekId,
}: {
  leagueId: string;
  gameweekId: string;
}) {
  const [state, formAction, pending] = useActionState(
    lockGameweekAction,
    initialState,
  );

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="gameweekId" value={gameweekId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        <Lock className="size-3.5" aria-hidden />
        {pending ? "Closing…" : "Close picks"}
      </Button>
      {state.error ? (
        <span className="text-flare text-xs">{state.error}</span>
      ) : null}
    </form>
  );
}
