"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Gameweek {
  id: string;
  weekNumber: number;
  status: string;
  deadline: string;
}

interface Competition {
  id: string;
  name: string;
  status: string;
  joinCode: string | null;
}

export default function AdminGameweeksPage() {
  const router = useRouter();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [showCreateComp, setShowCreateComp] = useState(false);
  const [showCreateGw, setShowCreateGw] = useState(false);
  const [compName, setCompName] = useState("");
  const [compSeason, setCompSeason] = useState("");
  const [gwNumber, setGwNumber] = useState("");
  const [gwDeadline, setGwDeadline] = useState("");
  const [gwMatchday, setGwMatchday] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const compRes = await fetch("/api/admin/competitions");
    if (compRes.ok) {
      const data = await compRes.json();
      setCompetition(data.competition);
    }

    const gwRes = await fetch("/api/admin/gameweeks");
    if (gwRes.ok) {
      const data = await gwRes.json();
      setGameweeks(data.gameweeks);
    }
  }

  async function handleCreateCompetition(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: compName, seasonLabel: compSeason }),
    });
    if (res.ok) {
      setShowCreateComp(false);
      setCompName("");
      setCompSeason("");
      loadData();
    }
    setLoading(false);
  }

  async function handleCreateGameweek(e: React.FormEvent) {
    e.preventDefault();
    if (!competition) return;
    setLoading(true);
    const res = await fetch("/api/admin/gameweeks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: competition.id,
        weekNumber: parseInt(gwNumber),
        deadline: gwDeadline,
        apiMatchday: gwMatchday ? parseInt(gwMatchday) : null,
      }),
    });
    if (res.ok) {
      setShowCreateGw(false);
      setGwNumber("");
      setGwDeadline("");
      setGwMatchday("");
      loadData();
    }
    setLoading(false);
  }

  async function handleUpdateStatus(gameweekId: string, status: string) {
    await fetch("/api/admin/gameweeks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameweekId, status }),
    });
    loadData();
  }

  async function handleDeleteGameweek(gameweekId: string, weekNumber: number) {
    if (
      !confirm(
        `Delete GW ${weekNumber}? This will remove all selections, fixtures, and free passes, and un-eliminate any players eliminated in this gameweek.`
      )
    ) {
      return;
    }
    await fetch("/api/admin/gameweeks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameweekId }),
    });
    loadData();
  }

  return (
    <div className="space-y-6">
      {/* Competition Management */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading uppercase">Competition</CardTitle>
        </CardHeader>
        <CardContent>
          {competition ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="font-heading text-lg font-bold">
                  {competition.name}
                </span>
                <Badge>{competition.status}</Badge>
              </div>
              {competition.joinCode && (
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Share this code with players to join:
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-3xl font-bold tracking-[0.3em]">
                      {competition.joinCode}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(competition.joinCode!);
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                No active competition. Create one to get started.
              </p>
              <Dialog open={showCreateComp} onOpenChange={setShowCreateComp}>
                <DialogTrigger asChild>
                  <Button>Create Competition</Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreateCompetition}>
                    <DialogHeader>
                      <DialogTitle>Create Competition</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          placeholder="e.g. LMS 2025/26"
                          value={compName}
                          onChange={(e) => setCompName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="season">Season</Label>
                        <Input
                          id="season"
                          placeholder="e.g. 2025/26"
                          value={compSeason}
                          onChange={(e) => setCompSeason(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={loading}>
                        {loading ? "Creating..." : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gameweeks */}
      {competition && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading uppercase">
                Gameweeks
              </CardTitle>
              <Dialog open={showCreateGw} onOpenChange={setShowCreateGw}>
                <DialogTrigger asChild>
                  <Button size="sm">Add Gameweek</Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreateGameweek}>
                    <DialogHeader>
                      <DialogTitle>Add Gameweek</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="gwNumber">Week Number</Label>
                        <Input
                          id="gwNumber"
                          type="number"
                          value={gwNumber}
                          onChange={(e) => setGwNumber(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gwDeadline">Deadline</Label>
                        <Input
                          id="gwDeadline"
                          type="datetime-local"
                          value={gwDeadline}
                          onChange={(e) => setGwDeadline(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gwMatchday">
                          API Matchday (optional)
                        </Label>
                        <Input
                          id="gwMatchday"
                          type="number"
                          placeholder="PL matchday number"
                          value={gwMatchday}
                          onChange={(e) => setGwMatchday(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={loading}>
                        {loading ? "Creating..." : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {gameweeks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No gameweeks created yet.
              </p>
            ) : (
              <div className="space-y-3">
                {gameweeks.map((gw) => (
                  <div
                    key={gw.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
                  >
                    <div>
                      <span className="font-heading font-bold">
                        GW {gw.weekNumber}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Deadline: {new Date(gw.deadline).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{gw.status}</Badge>
                      {gw.status === "UPCOMING" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleUpdateStatus(gw.id, "ACTIVE")}
                        >
                          Activate
                        </Button>
                      )}
                      {gw.status === "ACTIVE" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleUpdateStatus(gw.id, "COMPLETED")}
                        >
                          Complete
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          handleDeleteGameweek(gw.id, gw.weekNumber)
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
