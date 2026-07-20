import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as s from "./schema";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema: s });

// Tiptap JSON helpers
const text = (t: string) => ({ type: "text", text: t });
const mention = (id: string, label: string) => ({
  type: "mention",
  attrs: { id, label },
});
const p = (...content: object[]) => ({ type: "paragraph", content });
const doc = (...content: object[]) => ({ type: "doc", content });

async function main() {
  // wipe (idempotent reseed)
  await db.execute(sql`
    truncate users, accounts, sessions, workspaces, memberships, projects, cycles,
      labels, issues, issue_labels, comments, activities, notifications,
      github_installations, github_repos, issue_git_links cascade
  `);

  const [alex, maria, dev, sam] = await db
    .insert(s.users)
    .values([
      { name: "Alex Gilboa", email: "alex@demo.local", githubUsername: "alexg", image: null },
      { name: "Maria Chen", email: "maria@demo.local", githubUsername: "mariachen", image: null },
      { name: "Dev Patel", email: "dev@demo.local", githubUsername: "devpatel", image: null },
      { name: "Sam Rivera", email: "sam@demo.local", githubUsername: "samr", image: null },
    ])
    .returning();

  const [ws] = await db
    .insert(s.workspaces)
    .values({ name: "Acme", slug: "acme" })
    .returning();

  await db.insert(s.memberships).values([
    { userId: alex.id, workspaceId: ws.id, role: "admin" },
    { userId: maria.id, workspaceId: ws.id, role: "member" },
    { userId: dev.id, workspaceId: ws.id, role: "member" },
    { userId: sam.id, workspaceId: ws.id, role: "member" },
  ]);

  const [eng, web] = await db
    .insert(s.projects)
    .values([
      { workspaceId: ws.id, name: "Platform", key: "ENG", description: "Core platform and API work" },
      { workspaceId: ws.id, name: "Website", key: "WEB", description: "Marketing site and docs" },
    ])
    .returning();

  const labelRows = await db
    .insert(s.labels)
    .values([
      { workspaceId: ws.id, name: "bug", color: "#f16b6b" },
      { workspaceId: ws.id, name: "feature", color: "#8b7cf6" },
      { workspaceId: ws.id, name: "design", color: "#61a8ff" },
      { workspaceId: ws.id, name: "infra", color: "#f2b84b" },
      { workspaceId: ws.id, name: "docs", color: "#a6adba" },
    ])
    .returning();
  const label = Object.fromEntries(labelRows.map((l) => [l.name, l]));

  const [, cycle2] = await db
    .insert(s.cycles)
    .values([
      { projectId: eng.id, number: 1, name: "Cycle 1", startsAt: "2026-06-29", endsAt: "2026-07-12" },
      { projectId: eng.id, number: 2, name: "Cycle 2", startsAt: "2026-07-13", endsAt: "2026-07-26" },
      { projectId: eng.id, number: 3, name: "Cycle 3", startsAt: "2026-07-27", endsAt: "2026-08-09" },
    ])
    .returning();

  type Seed = {
    project: typeof eng;
    title: string;
    status: s.IssueStatus;
    priority?: s.IssuePriority;
    assignee?: string;
    labels?: string[];
    due?: string;
    estimate?: number;
    cycle?: boolean;
    type?: "issue" | "epic";
    parentKey?: number; // index into created list
    desc?: string;
  };

  const seeds: Seed[] = [
    // ENG — epic + children
    { project: eng, title: "Auth overhaul", status: "in_progress", priority: "high", assignee: alex.id, type: "epic", labels: ["feature"], desc: "Replace legacy session auth with OAuth + short-lived tokens across all clients." },
    { project: eng, title: "Fix token refresh race condition", status: "in_progress", priority: "urgent", assignee: maria.id, labels: ["bug"], cycle: true, estimate: 3, due: "2026-07-24", parentKey: 0, desc: "Two tabs refreshing at once invalidates both sessions. Needs a mutex on the refresh path." },
    { project: eng, title: "Add OAuth login with GitHub", status: "in_review", priority: "high", assignee: dev.id, labels: ["feature"], cycle: true, estimate: 5, parentKey: 0 },
    { project: eng, title: "Migrate session storage to Redis", status: "todo", priority: "medium", assignee: sam.id, labels: ["infra"], cycle: true, estimate: 8, parentKey: 0 },
    { project: eng, title: "Audit log for auth events", status: "backlog", priority: "low", labels: ["feature"], parentKey: 0 },
    // ENG — standalone
    { project: eng, title: "API rate limiting returns wrong Retry-After", status: "todo", priority: "high", assignee: maria.id, labels: ["bug"], cycle: true, estimate: 2, due: "2026-07-22" },
    { project: eng, title: "Upgrade Postgres to 16", status: "done", priority: "medium", assignee: sam.id, labels: ["infra"], estimate: 5 },
    { project: eng, title: "Webhook retries with exponential backoff", status: "in_progress", priority: "medium", assignee: dev.id, labels: ["feature"], cycle: true, estimate: 3 },
    { project: eng, title: "Flaky integration test: billing_test.ts", status: "todo", priority: "low", labels: ["bug"], cycle: true },
    { project: eng, title: "N+1 queries on issue list endpoint", status: "in_review", priority: "high", assignee: alex.id, labels: ["bug"], cycle: true, estimate: 2 },
    { project: eng, title: "Background job dashboard", status: "backlog", priority: "none", labels: ["feature"] },
    { project: eng, title: "Rotate signing keys quarterly", status: "backlog", priority: "low", labels: ["infra"] },
    { project: eng, title: "Deprecate v1 REST endpoints", status: "canceled", priority: "medium", labels: ["infra"] },
    { project: eng, title: "Search indexing lag alerts", status: "done", priority: "medium", assignee: maria.id, labels: ["infra"], estimate: 3 },
    // WEB
    { project: web, title: "Pricing page redesign", status: "in_progress", priority: "high", assignee: sam.id, labels: ["design"], due: "2026-07-30", desc: "New three-tier layout with usage calculator." },
    { project: web, title: "Blog images missing alt text", status: "todo", priority: "medium", assignee: maria.id, labels: ["bug", "docs"] },
    { project: web, title: "Dark mode flash on first paint", status: "in_review", priority: "high", assignee: dev.id, labels: ["bug"] },
    { project: web, title: "Docs search returns stale results", status: "todo", priority: "urgent", assignee: alex.id, labels: ["bug"] },
    { project: web, title: "Customer logos carousel", status: "backlog", priority: "low", labels: ["design"] },
    { project: web, title: "Migrate docs to MDX", status: "done", priority: "medium", assignee: dev.id, labels: ["docs"] },
    { project: web, title: "Add sitemap.xml generation", status: "done", priority: "low", assignee: sam.id, labels: ["infra"] },
  ];

  const created: (typeof s.issues.$inferSelect)[] = [];
  const counters: Record<string, number> = {};
  for (const [i, seed] of seeds.entries()) {
    counters[seed.project.id] = (counters[seed.project.id] ?? 0) + 1;
    const [row] = await db
      .insert(s.issues)
      .values({
        projectId: seed.project.id,
        number: counters[seed.project.id],
        type: seed.type ?? "issue",
        parentId: seed.parentKey != null ? created[seed.parentKey].id : null,
        title: seed.title,
        description: seed.desc ? doc(p(text(seed.desc))) : null,
        status: seed.status,
        priority: seed.priority ?? "none",
        assigneeId: seed.assignee ?? null,
        creatorId: alex.id,
        cycleId: seed.cycle ? cycle2.id : null,
        dueDate: seed.due ?? null,
        estimate: seed.estimate ?? null,
        sortOrder: i * 100,
        createdAt: new Date(Date.now() - (seeds.length - i) * 36e5 * 7),
      })
      .returning();
    created.push(row);
    if (seed.labels?.length) {
      await db.insert(s.issueLabels).values(
        seed.labels.map((n) => ({ issueId: row.id, labelId: label[n].id }))
      );
    }
    await db.insert(s.activities).values({
      issueId: row.id,
      actorId: alex.id,
      field: "created",
      createdAt: row.createdAt,
    });
  }
  for (const p of [eng, web]) {
    await db
      .update(s.projects)
      .set({ nextIssueNumber: (counters[p.id] ?? 0) + 1 })
      .where(sql`${s.projects.id} = ${p.id}`);
  }

  const tokenRace = created[1]; // ENG-2
  const oauth = created[2]; // ENG-3
  const pricing = created[14]; // WEB-1

  // comments (one with a mention of Alex)
  const [c1] = await db
    .insert(s.comments)
    .values([
      {
        issueId: tokenRace.id,
        authorId: maria.id,
        body: doc(
          p(
            text("Reproduced with two tabs. "),
            mention(alex.id, "Alex Gilboa"),
            text(" I think the refresh needs a per-session lock — thoughts?")
          )
        ),
        createdAt: new Date(Date.now() - 3 * 36e5),
      },
      {
        issueId: tokenRace.id,
        authorId: alex.id,
        body: doc(p(text("Agreed. A Redis SETNX lock keyed on session id should do it."))),
        createdAt: new Date(Date.now() - 2 * 36e5),
      },
      {
        issueId: pricing.id,
        authorId: sam.id,
        body: doc(p(text("First draft in Figma, link in project resources."))),
        createdAt: new Date(Date.now() - 24 * 36e5),
      },
    ])
    .returning();

  // status-change activity examples
  await db.insert(s.activities).values([
    { issueId: tokenRace.id, actorId: maria.id, field: "status", oldValue: "todo", newValue: "in_progress", createdAt: new Date(Date.now() - 5 * 36e5) },
    { issueId: oauth.id, actorId: dev.id, field: "status", oldValue: "in_progress", newValue: "in_review", createdAt: new Date(Date.now() - 8 * 36e5) },
  ]);

  // github: installation, repos, links
  const [inst] = await db
    .insert(s.githubInstallations)
    .values({
      workspaceId: ws.id,
      installationId: 12345678,
      accountLogin: "acme-dev",
      accountType: "Organization",
    })
    .returning();
  const [feRepo, apiRepo] = await db
    .insert(s.githubRepos)
    .values([
      { installationId: inst.id, repoId: 900001, fullName: "acme-dev/frontend", private: true },
      { installationId: inst.id, repoId: 900002, fullName: "acme-dev/api", private: true },
    ])
    .returning();

  await db.insert(s.issueGitLinks).values([
    {
      issueId: tokenRace.id,
      repoId: apiRepo.id,
      type: "branch",
      ref: "maria/eng-2-token-refresh-lock",
      url: "https://github.com/acme-dev/api/tree/maria/eng-2-token-refresh-lock",
    },
    {
      issueId: tokenRace.id,
      repoId: apiRepo.id,
      type: "pr",
      ref: "maria/eng-2-token-refresh-lock",
      prNumber: 418,
      title: "ENG-2 Add per-session refresh lock",
      url: "https://github.com/acme-dev/api/pull/418",
      state: "open",
      metadata: { checks: "5/5 passing", reviewStatus: "review_requested" },
    },
    {
      issueId: oauth.id,
      repoId: apiRepo.id,
      type: "pr",
      ref: "dev/eng-3-github-oauth",
      prNumber: 402,
      title: "ENG-3 GitHub OAuth provider",
      url: "https://github.com/acme-dev/api/pull/402",
      state: "merged",
      metadata: { checks: "8/8 passing" },
    },
    {
      issueId: pricing.id,
      repoId: feRepo.id,
      type: "branch",
      ref: "sam/web-1-pricing-redesign",
      url: "https://github.com/acme-dev/frontend/tree/sam/web-1-pricing-redesign",
    },
  ]);

  // notifications for Alex (mention, assignment, github)
  await db.insert(s.notifications).values([
    {
      userId: alex.id,
      actorId: maria.id,
      type: "mention",
      issueId: tokenRace.id,
      commentId: c1.id,
      message: "Maria Chen mentioned you in a comment on ENG-2",
      createdAt: new Date(Date.now() - 3 * 36e5),
    },
    {
      userId: alex.id,
      actorId: maria.id,
      type: "assignment",
      issueId: created[9].id,
      message: "You were assigned ENG-10",
      createdAt: new Date(Date.now() - 20 * 36e5),
    },
    {
      userId: alex.id,
      actorId: null,
      type: "github",
      issueId: oauth.id,
      message: "PR #402 was merged — ENG-3 moved to Done",
      readAt: new Date(Date.now() - 6 * 36e5),
      createdAt: new Date(Date.now() - 8 * 36e5),
    },
    {
      userId: maria.id,
      actorId: alex.id,
      type: "comment",
      issueId: tokenRace.id,
      message: "Alex Gilboa replied on ENG-2",
      createdAt: new Date(Date.now() - 2 * 36e5),
    },
  ]);

  console.log("Seeded: 4 users, 1 workspace, 2 projects, %d issues", created.length);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
