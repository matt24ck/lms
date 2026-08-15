"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { syncTeamsAction } from "@/lib/actions/gameweeks";
import type { ActionState } from "@/lib/actions/leagues";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = {};

export function SyncTeamsButton({ teamCount }: { teamCount: number }) {
  const [state, formAction, pending] = useActionState(
    syncTeamsAction,
    initialState,
  );

  return (
    <div className="space-y-3">
      <form action={formAction}>
        <Button
          type="submit"
          variant={teamCount === 0 ? "primary" : "secondary"}
          size="sm"
          disabled={pending}
        >
          <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
          {pending ? "Syncing…" : teamCount === 0 ? "Sync teams" : "Re-sync teams"}
        </Button>
      </form>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
    </div>
  );
}
