"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function JoinCompetitionForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/competitions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join competition");
      } else {
        setSuccess(data.message);
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="join-code"
          className="block text-sm font-medium text-muted-foreground mb-2"
        >
          Enter the 6-character code from your competition admin
        </label>
        <input
          id="join-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
          placeholder="e.g. AB3DEF"
          maxLength={6}
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] uppercase placeholder:text-muted-foreground/50 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-500">{success}</p>}

      <Button type="submit" disabled={code.length !== 6 || loading}>
        {loading ? "Joining..." : "Join Competition"}
      </Button>
    </form>
  );
}
