"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  activities,
  comments,
  cycles,
  issueLabels,
  issues,
  memberships,
  notifications,
  projects,
  users,
  workspaces,
  type IssuePriority,
  type IssueStatus,
} from "@/db/schema";
import { requireUser, requireWorkspace } from "@/lib/guards";
import { docToText, extractMentionIds } from "@/lib/issue-meta";

async function assertMember(userId: string, workspaceId: string) {
  const m = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)),
  });
  if (!m) throw new Error("Not a member of this workspace");
  return m;
}

async function issueWithProject(issueId: string) {
  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    with: { project: true },
  });
  if (!issue) throw new Error("Issue not found");
  return issue;
}

function revalidateWorkspace(slug: string) {
  revalidatePath(`/${slug}`, "layout");
}

/** Docs arrive from clients as JSON strings; accept objects too (seed/server callers). */
function parseDoc(v: unknown): unknown {
  if (typeof v !== "string") return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

// ---------- workspaces / projects ----------

export async function createWorkspace(name: string) {
  const user = await requireUser();
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new Error("Invalid name");
  const [ws] = await db.insert(workspaces).values({ name, slug }).returning();
  await db.insert(memberships).values({ userId: user.id, workspaceId: ws.id, role: "admin" });
  redirect(`/${ws.slug}`);
}

export async function createProject(wsSlug: string, name: string, key: string) {
  const { workspace } = await requireWorkspace(wsSlug);
  const cleanKey = key.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  if (!name.trim() || cleanKey.length < 2) throw new Error("Name and 2+ char key required");
  await db.insert(projects).values({ workspaceId: workspace.id, name: name.trim(), key: cleanKey });
  revalidateWorkspace(wsSlug);
}

export async function createCycle(wsSlug: string, projectId: string, startsAt: string, endsAt: string, name?: string) {
  const { workspace } = await requireWorkspace(wsSlug);
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project || project.workspaceId !== workspace.id) throw new Error("Bad project");
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${cycles.number}), 0)` })
    .from(cycles)
    .where(eq(cycles.projectId, projectId));
  await db.insert(cycles).values({
    projectId,
    number: Number(max) + 1,
    name: name || `Cycle ${Number(max) + 1}`,
    startsAt,
    endsAt,
  });
  revalidateWorkspace(wsSlug);
}

// ---------- issues ----------

type IssueInput = {
  projectId: string;
  title: string;
  description?: unknown;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string | null;
  cycleId?: string | null;
  dueDate?: string | null;
  estimate?: number | null;
  labelIds?: string[];
  parentId?: string | null;
  type?: "issue" | "epic";
};

export async function createIssue(input: IssueInput) {
  const user = await requireUser();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    with: { workspace: true },
  });
  if (!project) throw new Error("Project not found");
  await assertMember(user.id, project.workspaceId);
  if (!input.title.trim()) throw new Error("Title required");
  const description = parseDoc(input.description);

  // atomic key allocation
  const [{ next }] = await db
    .update(projects)
    .set({ nextIssueNumber: sql`${projects.nextIssueNumber} + 1` })
    .where(eq(projects.id, project.id))
    .returning({ next: projects.nextIssueNumber });
  const number = next - 1;

  const [{ minSort }] = await db
    .select({ minSort: sql<number>`coalesce(min(${issues.sortOrder}), 0)` })
    .from(issues)
    .where(eq(issues.projectId, project.id));

  const [issue] = await db
    .insert(issues)
    .values({
      projectId: project.id,
      number,
      title: input.title.trim(),
      description,
      status: input.status ?? "todo",
      priority: input.priority ?? "none",
      assigneeId: input.assigneeId ?? null,
      cycleId: input.cycleId ?? null,
      dueDate: input.dueDate ?? null,
      estimate: input.estimate ?? null,
      parentId: input.parentId ?? null,
      type: input.type ?? "issue",
      creatorId: user.id,
      sortOrder: Number(minSort) - 100, // new issues on top
    })
    .returning();

  if (input.labelIds?.length) {
    await db.insert(issueLabels).values(input.labelIds.map((labelId) => ({ issueId: issue.id, labelId })));
  }
  await db.insert(activities).values({ issueId: issue.id, actorId: user.id, field: "created" });

  const key = `${project.key}-${number}`;
  await notifyAssignment(issue.assigneeId, user.id, issue.id, key);
  await notifyMentions(description, user.id, issue.id, key, null);

  revalidateWorkspace(project.workspace.slug);
  return { id: issue.id, key };
}

type IssuePatch = Partial<{
  title: string;
  description: unknown;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  cycleId: string | null;
  dueDate: string | null;
  estimate: number | null;
  sortOrder: number;
  labelIds: string[];
}>;

export async function updateIssue(issueId: string, patch: IssuePatch) {
  const user = await requireUser();
  const issue = await issueWithProject(issueId);
  await assertMember(user.id, issue.project.workspaceId);
  const key = `${issue.project.key}-${issue.number}`;

  const tracked: [keyof IssuePatch, string, string | null, string | null][] = [];
  if (patch.status && patch.status !== issue.status)
    tracked.push(["status", "status", issue.status, patch.status]);
  if (patch.priority && patch.priority !== issue.priority)
    tracked.push(["priority", "priority", issue.priority, patch.priority]);
  if ("assigneeId" in patch && patch.assigneeId !== issue.assigneeId)
    tracked.push(["assigneeId", "assignee", issue.assigneeId, patch.assigneeId ?? null]);
  if ("cycleId" in patch && patch.cycleId !== issue.cycleId)
    tracked.push(["cycleId", "cycle", issue.cycleId, patch.cycleId ?? null]);
  if ("dueDate" in patch && patch.dueDate !== issue.dueDate)
    tracked.push(["dueDate", "due_date", issue.dueDate, patch.dueDate ?? null]);

  const { labelIds, ...fields } = patch;
  if ("description" in fields) fields.description = parseDoc(fields.description);
  await db
    .update(issues)
    .set({ ...(fields as Record<string, unknown>), updatedAt: new Date() })
    .where(eq(issues.id, issueId));

  if (labelIds) {
    await db.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
    if (labelIds.length)
      await db.insert(issueLabels).values(labelIds.map((labelId) => ({ issueId, labelId })));
  }

  for (const [, field, oldValue, newValue] of tracked) {
    if (field === "assignee") {
      await db.insert(activities).values({
        issueId,
        actorId: user.id,
        field,
        oldValue: await userName(oldValue),
        newValue: await userName(newValue),
      });
    } else {
      await db.insert(activities).values({ issueId, actorId: user.id, field, oldValue, newValue });
    }
  }

  if ("assigneeId" in patch && patch.assigneeId && patch.assigneeId !== issue.assigneeId) {
    await notifyAssignment(patch.assigneeId, user.id, issueId, key);
  }
  if ("description" in patch) {
    await notifyMentions(parseDoc(patch.description), user.id, issueId, key, null, issue.description);
  }

  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, issue.project.workspaceId) });
  if (ws) revalidateWorkspace(ws.slug);
}

export async function deleteIssue(issueId: string) {
  const user = await requireUser();
  const issue = await issueWithProject(issueId);
  await assertMember(user.id, issue.project.workspaceId);
  await db.delete(issues).where(or(eq(issues.id, issueId), eq(issues.parentId, issueId)));
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, issue.project.workspaceId) });
  if (ws) revalidateWorkspace(ws.slug);
}

async function userName(id: string | null) {
  if (!id) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, id) });
  return u?.name ?? null;
}

// ---------- notifications ----------

async function notifyAssignment(assigneeId: string | null, actorId: string, issueId: string, key: string) {
  if (!assigneeId || assigneeId === actorId) return;
  await db.insert(notifications).values({
    userId: assigneeId,
    actorId,
    type: "assignment",
    issueId,
    message: `You were assigned ${key}`,
  });
}

/** Notify newly-added mentions in a Tiptap doc (deduped, never the actor). */
async function notifyMentions(
  doc: unknown,
  actorId: string,
  issueId: string,
  key: string,
  commentId: string | null,
  previousDoc?: unknown
) {
  if (!doc) return;
  const previous = new Set(previousDoc ? extractMentionIds(previousDoc) : []);
  const targets = extractMentionIds(doc).filter((id) => id !== actorId && !previous.has(id));
  if (!targets.length) return;
  const actor = await db.query.users.findFirst({ where: eq(users.id, actorId) });
  await db.insert(notifications).values(
    targets.map((userId) => ({
      userId,
      actorId,
      type: "mention" as const,
      issueId,
      commentId,
      message: `${actor?.name ?? "Someone"} mentioned you in ${commentId ? "a comment on" : ""} ${key}`.replace("  ", " "),
    }))
  );
}

export async function addComment(issueId: string, rawBody: unknown) {
  const body = parseDoc(rawBody);
  const user = await requireUser();
  const issue = await issueWithProject(issueId);
  await assertMember(user.id, issue.project.workspaceId);
  if (!docToText(body).trim() && !extractMentionIds(body).length) throw new Error("Empty comment");
  const key = `${issue.project.key}-${issue.number}`;

  const [comment] = await db
    .insert(comments)
    .values({ issueId, authorId: user.id, body })
    .returning();

  await notifyMentions(body, user.id, issueId, key, comment.id);

  // notify assignee + creator (minus actor and anyone already mentioned)
  const mentioned = new Set(extractMentionIds(body));
  const targets = [...new Set([issue.assigneeId, issue.creatorId])].filter(
    (id): id is string => !!id && id !== user.id && !mentioned.has(id)
  );
  if (targets.length) {
    await db.insert(notifications).values(
      targets.map((userId) => ({
        userId,
        actorId: user.id,
        type: "comment" as const,
        issueId,
        commentId: comment.id,
        message: `${user.name ?? "Someone"} commented on ${key}`,
      }))
    );
  }

  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, issue.project.workspaceId) });
  if (ws) revalidateWorkspace(ws.slug);
}

export async function markNotificationRead(id: string, read = true) {
  const user = await requireUser();
  await db
    .update(notifications)
    .set({ readAt: read ? new Date() : null })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), sql`${notifications.readAt} is null`));
  revalidatePath("/", "layout");
}

// ---------- lookups (used by client components) ----------

export async function getWorkspaceMembers(wsSlug: string) {
  const { workspace } = await requireWorkspace(wsSlug);
  const rows = await db.query.memberships.findMany({
    where: eq(memberships.workspaceId, workspace.id),
    with: { user: true },
  });
  return rows.map((r) => ({
    id: r.user.id,
    name: r.user.name ?? r.user.email ?? "Unknown",
    image: r.user.image,
  }));
}

export async function searchIssues(wsSlug: string, query: string) {
  const { workspace } = await requireWorkspace(wsSlug);
  const q = query.trim();
  if (!q) return [];
  const rows = await db
    .select({
      id: issues.id,
      title: issues.title,
      number: issues.number,
      status: issues.status,
      projectKey: projects.key,
    })
    .from(issues)
    .innerJoin(projects, eq(issues.projectId, projects.id))
    .where(
      and(
        eq(projects.workspaceId, workspace.id),
        or(
          ilike(issues.title, `%${q}%`),
          sql`${projects.key} || '-' || ${issues.number}::text ilike ${"%" + q + "%"}`
        )
      )
    )
    .orderBy(desc(issues.updatedAt))
    .limit(10);
  return rows.map((r) => ({ ...r, key: `${r.projectKey}-${r.number}` }));
}
