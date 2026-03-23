"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AddMemberForm({ competitionId }: { competitionId: string }) {
  const [discordId, setDiscordId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId: discordId.trim(), competitionId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add member");

      setSuccess(`Added ${data.username ?? "user"} to the competition`);
      setDiscordId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading uppercase">Add Member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            placeholder="Discord User ID"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={loading || !discordId.trim()}>
            {loading ? "Adding..." : "Add"}
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
        {success && (
          <p className="mt-2 text-sm text-[#22c55e]">{success}</p>
        )}
      </CardContent>
    </Card>
  );
}
