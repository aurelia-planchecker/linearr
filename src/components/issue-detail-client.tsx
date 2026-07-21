"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CalendarDays, Check, Copy, GitBranch, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { addComment, createIssue, deleteIssue, updateIssue } from "@/lib/actions";
import { PRIORITY_META, STATUS_META } from "@/lib/issue-meta";
import type { IssuePriority, IssueStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

export function CopyLinkButton({ text }: { text: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success("Link copied");
      }}
      aria-label="Copy link"
    >
      <Copy className="size-3.5" />
    </Button>
  );
}

export function CopyBranchButton({
  issueId,
  issueKey,
  title,
  status,
}: {
  issueId: string;
  issueKey: string;
  title: string;
  status: IssueStatus;
}) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/, "");
  const branch = `${issueKey.toLowerCase()}${slug ? `-${slug}` : ""}`;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6"
      onClick={async () => {
        navigator.clipboard.writeText(branch);
        // Linear behavior: copying the branch name marks the issue as started
        if (status === "backlog" || status === "todo") {
          await updateIssue(issueId, { status: "in_progress" });
          toast.success(`Branch name copied: ${branch} — moved to In Progress`);
        } else {
          toast.success(`Branch name copied: ${branch}`);
        }
      }}
      aria-label="Copy branch name"
    >
      <GitBranch className="size-3.5" />
    </Button>
  );
}

export function DeleteIssueButton({ issueId, issueKey }: { issueId: string; issueKey: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6 text-muted-foreground hover:text-red-400"
      onClick={async () => {
        if (!window.confirm(`Delete ${issueKey}? This also removes its comments and links.`))
          return;
        await deleteIssue(issueId);
      }}
      aria-label="Delete issue"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

export function TitleEditor({ issueId, title }: { issueId: string; title: string }) {
  const [value, setValue] = useState(title);
  const save = async () => {
    const t = value.trim();
    if (!t || t === title) return setValue(title);
    await updateIssue(issueId, { title: t });
  };
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="w-full bg-transparent text-xl font-semibold outline-none placeholder:text-muted-foreground"
      placeholder="Issue title"
    />
  );
}

export function DescriptionEditor({
  issueId,
  description,
  members,
}: {
  issueId: string;
  description: unknown;
  members: Member[];
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState(true);
  return (
    <div>
      <Editor
        content={description}
        members={members}
        placeholder="Add a description… (type @ to mention)"
        onChange={(json) => {
          setSaved(false);
          if (timer.current) clearTimeout(timer.current);
          // autosave 1.5s after typing stops
          timer.current = setTimeout(async () => {
            await updateIssue(issueId, { description: json });
            setSaved(true);
          }, 1500);
        }}
      />
      {!saved && <p className="mt-1 text-[11px] text-muted-foreground">Saving…</p>}
    </div>
  );
}

type LabelT = { id: string; name: string; color: string };
type CycleT = { id: string; name: string };

export function PropertySidebar({
  issueId,
  status,
  priority,
  assignee,
  members,
  labels,
  activeLabelIds,
  cycles,
  cycleId,
  dueDate,
  estimate,
}: {
  issueId: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee: Member | null;
  members: Member[];
  labels: LabelT[];
  activeLabelIds: string[];
  cycles: CycleT[];
  cycleId: string | null;
  dueDate: string | null;
  estimate: number | null;
}) {
  const router = useRouter();
  const patch = async (p: Parameters<typeof updateIssue>[1]) => {
    await updateIssue(issueId, p);
    router.refresh();
  };

  return (
    <div className="space-y-4 text-sm">
      <Row label="Status">
        <StatusMenu value={status} onChange={(s) => patch({ status: s })}>
          <button className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent">
            <StatusIcon status={status} />
            {STATUS_META[status].label}
          </button>
        </StatusMenu>
      </Row>
      <Row label="Priority">
        <PriorityMenu value={priority} onChange={(p) => patch({ priority: p })}>
          <button className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent">
            <PriorityIcon priority={priority} />
            {PRIORITY_META[priority].label}
          </button>
        </PriorityMenu>
      </Row>
      <Row label="Assignee">
        <AssigneeMenu members={members} value={assignee?.id ?? null} onChange={(id) => patch({ assigneeId: id })}>
          <button className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent">
            <MemberAvatar member={assignee} size={18} />
            {assignee?.name ?? "Unassigned"}
          </button>
        </AssigneeMenu>
      </Row>
      <Row label="Labels">
        <div className="flex flex-wrap gap-1">
          {labels.map((l) => {
            const active = activeLabelIds.includes(l.id);
            return (
              <Badge
                key={l.id}
                variant="outline"
                className={cn("cursor-pointer select-none", active && "border-transparent")}
                style={active ? { backgroundColor: l.color + "33", color: l.color } : undefined}
                onClick={() =>
                  patch({
                    labelIds: active
                      ? activeLabelIds.filter((x) => x !== l.id)
                      : [...activeLabelIds, l.id],
                  })
                }
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name}
                {active && <Check className="size-3" />}
              </Badge>
            );
          })}
        </div>
      </Row>
      <Row label="Cycle">
        <Select
          value={cycleId ?? "none"}
          onValueChange={(v) => patch({ cycleId: v === "none" ? null : v })}
        >
          <SelectTrigger size="sm" className="h-7 w-full border-none text-sm shadow-none hover:bg-accent dark:bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No cycle</SelectItem>
            {cycles.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label="Due date">
        <div className="flex items-center gap-1">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          <input
            type="date"
            defaultValue={dueDate ?? ""}
            onChange={(e) => patch({ dueDate: e.target.value || null })}
            className="rounded bg-transparent px-1 py-0.5 text-sm outline-none hover:bg-accent [color-scheme:dark]"
          />
        </div>
      </Row>
      <Row label="Estimate">
        <Input
          type="number"
          min={0}
          defaultValue={estimate ?? ""}
          onBlur={(e) =>
            patch({ estimate: e.target.value === "" ? null : Number(e.target.value) })
          }
          placeholder="—"
          className="h-7 w-16 border-none px-1.5 shadow-none dark:bg-transparent"
        />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export function AddSubIssue({
  parentId,
  projectId,
}: {
  parentId: string;
  projectId: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  if (!adding)
    return (
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setAdding(true)}
      >
        <Plus className="size-3.5" /> Add sub-issue
      </button>
    );
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await createIssue({ projectId, title, parentId });
        setTitle("");
        setAdding(false);
        router.refresh();
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
        placeholder="Sub-issue title"
        className="h-7 text-sm"
      />
      <Button type="submit" size="sm" className="h-7 text-xs">
        Add
      </Button>
    </form>
  );
}

export function CommentComposer({
  issueId,
  members,
}: {
  issueId: string;
  members: Member[];
}) {
  const router = useRouter();
  const [body, setBody] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  const submit = async () => {
    if (!body) return;
    try {
      await addComment(issueId, body);
      setBody(null);
      setNonce((n) => n + 1); // remount editor to clear
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to comment");
    }
  };
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <Editor
        key={nonce}
        content={null}
        onChange={setBody}
        members={members}
        placeholder="Leave a comment… (type @ to mention)"
        onSubmit={submit}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" className="h-7 text-xs" onClick={submit} disabled={!body}>
          Comment ⌘↵
        </Button>
      </div>
    </div>
  );
}
