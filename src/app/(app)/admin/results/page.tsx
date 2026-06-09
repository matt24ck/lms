"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FixtureResult = "HOME_WIN" | "DRAW" | "AWAY_WIN" | "POSTPONED" | null;

interface Gameweek {
  id: string;
  weekNumber: number;
  status: string;
  deadline: string;
  apiMatchday: number | null;
  eliminationsProcessed: boolean;
  _count: { fixtures: number };
}

interface Fixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  result: FixtureResult;
}

const RESULT_OPTIONS: { value: Exclude<FixtureResult, null>; label: string }[] =
  [
    { value: "HOME_WIN", label: "Home win" },
    { value: "DRAW", label: "Draw" },
    { value: "AWAY_WIN", label: "Away win" },
    { value: "POSTPONED", label: "P-P" },
  ];

export default function AdminResultsPage() {
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedGw, setSelectedGw] = useState<string>("");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [sendEmails, setSendEmails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const gameweek = gameweeks.find((gw) => gw.id === selectedGw) ?? null;

  const loadGameweeks = useCallback(async (keepSelection?: string) => {
    const res = await fetch("/api/admin/gameweeks");
    if (res.ok) {
      const data = await res.json();
      setGameweeks(data.gameweeks);
      if (keepSelection) {
        setSelectedGw(keepSelection);
      } else if (data.gameweeks.length > 0) {
        const active = data.gameweeks.find(
          (gw: Gameweek) => gw.status === "ACTIVE"
        );
        setSelectedGw(active?.id ?? data.gameweeks[0].id);
      }
    }
  }, []);

  useEffect(() => {
    async function load() {
      await loadGameweeks();
    }
    load();
  }, [loadGameweeks]);

  const loadFixtures = useCallback(async () => {
    if (!selectedGw) return;
    const res = await fetch(`/api/admin/fixtures?gameweekId=${selectedGw}`);
    if (res.ok) {
      const data = await res.json();
      setFixtures(data.fixtures);
    }
  }, [selectedGw]);

  useEffect(() => {
    async function load() {
      await loadFixtures();
    }
    load();
  }, [loadFixtures]);

  async function handleSetResult(fixtureId: string, result: FixtureResult) {
    // Optimistic update; reload to confirm
    setFixtures((prev) =>
      prev.map((f) => (f.id === fixtureId ? { ...f, result } : f))
    );
    const res = await fetch("/api/admin/fixtures", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId, result }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Failed to update result");
    }
    loadFixtures();
  }

  async function handleFinalize() {
    if (!gameweek) return;
    const noFixtures = fixtures.length === 0;
    const confirmText = noFixtures
      ? `GW ${gameweek.weekNumber} has no fixtures. Finalize anyway? Only players without a pick will be eliminated.`
      : `Complete GW ${gameweek.weekNumber} and process eliminations? Players whose team lost or drew (or who didn't pick) will be eliminated${sendEmails ? " and emails will be sent" : ""}.`;
    if (!confirm(confirmText)) return;

    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/gameweeks/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameweekId: gameweek.id,
        sendEmails,
        confirmNoFixtures: noFixtures,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(
        `Gameweek completed: ${data.eliminated} eliminated, ${data.survived} survived.`
      );
      loadGameweeks(gameweek.id);
      loadFixtures();
    } else {
      setMessage(data.error ?? "Failed to finalize gameweek");
    }
    setBusy(false);
  }

  async function handleUnfinalize() {
    if (!gameweek) return;
    if (
      !confirm(
        `Unfinalize GW ${gameweek.weekNumber}? Players eliminated in this gameweek will be restored and the gameweek reopened for result edits. Re-finalize with "Send result emails" unticked to avoid duplicate emails.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/gameweeks/unfinalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameweekId: gameweek.id }),
    });
    if (res.ok) {
      setMessage("Gameweek reopened. Eliminated players have been restored.");
      loadGameweeks(gameweek.id);
      loadFixtures();
    } else {
      const data = await res.json();
      setMessage(data.error ?? "Failed to unfinalize gameweek");
    }
    setBusy(false);
  }

  async function handleRefreshFixtures() {
    if (!gameweek) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/gameweeks/refresh-fixtures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameweekId: gameweek.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Fixtures refreshed (${data.fixtureCount} fetched).`);
      loadFixtures();
    } else {
      setMessage(data.error ?? "Failed to refresh fixtures");
    }
    setBusy(false);
  }

  const isCompleted = gameweek?.status === "COMPLETED";
  const deadlinePassed = gameweek
    ? new Date() >= new Date(gameweek.deadline)
    : false;
  const resultsEntered = fixtures.filter((f) => f.result !== null).length;
  const allResultsIn = resultsEntered === fixtures.length;
  const canFinalize =
    gameweek?.status === "ACTIVE" && deadlinePassed && allResultsIn && !busy;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CardTitle className="font-heading uppercase">Results</CardTitle>
              {gameweek && (
                <Badge
                  variant={
                    isCompleted
                      ? "secondary"
                      : gameweek.status === "ACTIVE"
                        ? "default"
                        : "outline"
                  }
                >
                  {gameweek.status}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {gameweek?.apiMatchday !== null && gameweek && !isCompleted && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleRefreshFixtures}
                  disabled={busy}
                >
                  Refresh fixtures
                </Button>
              )}
              <Select
                value={selectedGw}
                onValueChange={(value) => {
                  setSelectedGw(value);
                  setMessage(null);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Gameweek" />
                </SelectTrigger>
                <SelectContent>
                  {gameweeks.map((gw) => (
                    <SelectItem key={gw.id} value={gw.id}>
                      Gameweek {gw.weekNumber} ({gw.status.toLowerCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {gameweek && (
            <p className="text-xs text-muted-foreground">
              Deadline: {new Date(gameweek.deadline).toLocaleString()}
              {!deadlinePassed && " (not yet passed)"}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!gameweek ? (
            <p className="text-sm text-muted-foreground">
              No gameweeks available. Create one on the Gameweeks page.
            </p>
          ) : fixtures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fixtures loaded for this gameweek.
              {gameweek.apiMatchday !== null
                ? " Use Refresh fixtures to fetch them."
                : " Set a PL matchday on the gameweek to fetch fixtures."}
            </p>
          ) : (
            <div className="space-y-2">
              {fixtures.map((fixture) => (
                <div
                  key={fixture.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {fixture.homeTeam}{" "}
                      <span className="text-muted-foreground">vs</span>{" "}
                      {fixture.awayTeam}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(fixture.kickoff), "EEE d MMM, HH:mm")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {RESULT_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={
                          fixture.result === opt.value ? "default" : "secondary"
                        }
                        disabled={isCompleted || busy}
                        onClick={() => handleSetResult(fixture.id, opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                    {fixture.result !== null && !isCompleted && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => handleSetResult(fixture.id, null)}
                        title="Clear result"
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {message && (
            <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
              {message}
            </p>
          )}

          {gameweek && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {fixtures.length > 0
                  ? `${resultsEntered} of ${fixtures.length} fixtures have results`
                  : "No fixtures"}
              </p>
              {isCompleted ? (
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={handleUnfinalize}
                >
                  Unfinalize gameweek
                </Button>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      id="sendEmails"
                      type="checkbox"
                      checked={sendEmails}
                      onChange={(e) => setSendEmails(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="sendEmails" className="text-sm">
                      Send result emails
                    </Label>
                  </div>
                  <Button disabled={!canFinalize} onClick={handleFinalize}>
                    {busy
                      ? "Processing..."
                      : "Complete gameweek & process eliminations"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
