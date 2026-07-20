"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GitPullRequest } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar, PriorityIcon, StatusIcon, type Member } from "@/components/issue-bits";
import { NewIssueTrigger } from "@/components/view-header";
import type { IssueRowData } from "@/components/issue-row";
import { updateIssue } from "@/lib/actions";
import { STATUSES, STATUS_META } from "@/lib/issue-meta";
import type { IssueStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

type Columns = Record<IssueStatus, IssueRowData[]>;

const PR_COLORS: Record<string, string> = {
  open: "#61a8ff",
  draft: "#a6adba",
  merged: "#45c28a",
  closed: "#747c8c",
};

function toColumns(issues: IssueRowData[]): Columns {
  const cols = Object.fromEntries(STATUSES.map((s) => [s, []])) as unknown as Columns;
  for (const i of issues) cols[i.status].push(i);
  return cols;
}

export function Board({
  issues,
  projectId,
  workspaceSlug,
}: {
  issues: IssueRowData[];
  members: Member[];
  projectId: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState<Columns>(() => toColumns(issues));
  const [activeId, setActiveId] = useState<string | null>(null);

  // re-sync from server data when not mid-drag (render-time reconcile)
  const [prevIssues, setPrevIssues] = useState(issues);
  if (prevIssues !== issues && !activeId) {
    setPrevIssues(issues);
    setColumns(toColumns(issues));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const visibleStatuses = useMemo(
    () => STATUSES.filter((s) => s !== "canceled" || columns[s].length > 0),
    [columns]
  );

  const findColumn = (id: string): IssueStatus | null => {
    if (id.startsWith("col-")) return id.slice(4) as IssueStatus;
    for (const s of STATUSES) if (columns[s].some((i) => i.id === id)) return s;
    return null;
  };

  const activeCard = activeId
    ? Object.values(columns).flat().find((i) => i.id === activeId) ?? null
    : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = findColumn(String(active.id));
    const to = findColumn(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const card = cols[from].find((i) => i.id === active.id);
      if (!card) return cols;
      const overIndex = cols[to].findIndex((i) => i.id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : cols[to].length;
      return {
        ...cols,
        [from]: cols[from].filter((i) => i.id !== active.id),
        [to]: [
          ...cols[to].slice(0, insertAt),
          { ...card, status: to },
          ...cols[to].slice(insertAt),
        ],
      };
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const to = findColumn(String(over.id));
    if (!to) return;

    let next = columns;
    const col = columns[to];
    const fromIndex = col.findIndex((i) => i.id === active.id);
    const overIndex = col.findIndex((i) => i.id === over.id);
    if (fromIndex >= 0 && overIndex >= 0 && fromIndex !== overIndex) {
      next = { ...columns, [to]: arrayMove(col, fromIndex, overIndex) };
      setColumns(next);
    }

    const target = next[to];
    const idx = target.findIndex((i) => i.id === active.id);
    if (idx < 0) return;
    const card = target[idx];
    const prev = target[idx - 1]?.sortOrder;
    const after = target[idx + 1]?.sortOrder;
    const sortOrder =
      prev == null && after == null
        ? 0
        : prev == null
          ? (after as number) - 100
          : after == null
            ? prev + 100
            : (prev + after) / 2;

    const statusChanged = issues.find((i) => i.id === card.id)?.status !== to;
    try {
      await updateIssue(card.id, { status: to, sortOrder });
      if (statusChanged) toast.success(`${card.key} moved to ${STATUS_META[to].label}`);
      router.refresh();
    } catch {
      setColumns(toColumns(issues)); // roll back
      toast.error(`Couldn’t move ${card.key} — restored`, {
        action: { label: "Retry", onClick: () => updateIssue(card.id, { status: to, sortOrder }) },
      });
    }
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setColumns(toColumns(issues));
        }}
      >
        <div className="flex h-full gap-3 p-4">
          {visibleStatuses.map((status) => (
            <Column
              key={status}
              status={status}
              cards={columns[status]}
              projectId={projectId}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCard && <CardView card={activeCard} dragging />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  status,
  cards,
  projectId,
  workspaceSlug,
}: {
  status: IssueStatus;
  cards: IssueRowData[];
  projectId: string;
  workspaceSlug: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-lg bg-card">
      <div className="flex h-10 shrink-0 items-center gap-2 px-3">
        <StatusIcon status={status} />
        <span className="text-xs font-semibold">{STATUS_META[status].label}</span>
        <span className="text-xs text-muted-foreground">{cards.length}</span>
        <NewIssueTrigger projectId={projectId} status={status} className="ml-auto" />
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto rounded-b-lg px-2 pb-2",
          isOver && "outline-2 outline-primary/60 -outline-offset-2 rounded-lg"
        )}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} workspaceSlug={workspaceSlug} />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
            {isOver ? "Drop issue here" : "No issues"}
          </div>
        )}
      </div>
    </div>
  );
}

function SortableCard({ card, workspaceSlug }: { card: IssueRowData; workspaceSlug: string }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onClick={() => router.push(`/${workspaceSlug}/issue/${card.key}`)}
    >
      <CardView card={card} />
    </div>
  );
}

function CardView({ card, dragging }: { card: IssueRowData; dragging?: boolean }) {
  const overdue =
    card.dueDate &&
    new Date(card.dueDate) < new Date() &&
    card.status !== "done" &&
    card.status !== "canceled";
  return (
    <div
      className={cn(
        "cursor-pointer space-y-2 rounded-md border border-border bg-secondary p-2.5 text-sm hover:border-ring/40",
        dragging && "rotate-0 shadow-lg ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{card.key}</span>
        <span className="ml-auto">
          <PriorityIcon priority={card.priority} />
        </span>
      </div>
      <p className="line-clamp-2 font-medium leading-snug">{card.title}</p>
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.labels.slice(0, 2).map((l) => (
            <Badge key={l.id} variant="outline" className="h-4.5 gap-1 px-1.5 text-[10px] text-muted-foreground">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
            </Badge>
          ))}
          {card.labels.length > 2 && (
            <span className="text-[10px] text-muted-foreground">+{card.labels.length - 2}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <MemberAvatar member={card.assignee} size={16} />
        {card.subCount > 0 && (
          <span className="font-mono">
            {card.subDone}/{card.subCount}
          </span>
        )}
        {card.estimate != null && <span className="font-mono">{card.estimate}pt</span>}
        {card.dueDate && (
          <span className={cn("flex items-center gap-0.5", overdue && "text-[#f16b6b]")}>
            <CalendarDays className="size-3" />
            {new Date(card.dueDate + "T00:00:00").toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        {card.prState && (
          <GitPullRequest
            className="ml-auto size-3.5"
            style={{ color: PR_COLORS[card.prState] ?? "#747c8c" }}
          />
        )}
      </div>
    </div>
  );
}
