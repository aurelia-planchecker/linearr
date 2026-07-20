"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCycle } from "@/lib/actions";

export function NewCycleButton({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState({ start: "", end: "" });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next)
          setDefaults({
            start: new Date().toISOString().slice(0, 10),
            end: new Date(Date.now() + 13 * 864e5).toISOString().slice(0, 10),
          });
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
          <Plus className="size-3.5" /> New cycle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New cycle</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          action={async (fd: FormData) => {
            await createCycle(
              workspaceSlug,
              projectId,
              String(fd.get("start")),
              String(fd.get("end")),
              String(fd.get("name") || "")
            );
            setOpen(false);
            router.refresh();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name (optional)</Label>
            <Input id="c-name" name="name" placeholder="Cycle 4" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-start">Start</Label>
              <Input
                id="c-start"
                name="start"
                type="date"
                required
                defaultValue={defaults.start}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-end">End</Label>
              <Input
                id="c-end"
                name="end"
                type="date"
                required
                defaultValue={defaults.end}
              />
            </div>
          </div>
          <Button type="submit" className="w-full">
            Create cycle
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
