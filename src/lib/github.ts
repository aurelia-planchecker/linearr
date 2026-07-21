import { App } from "octokit";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  githubInstallations,
  githubRepos,
  issueGitLinks,
  issues,
  notifications,
  projects,
} from "@/db/schema";
import { ISSUE_KEY_REGEX, STATUS_META } from "@/lib/issue-meta";
import type { IssueStatus } from "@/db/schema";

export function githubConfigured() {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

export function getGithubApp() {
  if (!githubConfigured()) return null;
  return new App({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET ?? "unset" },
  });
}

/** Find issues in a workspace matching keys like ENG-12 found in text. */
export async function findIssuesByKeys(workspaceId: string, text: string) {
  const keys = [
    ...new Set([...text.matchAll(ISSUE_KEY_REGEX)].map((m) => `${m[1].toUpperCase()}-${m[2]}`)),
  ];
  if (!keys.length) return [];
  const wsProjects = await db.query.projects.findMany({
    where: eq(projects.workspaceId, workspaceId),
  });
  const byKey = new Map(wsProjects.map((p) => [p.key.toUpperCase(), p]));
  const found: { issue: typeof issues.$inferSelect; key: string }[] = [];
  for (const key of keys) {
    const [projKey, num] = key.split("-");
    const project = byKey.get(projKey.toUpperCase());
    if (!project) continue;
    const issue = await db.query.issues.findFirst({
      where: and(eq(issues.projectId, project.id), eq(issues.number, Number(num))),
    });
    if (issue) found.push({ issue, key });
  }
  return found;
}

/** Move an issue via automation, record activity, notify assignee+creator. */
export async function automationMove(
  issue: typeof issues.$inferSelect,
  key: string,
  to: IssueStatus,
  reason: string
) {
  if (issue.status === to || issue.status === "canceled") return;
  await db
    .update(issues)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(issues.id, issue.id));
  await db.insert(activities).values([
    { issueId: issue.id, actorId: null, field: "status", oldValue: issue.status, newValue: to },
    { issueId: issue.id, actorId: null, field: "github", newValue: reason },
  ]);
  const targets = [...new Set([issue.assigneeId, issue.creatorId])].filter(Boolean) as string[];
  if (targets.length) {
    await db.insert(notifications).values(
      targets.map((userId) => ({
        userId,
        actorId: null,
        type: "github" as const,
        issueId: issue.id,
        message: `${reason} — ${key} moved to ${STATUS_META[to].label}`,
      }))
    );
  }
}

export async function upsertGitLink(link: {
  issueId: string;
  repoId: string;
  type: "branch" | "pr" | "commit";
  ref: string;
  prNumber?: number | null;
  title?: string | null;
  url: string;
  state?: string | null;
  metadata?: unknown;
}) {
  await db
    .insert(issueGitLinks)
    .values({ ...link, lastSyncedAt: new Date() })
    .onConflictDoUpdate({
      target: [issueGitLinks.issueId, issueGitLinks.repoId, issueGitLinks.type, issueGitLinks.ref],
      set: {
        state: link.state ?? null,
        title: link.title ?? null,
        prNumber: link.prNumber ?? null,
        metadata: link.metadata ?? null,
        lastSyncedAt: new Date(),
      },
    });
}

/** Sync repo list for an installation from the GitHub API. */
export async function syncInstallationRepos(installationDbId: string) {
  const app = getGithubApp();
  if (!app) throw new Error("GitHub App not configured");
  const inst = await db.query.githubInstallations.findFirst({
    where: eq(githubInstallations.id, installationDbId),
  });
  if (!inst) throw new Error("Installation not found");
  const octokit = await app.getInstallationOctokit(inst.installationId);
  const repos = await octokit.paginate("GET /installation/repositories", { per_page: 100 });
  for (const r of repos) {
    await db
      .insert(githubRepos)
      .values({
        installationId: inst.id,
        repoId: r.id,
        fullName: r.full_name,
        private: r.private,
      })
      .onConflictDoUpdate({
        target: githubRepos.repoId,
        set: { fullName: r.full_name, private: r.private },
      });
  }
  const keep = repos.map((r) => r.id);
  if (keep.length) {
    await db
      .delete(githubRepos)
      .where(and(eq(githubRepos.installationId, inst.id), notInArray(githubRepos.repoId, keep)));
  }
  return repos.length;
}
