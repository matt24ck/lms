"use client";

import { useActionState } from "react";
import { HeartPulse, Minus, Plus } from "lucide-react";
import {
  adjustLifelineAction,
  reviveMemberAction,
} from "@/lib/actions/members";
import type { ActionState } from "@/lib/actions/leagues";
import { cn } from "@/lib/utils";

const initialState: ActionState = {};

/** Compact +/- control for a member's lifeline count, used in the admin table. */
export function LifelineControl({
  leagueId,
  memberId,
  lifelines,
}: {
  leagueId: string;
  memberId: string;
  lifelines: number;
}) {
  const [state, formAction, pending] = useActionState(
    adjustLifelineAction,
    initialState,
  );

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <form action={formAction} className="inline-flex items-center gap-1.5">
        <input type="hidden" name="leagueId" value={leagueId} />
        <input type="hidden" name="memberId" value={memberId} />
        <button
          type="submit"
          name="delta"
          value="-1"
          disabled={pending || lifelines === 0}
          aria-label="Remove a lifeline"
          className={cn(
            "border-line bg-surface-raised text-ink-muted flex size-7 items-center justify-center rounded-[6px] border transition-colors",
            "hover:text-ink disabled:cursor-not-allowed disabled:opacity-35",
          )}
        >
          <Minus className="size-3.5" aria-hidden />
        </button>

        <span
          className={cn(
            "font-display min-w-7 text-center text-sm font-extrabold tabular-nums",
            lifelines > 0 ? "text-gold" : "text-ink-faint",
          )}
        >
          {lifelines}
        </span>

        <button
          type="submit"
          name="delta"
          value="1"
          disabled={pending}
          aria-label="Grant a lifeline"
          className={cn(
            "border-line bg-surface-raised text-ink-muted flex size-7 items-center justify-center rounded-[6px] border transition-colors",
            "hover:text-gold disabled:cursor-not-allowed disabled:opacity-35",
          )}
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </form>
      {state.error ? (
        <span className="text-flare max-w-40 text-center text-[11px] leading-tight">
          {state.error}
        </span>
      ) : null}
    </div>
  );
}

export function ReviveButton({
  leagueId,
  memberId,
  playerName,
}: {
  leagueId: string;
  memberId: string;
  playerName: string;
}) {
  const [state, formAction, pending] = useActionState(
    reviveMemberAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-start gap-1"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Bring ${playerName} back into the competition? Their pick history and used teams are kept.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="memberId" value={memberId} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "font-display inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[11px] font-bold tracking-[0.06em] uppercase transition-colors",
          "border-[#1d5c2c] bg-[#12301a] text-pitch hover:bg-[#173d21]",
          "disabled:cursor-not-allowed disabled:opacity-45",
        )}
      >
        <HeartPulse className="size-3.5" aria-hidden />
        {pending ? "Reviving…" : "Revive"}
      </button>
      {state.error ? (
        <span className="text-flare text-[11px]">{state.error}</span>
      ) : null}
    </form>
  );
}
