"use client";

import { useActionState } from "react";
import { joinLeagueAction, type ActionState } from "@/lib/actions/leagues";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { JOIN_CODE_LENGTH } from "@/lib/join-code";

const initialState: ActionState = {};

export function JoinLeagueForm() {
  const [state, formAction, pending] = useActionState(
    joinLeagueAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="joinCode" className="mb-2">
          Join code
        </Label>
        <Input
          id="joinCode"
          name="joinCode"
          required
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          placeholder="ABC123"
          className="font-display text-center text-xl font-extrabold tracking-[0.4em] uppercase"
        />
        <p className="text-ink-faint mt-2 text-xs">
          {JOIN_CODE_LENGTH} characters from your league admin.
        </p>
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Joining…" : "Join league"}
      </Button>
    </form>
  );
}
