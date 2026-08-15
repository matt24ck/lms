"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { Check, Lock } from "lucide-react";
import { submitPickAction } from "@/lib/actions/picks";
import type { ActionState } from "@/lib/actions/leagues";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PickableTeam {
  externalId: number;
  name: string;
  shortName: string;
  tla: string;
  crestUrl: string | null;
  /** Already used in the current pool round. */
  used: boolean;
  /** Opponent this gameweek, or null if the team is not playing. */
  opponent: string | null;
  venue: "H" | "A" | null;
  kickoff: string | null;
}

const initialState: ActionState = {};

export function TeamPicker({
  leagueId,
  gameweekId,
  teams,
  currentPickTeamId,
}: {
  leagueId: string;
  gameweekId: string;
  teams: PickableTeam[];
  currentPickTeamId: number | null;
}) {
  const [state, formAction, pending] = useActionState(
    submitPickAction,
    initialState,
  );
  const [selected, setSelected] = useState<number | null>(currentPickTeamId);

  const changed = selected !== null && selected !== currentPickTeamId;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="gameweekId" value={gameweekId} />
      <input type="hidden" name="teamExternalId" value={selected ?? ""} />

      <div
        role="radiogroup"
        aria-label="Choose your team"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {teams.map((team) => {
          const notPlaying = team.opponent === null;
          const disabled = team.used || notPlaying;
          const isSelected = selected === team.externalId;
          const isCurrent = currentPickTeamId === team.externalId;

          return (
            <button
              key={team.externalId}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => setSelected(team.externalId)}
              className={cn(
                "group relative flex flex-col items-start gap-3 rounded-[12px] border p-4 text-left transition-all",
                disabled
                  ? "border-line bg-surface-sunken cursor-not-allowed opacity-45"
                  : "border-line bg-surface hover:border-line-bright cursor-pointer hover:-translate-y-0.5",
                isSelected &&
                  !disabled &&
                  "border-crimson bg-crimson-night ring-crimson/40 ring-2",
              )}
            >
              {isSelected && !disabled ? (
                <span className="bg-crimson absolute top-3 right-3 flex size-5 items-center justify-center rounded-full">
                  <Check className="size-3 text-white" aria-hidden />
                </span>
              ) : null}
              {team.used ? (
                <span
                  className="text-ink-faint absolute top-3 right-3"
                  title="Already used"
                >
                  <Lock className="size-4" aria-hidden />
                </span>
              ) : null}

              <div className="flex items-center gap-2.5">
                {team.crestUrl ? (
                  <Image
                    src={team.crestUrl}
                    alt=""
                    width={32}
                    height={32}
                    className={cn("size-8 object-contain", team.used && "grayscale")}
                  />
                ) : (
                  <span className="bg-surface-raised font-display flex size-8 items-center justify-center rounded text-[10px] font-black">
                    {team.tla}
                  </span>
                )}
                <span className="font-display text-sm leading-tight font-extrabold uppercase">
                  {team.shortName}
                </span>
              </div>

              <span className="text-ink-muted text-xs">
                {notPlaying ? (
                  "Not playing this week"
                ) : team.used ? (
                  "Already used"
                ) : (
                  <>
                    {team.venue === "H" ? "vs " : "away at "}
                    {team.opponent}
                  </>
                )}
              </span>

              {isCurrent ? (
                <span className="text-gold font-display text-[10px] font-bold tracking-[0.1em] uppercase">
                  Current pick
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="border-line flex flex-wrap items-center justify-between gap-4 border-t pt-5">
        <p className="text-ink-muted text-sm">
          {selected === null
            ? "Select a team to continue."
            : changed
              ? `You're backing ${teams.find((t) => t.externalId === selected)?.name}.`
              : "This is already your pick for the week."}
        </p>
        <Button type="submit" disabled={pending || selected === null || !changed}>
          {pending
            ? "Saving…"
            : currentPickTeamId
              ? "Update pick"
              : "Lock in pick"}
        </Button>
      </div>
    </form>
  );
}
