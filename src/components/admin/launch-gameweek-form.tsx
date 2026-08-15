"use client";

import { useActionState } from "react";
import { Rocket } from "lucide-react";
import { launchGameweekAction } from "@/lib/actions/gameweeks";
import type { ActionState } from "@/lib/actions/leagues";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = {};

export function LaunchGameweekForm({
  leagueId,
  nextWeekNumber,
  suggestedMatchday,
  disabledReason,
}: {
  leagueId: string;
  nextWeekNumber: number;
  suggestedMatchday: number;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(
    launchGameweekAction,
    initialState,
  );

  if (disabledReason) {
    return <Alert tone="info">{disabledReason}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="leagueId" value={leagueId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="matchday" className="mb-2">
            Premier League matchday
          </Label>
          <Input
            id="matchday"
            name="matchday"
            type="number"
            min={1}
            max={38}
            required
            defaultValue={suggestedMatchday}
          />
          <p className="text-ink-faint mt-2 text-xs">
            Fixtures are pulled from football-data.org for this matchday.
          </p>
        </div>

        <div>
          <Label htmlFor="deadline" className="mb-2">
            Pick deadline (UK time)
          </Label>
          <Input id="deadline" name="deadline" type="datetime-local" />
          <p className="text-ink-faint mt-2 text-xs">
            Leave blank to use the first kick-off of the matchday.
          </p>
        </div>
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Button type="submit" disabled={pending}>
        <Rocket className="size-4" aria-hidden />
        {pending ? "Launching…" : `Launch gameweek ${nextWeekNumber}`}
      </Button>
    </form>
  );
}
