import { eq } from "drizzle-orm";
import { db } from "@/db";
import { issues, projects, workspaces } from "@/db/schema";
import type { IssueRowData } from "@/components/issue-row";

export async function getProjectByKey(workspaceSlug: string, key: string) {
  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });
  if (!ws) return null;
  const all = await db.query.projects.findMany({
    where: eq(projects.workspaceId, ws.id),
    with: { cycles: true },
  });
  return all.find((p) => p.key.toLowerCase() === key.toLowerCase()) ?? null;
}

export async function loadProjectIssues(
  projectId: string,
  projectKey: string
): Promise<IssueRowData[]> {
  const rows = await db.query.issues.findMany({
    where: eq(issues.projectId, projectId),
    with: {
      assignee: true,
      labels: { with: { label: true } },
      subIssues: true,
      gitLinks: true,
    },
    orderBy: issues.sortOrder,
  });
  return rows.map((r) => {
    const prs = r.gitLinks
      .filter((l) => l.type === "pr")
      .sort((a, b) => b.lastSyncedAt.getTime() - a.lastSyncedAt.getTime());
    return {
      id: r.id,
      key: `${projectKey}-${r.number}`,
      title: r.title,
      type: r.type,
      status: r.status,
      priority: r.priority,
      assignee: r.assignee
        ? { id: r.assignee.id, name: r.assignee.name ?? "?", image: r.assignee.image }
        : null,
      labels: r.labels.map((il) => ({
        id: il.label.id,
        name: il.label.name,
        color: il.label.color,
      })),
      dueDate: r.dueDate,
      estimate: r.estimate,
      subCount: r.subIssues.length,
      subDone: r.subIssues.filter((s) => s.status === "done").length,
      prState: prs[0]?.state ?? null,
      sortOrder: r.sortOrder,
    };
  });
}
