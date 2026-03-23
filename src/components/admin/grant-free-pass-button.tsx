"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GrantFreePassButtonProps {
  userId: string;
  gameweekId: string;
}

export function GrantFreePassButton({
  userId,
  gameweekId,
}: GrantFreePassButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleGrant() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/free-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, gameweekId, reason: reason || null }),
      });

      if (!res.ok) throw new Error("Failed to grant free pass");

      setOpen(false);
      setReason("");
      router.refresh();
    } catch {
      // keep dialog open on error
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-[#22c55e]">
          <ShieldCheck className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant Free Pass</DialogTitle>
          <DialogDescription>
            This player will survive even if their pick loses or draws this
            gameweek.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason (optional)</Label>
          <Input
            id="reason"
            placeholder="e.g. Late joiner"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGrant} disabled={loading}>
            {loading ? "Granting..." : "Grant Free Pass"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
