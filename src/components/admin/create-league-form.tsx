"use client";

import { useActionState } from "react";
import { createLeagueAction, type ActionState } from "@/lib/actions/leagues";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const initialState: ActionState = {};

export function CreateLeagueForm({ defaultSeason }: { defaultSeason: string }) {
  const [state, formAction, pending] = useActionState(
    createLeagueAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name" className="mb-2">
          League name
        </Label>
        <Input
          id="name"
          name="name"
          required
          minLength={3}
          maxLength={60}
          placeholder="The Office LMS"
        />
      </div>

      <div>
        <Label htmlFor="season" className="mb-2">
          Season
        </Label>
        <Input
          id="season"
          name="season"
          required
          defaultValue={defaultSeason}
          placeholder="2026/27"
        />
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create league"}
      </Button>
    </form>
  );
}
