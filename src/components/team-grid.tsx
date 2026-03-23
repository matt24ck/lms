"use client";

import { useState } from "react";
import Image from "next/image";
import { clsx } from "clsx";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Team {
  apiTeamId: number;
  name: string;
  shortName: string;
  tla: string;
  crestUrl: string | null;
}

interface UsedTeam {
  teamApiId: number;
  weekNumber: number;
}

interface TeamGridProps {
  teams: Team[];
  usedTeams: UsedTeam[];
  currentSelectionTeamId: number | null;
  gameweekId: string;
  gameweekNumber: number;
  isLocked: boolean;
  isEliminated: boolean;
}

export function TeamGrid({
  teams,
  usedTeams,
  currentSelectionTeamId,
  gameweekId,
  gameweekNumber,
  isLocked,
  isEliminated,
}: TeamGridProps) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPick, setCurrentPick] = useState<number | null>(
    currentSelectionTeamId
  );

  const usedTeamIds = new Set(usedTeams.map((t) => t.teamApiId));
  const usedTeamMap = new Map(usedTeams.map((t) => [t.teamApiId, t.weekNumber]));

  async function handleConfirm() {
    if (!selectedTeam) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/selections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameweekId,
          teamApiId: selectedTeam.apiTeamId,
          teamName: selectedTeam.shortName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit pick");
      }

      setCurrentPick(selectedTeam.apiTeamId);
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleTeamClick(team: Team) {
    if (isLocked || isEliminated) return;
    if (usedTeamIds.has(team.apiTeamId) && team.apiTeamId !== currentPick)
      return;

    setSelectedTeam(team);
    setConfirmOpen(true);
    setError(null);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {teams.map((team) => {
          const isUsed =
            usedTeamIds.has(team.apiTeamId) &&
            team.apiTeamId !== currentPick;
          const isSelected = team.apiTeamId === currentPick;
          const gwUsed = usedTeamMap.get(team.apiTeamId);

          return (
            <button
              key={team.apiTeamId}
              disabled={isUsed || isLocked || isEliminated}
              onClick={() => handleTeamClick(team)}
              className={clsx(
                "relative flex flex-col items-center gap-3 rounded-xl border p-4 transition-all",
                isSelected &&
                  "border-primary bg-primary/10 ring-2 ring-primary",
                isUsed &&
                  "cursor-not-allowed opacity-40 border-border bg-muted",
                !isSelected &&
                  !isUsed &&
                  !isLocked &&
                  !isEliminated &&
                  "border-border bg-card hover:border-primary/50 hover:bg-card/80 cursor-pointer",
                (isLocked || isEliminated) &&
                  !isSelected &&
                  !isUsed &&
                  "cursor-not-allowed opacity-60 border-border bg-card"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="h-5 w-5 text-primary" />
                </div>
              )}
              {isUsed && (
                <div className="absolute top-2 right-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
              )}

              {team.crestUrl ? (
                <Image
                  src={team.crestUrl}
                  alt={team.name}
                  width={48}
                  height={48}
                  className={clsx("h-12 w-12 object-contain", isUsed && "grayscale")}
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {team.tla}
                </div>
              )}

              <span
                className={clsx(
                  "text-center text-sm font-medium",
                  isUsed && "line-through text-muted-foreground"
                )}
              >
                {team.shortName}
              </span>

              {isUsed && gwUsed && (
                <span className="text-xs text-muted-foreground">
                  Used GW {gwUsed}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase">
              Confirm Your Pick
            </DialogTitle>
            <DialogDescription>
              Pick <strong>{selectedTeam?.shortName}</strong> for Gameweek{" "}
              {gameweekNumber}? You can change your pick before the deadline.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/50 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting ? "Submitting..." : "Confirm Pick"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
