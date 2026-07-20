"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AssigneeMenu,
  MemberAvatar,
  PriorityIcon,
  PriorityMenu,
  StatusIcon,
  StatusMenu,
  type Member,
} from "@/components/issue-bits";
import { Editor } from "@/components/editor";
import { createIssue } from "@/lib/actions";
import { PRIORITY_META, STATUS_META } from "@/lib/issue-meta";
import type { IssuePriority, IssueStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string; key: string };
type LabelT = { id: string; name: string; color: string };

export function NewIssueDialog({
  workspaceSlug,
  projects,
  labels,
  members,
}: {
  workspaceSlug: string;
  projects: Project[];
  labels: LabelT[];
  members: Member[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<unknown>(null);
  const [status, setStatus] = useState<IssueStatus>("todo");
  const [priority, setPriority] = useState<IssuePriority>("none");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { projectId?: string; status?: IssueStatus }
        | undefined;
      if (detail?.projectId) setProjectId(detail.projectId);
      if (detail?.status) setStatus(detail.status);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (e.key === "c" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("new-issue", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("new-issue", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  async function submit(openAfter: boolean) {
    if (!title.trim() || !projectId || saving) return;
    setSaving(true);
    try {
      const { key } = await createIssue({
        projectId,
        title,
        description,
        status,
        priority,
        assigneeId,
        labelIds,
      });
      toast.success(`Created ${key}`);
      setTitle("");
      setDescription(null);
      setLabelIds([]);
      if (openAfter) {
        setOpen(false);
        router.push(`/${workspaceSlug}/issue/${key}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create issue");
    } finally {
      setSaving(false);
    }
  }

  const assignee = members.find((m) => m.id === assigneeId) ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] translate-y-0 sm:max-w-2xl" showCloseButton={false}>
        <DialogTitle className="sr-only">New issue</DialogTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger size="sm" className="h-6 w-auto gap-1 border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.key} · {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>› New issue</span>
        </div>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(true);
            else if (e.key === "Enter") submit(false);
          }}
          placeholder="Issue title"
          className="border-none px-0 text-base font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
          autoFocus
        />

        <Editor
          content={description}
          onChange={setDescription}
          members={members}
          placeholder="Add description… (type @ to mention)"
        />

        <div className="flex flex-wrap items-center gap-2">
          <StatusMenu value={status} onChange={setStatus}>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <StatusIcon status={status} />
              {STATUS_META[status].label}
            </Button>
          </StatusMenu>
          <PriorityMenu value={priority} onChange={setPriority}>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <PriorityIcon priority={priority} />
              {PRIORITY_META[priority].label}
            </Button>
          </PriorityMenu>
          <AssigneeMenu members={members} value={assigneeId} onChange={setAssigneeId}>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <MemberAvatar member={assignee} size={16} />
              {assignee?.name ?? "Assignee"}
            </Button>
          </AssigneeMenu>
          {labels.map((l) => (
            <Badge
              key={l.id}
              variant="outline"
              className={cn(
                "cursor-pointer select-none",
                labelIds.includes(l.id) && "border-transparent"
              )}
              style={
                labelIds.includes(l.id)
                  ? { backgroundColor: l.color + "33", color: l.color }
                  : undefined
              }
              onClick={() =>
                setLabelIds((ids) =>
                  ids.includes(l.id) ? ids.filter((x) => x !== l.id) : [...ids, l.id]
                )
              }
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <span className="mr-auto text-xs text-muted-foreground">
            Enter to create · ⌘Enter to create & open
          </span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => submit(false)} disabled={!title.trim() || saving}>
            {saving ? "Creating…" : "Create issue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
