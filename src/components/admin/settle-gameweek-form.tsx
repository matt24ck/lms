"use client";

import { useActionState, useState } from "react";
import { Flag } from "lucide-react";
import { settleGameweekAction } from "@/lib/actions/gameweeks";
import type { ActionState } from "@/lib/actions/leagues";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface SettleFixture {
  id: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  kickoff: string;
  /** How many players in this league backed each side. */
  homePicks: number;
  awayPicks: number;
}

type Outcome = "home" | "none" | "away";

const initialState: ActionState = {};

export function SettleGameweekForm({
  leagueId,
  gameweekId,
  weekNumber,
  fixtures,
  playersWithoutPick,
}: {
  leagueId: string;
  gameweekId: string;
  weekNumber: number;
  fixtures: SettleFixture[];
  playersWithoutPick: number;
}) {
  const [state, formAction, pending] = useActionState(
    settleGameweekAction,
    initialState,
  );
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>(() =>
    Object.fromEntries(fixtures.map((f) => [f.id, "none" as Outcome])),
  );

  const survivingPicks = fixtures.reduce((total, fixture) => {
    const outcome = outcomes[fixture.id];
    if (outcome === "home") return total + fixture.homePicks;
    if (outcome === "away") return total + fixture.awayPicks;
    return total;
  }, 0);

  const eliminatedPicks =
    fixtures.reduce((t, f) => t + f.homePicks + f.awayPicks, 0) - survivingPicks;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="leagueId" value={leagueId} />
      <input type="hidden" name="gameweekId" value={gameweekId} />

      {/* The radios below are grouped per fixture so each match is answered
          independently. The winning team ids are posted through these hidden
          inputs instead. */}
      {fixtures.map((fixture) => {
        const outcome = outcomes[fixture.id];
        const winningTeamId =
          outcome === "home"
            ? fixture.homeTeamId
            : outcome === "away"
              ? fixture.awayTeamId
              : null;

        return winningTeamId === null ? null : (
          <input
            key={fixture.id}
            type="hidden"
            name="winners"
            value={winningTeamId}
          />
        );
      })}

      <div className="space-y-2.5">
        {fixtures.map((fixture) => {
          const outcome = outcomes[fixture.id] ?? "none";

          return (
            <fieldset
              key={fixture.id}
              className="border-line bg-surface grid items-center gap-3 rounded-[12px] border p-3 sm:grid-cols-[1fr_auto]"
            >
              <legend className="sr-only">
                {fixture.homeTeamName} versus {fixture.awayTeamName}
              </legend>

              <div className="text-sm">
                <span className={outcome === "home" ? "text-pitch font-semibold" : ""}>
                  {fixture.homeTeamName}
                </span>
                <span className="text-ink-faint"> v </span>
                <span className={outcome === "away" ? "text-pitch font-semibold" : ""}>
                  {fixture.awayTeamName}
                </span>
                {fixture.homePicks + fixture.awayPicks > 0 ? (
                  <span className="text-ink-faint ml-2 text-xs">
                    ({fixture.homePicks + fixture.awayPicks} backing)
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <OutcomeOption
                  fixtureId={fixture.id}
                  label="Home win"
                  srLabel={`${fixture.homeTeamName} won`}
                  active={outcome === "home"}
                  onSelect={() =>
                    setOutcomes((prev) => ({ ...prev, [fixture.id]: "home" }))
                  }
                />
                <OutcomeOption
                  fixtureId={fixture.id}
                  label="Draw / no result"
                  srLabel={`${fixture.homeTeamName} v ${fixture.awayTeamName} drawn, postponed or no result`}
                  active={outcome === "none"}
                  onSelect={() =>
                    setOutcomes((prev) => ({ ...prev, [fixture.id]: "none" }))
                  }
                />
                <OutcomeOption
                  fixtureId={fixture.id}
                  label="Away win"
                  srLabel={`${fixture.awayTeamName} won`}
                  active={outcome === "away"}
                  onSelect={() =>
                    setOutcomes((prev) => ({ ...prev, [fixture.id]: "away" }))
                  }
                />
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="border-line bg-surface-sunken flex flex-wrap items-center gap-4 rounded-[12px] border p-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <Badge tone="alive">{survivingPicks} through</Badge>
        </span>
        <span className="inline-flex items-center gap-2">
          <Badge tone="out">
            {eliminatedPicks + playersWithoutPick} out
          </Badge>
        </span>
        {playersWithoutPick > 0 ? (
          <span className="text-ink-muted text-xs">
            includes {playersWithoutPick} who did not pick
          </span>
        ) : null}
      </div>

      {survivingPicks === 0 ? (
        <Alert tone="info" title="This would void the gameweek">
          With these results no remaining player survives, so the gameweek will
          be voided instead — nobody goes out and those teams become selectable
          again.
        </Alert>
      ) : null}

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="border-line flex flex-wrap items-center justify-between gap-4 border-t pt-5">
        <p className="text-ink-muted text-sm">
          Settling gameweek {weekNumber} eliminates every player whose team did
          not win. This cannot be undone.
        </p>
        <Button type="submit" disabled={pending}>
          <Flag className="size-4" aria-hidden />
          {pending ? "Settling…" : "End gameweek"}
        </Button>
      </div>
    </form>
  );
}

function OutcomeOption({
  fixtureId,
  label,
  srLabel,
  active,
  onSelect,
}: {
  fixtureId: string;
  label: string;
  srLabel: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "font-display cursor-pointer rounded-[8px] border px-2.5 py-1.5 text-[11px] font-bold tracking-[0.06em] uppercase transition-colors",
        "has-focus-visible:outline-gold has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
        active
          ? "border-crimson bg-crimson text-white"
          : "border-line bg-surface-raised text-ink-muted hover:text-ink",
      )}
    >
      {/* Grouped per fixture, so each match is answered on its own. */}
      <input
        type="radio"
        name={`outcome-${fixtureId}`}
        checked={active}
        onChange={onSelect}
        className="sr-only"
        aria-label={srLabel}
      />
      {label}
    </label>
  );
}
