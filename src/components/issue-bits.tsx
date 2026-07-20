"use client";

import { AlertTriangle, Check, Minus, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  PRIORITIES,
  PRIORITY_META,
  STATUSES,
  STATUS_META,
} from "@/lib/issue-meta";
import type { IssuePriority, IssueStatus } from "@/db/schema";

export function StatusIcon({ status, className }: { status: IssueStatus; className?: string }) {
  const color = STATUS_META[status].color;
  if (status === "done")
    return (
      <span
        className={cn("flex size-3.5 items-center justify-center rounded-full", className)}
        style={{ backgroundColor: color }}
      >
        <Check className="size-2.5 text-black" strokeWidth={3} />
      </span>
    );
  if (status === "canceled")
    return (
      <span
        className={cn("flex size-3.5 items-center justify-center rounded-full", className)}
        style={{ backgroundColor: color }}
      >
        <Minus className="size-2.5 text-black" strokeWidth={3} />
      </span>
    );
  const fill =
    status === "in_progress" ? 50 : status === "in_review" ? 75 : status === "todo" ? 0 : 0;
  return (
    <span
      className={cn("relative inline-block size-3.5 rounded-full border-2", className)}
      style={{ borderColor: color, borderStyle: status === "backlog" ? "dashed" : "solid" }}
    >
      {fill > 0 && (
        <span
          className="absolute inset-[1px] rounded-full"
          style={{
            background: `conic-gradient(${color} ${fill}%, transparent ${fill}%)`,
          }}
        />
      )}
    </span>
  );
}

export function PriorityIcon({ priority, className }: { priority: IssuePriority; className?: string }) {
  const color = PRIORITY_META[priority].color;
  if (priority === "urgent")
    return <AlertTriangle className={cn("size-3.5", className)} style={{ color }} />;
  if (priority === "none")
    return <Minus className={cn("size-3.5 text-muted-foreground/50", className)} />;
  const bars = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  return (
    <span className={cn("flex items-end gap-[2px]", className)} aria-label={priority}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm"
          style={{
            height: `${4 + i * 3}px`,
            backgroundColor: i <= bars ? color : "var(--border)",
          }}
        />
      ))}
    </span>
  );
}

export function StatusMenu({
  value,
  onChange,
  children,
}: {
  value: IssueStatus;
  onChange: (s: IssueStatus) => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {STATUSES.map((s) => (
          <DropdownMenuItem key={s} onClick={() => onChange(s)}>
            <StatusIcon status={s} />
            {STATUS_META[s].label}
            {s === value && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriorityMenu({
  value,
  onChange,
  children,
}: {
  value: IssuePriority;
  onChange: (p: IssuePriority) => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {PRIORITIES.map((p) => (
          <DropdownMenuItem key={p} onClick={() => onChange(p)}>
            <PriorityIcon priority={p} />
            {PRIORITY_META[p].label}
            {p === value && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type Member = { id: string; name: string; image: string | null };

export function AssigneeMenu({
  members,
  value,
  onChange,
  children,
}: {
  members: Member[];
  value: string | null;
  onChange: (id: string | null) => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={() => onChange(null)}>
          <User className="size-3.5 text-muted-foreground" />
          Unassigned
          {value === null && <Check className="ml-auto size-3.5" />}
        </DropdownMenuItem>
        {members.map((m) => (
          <DropdownMenuItem key={m.id} onClick={() => onChange(m.id)}>
            <MemberAvatar member={m} size={18} />
            {m.name}
            {m.id === value && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MemberAvatar({ member, size = 20 }: { member: Member | null; size?: number }) {
  if (!member)
    return (
      <span
        className="flex items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"
        style={{ width: size, height: size }}
      >
        <User style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
    );
  return member.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={member.image}
      alt={member.name}
      className="rounded-full"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex items-center justify-center rounded-full bg-primary/20 font-medium text-primary"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {member.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
