"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, GitPullRequest, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AssigneeMenu,
  MemberAvatar,
  PriorityIcon,
  PriorityMenu,
  StatusIcon,
  StatusMenu,
  type Member,
} from "@/components/issue-bits";
import { updateIssue } from "@/lib/actions";
import type { IssuePriority, IssueStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

export type IssueRowData = {
  id: string;
  key: string;
  title: string;
  type: "issue" | "epic";
  status: IssueStatus;
  priority: IssuePriority;
  assignee: Member | null;
  labels: { id: string; name: string; color: string }[];
  dueDate: string | null;
  estimate: number | null;
  subCount: number;
  subDone: number;
  prState: string | null;
  sortOrder: number;
};

const PR_COLORS: Record<string, string> = {
  open: "#61a8ff",
  draft: "#a6adba",
  merged: "#45c28a",
  closed: "#747c8c",
};

export function IssueRow({
  issue,
  members,
  workspaceSlug,
}: {
  issue: IssueRowData;
  members: Member[];
  workspaceSlug: string;
}) {
  const router = useRouter();
  const href = `/${workspaceSlug}/issue/${issue.key}`;
  const overdue =
    issue.dueDate &&
    new Date(issue.dueDate) < new Date() &&
    issue.status !== "done" &&
    issue.status !== "canceled";

  return (
    <div
      className="group flex h-9 cursor-pointer items-center gap-2 border-b border-border/50 px-4 text-sm hover:bg-accent/40"
      onClick={() => router.push(href)}
    >
      <span onClick={(e) => e.stopPropagation()}>
        <PriorityMenu
          value={issue.priority}
          onChange={(p) => updateIssue(issue.id, { priority: p })}
        >
          <button className="flex size-6 items-center justify-center rounded hover:bg-accent" aria-label="Priority">
            <PriorityIcon priority={issue.priority} />
          </button>
        </PriorityMenu>
      </span>

      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{issue.key}</span>

      <span onClick={(e) => e.stopPropagation()}>
        <StatusMenu
          value={issue.status}
          onChange={(s) => updateIssue(issue.id, { status: s })}
        >
          <button className="flex size-6 items-center justify-center rounded hover:bg-accent" aria-label="Status">
            <StatusIcon status={issue.status} />
          </button>
        </StatusMenu>
      </span>

      <Link
        href={href}
        className={cn("min-w-0 flex-1 truncate font-medium", issue.type === "epic" && "text-primary")}
        onClick={(e) => e.stopPropagation()}
      >
        {issue.type === "epic" && <Layers className="mr-1 inline size-3.5" />}
        {issue.title}
      </Link>

      <span className="hidden items-center gap-1 md:flex">
        {issue.labels.slice(0, 2).map((l) => (
          <Badge
            key={l.id}
            variant="outline"
            className="h-5 gap-1 px-1.5 text-[11px] text-muted-foreground"
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
            {l.name}
          </Badge>
        ))}
        {issue.labels.length > 2 && (
          <span className="text-[11px] text-muted-foreground">+{issue.labels.length - 2}</span>
        )}
      </span>

      {issue.subCount > 0 && (
        <span className="hidden font-mono text-[11px] text-muted-foreground lg:inline">
          {issue.subDone}/{issue.subCount}
        </span>
      )}

      {issue.prState && (
        <GitPullRequest
          className="size-3.5 shrink-0"
          style={{ color: PR_COLORS[issue.prState] ?? "#747c8c" }}
        />
      )}

      {issue.dueDate && (
        <span
          className={cn(
            "hidden items-center gap-1 text-[11px] text-muted-foreground lg:flex",
            overdue && "text-[#f16b6b]"
          )}
        >
          <CalendarDays className="size-3" />
          {new Date(issue.dueDate + "T00:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      )}

      {issue.estimate != null && (
        <span className="hidden w-5 text-right font-mono text-[11px] text-muted-foreground xl:inline">
          {issue.estimate}
        </span>
      )}

      <span onClick={(e) => e.stopPropagation()}>
        <AssigneeMenu
          members={members}
          value={issue.assignee?.id ?? null}
          onChange={(id) => updateIssue(issue.id, { assigneeId: id })}
        >
          <button className="flex size-6 items-center justify-center rounded hover:bg-accent" aria-label="Assignee">
            <MemberAvatar member={issue.assignee} size={18} />
          </button>
        </AssigneeMenu>
      </span>
    </div>
  );
}
