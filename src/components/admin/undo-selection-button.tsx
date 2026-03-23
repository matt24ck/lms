"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
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

export function UndoSelectionButton({ selectionId }: { selectionId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleUndo() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/undo-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectionId }),
      });

      if (!res.ok) throw new Error("Failed to undo selection");

      setOpen(false);
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
        <Button variant="ghost" size="sm">
          <Undo2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Undo Selection</DialogTitle>
          <DialogDescription>
            This will delete the player&apos;s pick and un-eliminate them if they
            were eliminated because of it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleUndo} disabled={loading}>
            {loading ? "Undoing..." : "Confirm Undo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
