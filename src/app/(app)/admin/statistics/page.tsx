"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GameweekOption {
  id: string;
  weekNumber: number;
}

interface TeamDistribution {
  team: string;
  count: number;
  users: string[];
}

export default function AdminStatisticsPage() {
  const [gameweeks, setGameweeks] = useState<GameweekOption[]>([]);
  const [selectedGw, setSelectedGw] = useState<string>("");
  const [distribution, setDistribution] = useState<TeamDistribution[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadGameweeks() {
      const res = await fetch("/api/admin/gameweeks");
      if (res.ok) {
        const data = await res.json();
        setGameweeks(data.gameweeks);
        if (data.gameweeks.length > 0) {
          setSelectedGw(data.gameweeks[0].id);
        }
      }
    }
    loadGameweeks();
  }, []);

  useEffect(() => {
    if (!selectedGw) return;

    async function loadStats() {
      setLoading(true);
      const res = await fetch(
        `/api/admin/statistics?gameweekId=${selectedGw}`
      );
      if (res.ok) {
        const data = await res.json();
        setDistribution(data.distribution);
        setTotal(data.total);
      }
      setLoading(false);
    }
    loadStats();
  }, [selectedGw]);

  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading uppercase">
              Pick Distribution
            </CardTitle>
            <Select value={selectedGw} onValueChange={setSelectedGw}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Gameweek" />
              </SelectTrigger>
              <SelectContent>
                {gameweeks.map((gw) => (
                  <SelectItem key={gw.id} value={gw.id}>
                    Gameweek {gw.weekNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : distribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No picks for this gameweek.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {total} total picks
              </p>
              {distribution.map((item) => (
                <div key={item.team} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.team}</span>
                    <span className="text-muted-foreground">
                      {item.count} ({Math.round((item.count / total) * 100)}%)
                    </span>
                  </div>
                  <div className="h-6 w-full rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary transition-all"
                      style={{
                        width: `${(item.count / maxCount) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.users.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
