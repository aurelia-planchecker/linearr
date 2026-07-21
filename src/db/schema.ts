import {
  boolean,
  bigint,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ---------- auth (Auth.js drizzle adapter shapes) ----------

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  githubUsername: text("github_username"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

// ---------- core ----------

export const memberRole = pgEnum("member_role", ["admin", "member"]);
export const issueType = pgEnum("issue_type", ["issue", "epic"]);
export const issueStatus = pgEnum("issue_status", [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
]);
export const issuePriority = pgEnum("issue_priority", [
  "none",
  "urgent",
  "high",
  "medium",
  "low",
]);
export const notificationType = pgEnum("notification_type", [
  "mention",
  "assignment",
  "comment",
  "status_change",
  "github",
]);
export const gitLinkType = pgEnum("git_link_type", ["branch", "pr", "commit"]);

export const workspaces = pgTable("workspaces", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId] })]
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRole("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("workspace_invites_ws_email").on(t.workspaceId, t.email)]
);

// Snapshot of a deleted issue (issue + comments + labels + git links) so it can
// be restored. Keeps hard deletes everywhere else — no deleted_at filtering.
export const deletedIssues = pgTable("deleted_issues", {
  id: text("id").primaryKey(), // original issue id
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  number: integer("number").notNull(),
  payload: jsonb("payload").notNull(),
  deletedById: text("deleted_by_id").references(() => users.id, { onDelete: "set null" }),
  deletedAt: timestamp("deleted_at").notNull().defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull(), // e.g. "PROJ" -> issue keys PROJ-123
    description: text("description"),
    nextIssueNumber: integer("next_issue_number").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("projects_ws_key_idx").on(t.workspaceId, t.key)]
);

export const cycles = pgTable("cycles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  name: text("name"),
  startsAt: date("starts_at").notNull(),
  endsAt: date("ends_at").notNull(),
});

export const labels = pgTable(
  "labels",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#8b7cf6"),
  },
  (t) => [uniqueIndex("labels_ws_name_idx").on(t.workspaceId, t.name)]
);

export const issues = pgTable(
  "issues",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    type: issueType("type").notNull().default("issue"),
    // ponytail: parentId serves both sub-task->issue and issue->epic; no epics table
    parentId: text("parent_id"),
    title: text("title").notNull(),
    description: jsonb("description"), // Tiptap JSON doc
    status: issueStatus("status").notNull().default("todo"),
    priority: issuePriority("priority").notNull().default("none"),
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    creatorId: text("creator_id")
      .notNull()
      .references(() => users.id),
    cycleId: text("cycle_id").references(() => cycles.id, {
      onDelete: "set null",
    }),
    dueDate: date("due_date"),
    estimate: integer("estimate"),
    sortOrder: doublePrecision("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("issues_project_number_idx").on(t.projectId, t.number)]
);

export const issueLabels = pgTable(
  "issue_labels",
  {
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.labelId] })]
);

export const comments = pgTable("comments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  issueId: text("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  body: jsonb("body").notNull(), // Tiptap JSON doc
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const activities = pgTable("activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  issueId: text("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => users.id), // null = automation/GitHub
  field: text("field").notNull(), // status | priority | assignee | cycle | due_date | github | created
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => users.id),
  type: notificationType("type").notNull(),
  issueId: text("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  commentId: text("comment_id").references(() => comments.id, {
    onDelete: "cascade",
  }),
  message: text("message").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- github integration ----------

export const githubInstallations = pgTable("github_installations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  installationId: bigint("installation_id", { mode: "number" })
    .notNull()
    .unique(),
  accountLogin: text("account_login").notNull(),
  accountType: text("account_type").notNull().default("Organization"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const githubRepos = pgTable("github_repos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  installationId: text("installation_id")
    .notNull()
    .references(() => githubInstallations.id, { onDelete: "cascade" }),
  repoId: bigint("repo_id", { mode: "number" }).notNull().unique(),
  fullName: text("full_name").notNull(), // "org/repo"
  private: boolean("private").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const issueGitLinks = pgTable(
  "issue_git_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    repoId: text("repo_id")
      .notNull()
      .references(() => githubRepos.id, { onDelete: "cascade" }),
    type: gitLinkType("type").notNull(),
    ref: text("ref").notNull(), // branch name / SHA / PR head ref
    prNumber: integer("pr_number"),
    title: text("title"),
    url: text("url").notNull(),
    state: text("state"), // draft | open | merged | closed (PRs only)
    metadata: jsonb("metadata"),
    lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("git_links_unique_idx").on(t.issueId, t.repoId, t.type, t.ref)]
);

// ---------- relations (for db.query) ----------

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, { fields: [issues.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [issues.assigneeId], references: [users.id] }),
  creator: one(users, { fields: [issues.creatorId], references: [users.id] }),
  cycle: one(cycles, { fields: [issues.cycleId], references: [cycles.id] }),
  parent: one(issues, {
    fields: [issues.parentId],
    references: [issues.id],
    relationName: "parent",
  }),
  subIssues: many(issues, { relationName: "parent" }),
  labels: many(issueLabels),
  comments: many(comments),
  activities: many(activities),
  gitLinks: many(issueGitLinks),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  issues: many(issues),
  cycles: many(cycles),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  projects: many(projects),
  memberships: many(memberships),
  labels: many(labels),
  githubInstallations: many(githubInstallations),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  workspace: one(workspaces, {
    fields: [memberships.workspaceId],
    references: [workspaces.id],
  }),
}));

export const issueLabelsRelations = relations(issueLabels, ({ one }) => ({
  issue: one(issues, { fields: [issueLabels.issueId], references: [issues.id] }),
  label: one(labels, { fields: [issueLabels.labelId], references: [labels.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  issue: one(issues, { fields: [comments.issueId], references: [issues.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  issue: one(issues, { fields: [activities.issueId], references: [issues.id] }),
  actor: one(users, { fields: [activities.actorId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  actor: one(users, { fields: [notifications.actorId], references: [users.id] }),
  issue: one(issues, { fields: [notifications.issueId], references: [issues.id] }),
  comment: one(comments, {
    fields: [notifications.commentId],
    references: [comments.id],
  }),
}));

export const cyclesRelations = relations(cycles, ({ one, many }) => ({
  project: one(projects, { fields: [cycles.projectId], references: [projects.id] }),
  issues: many(issues),
}));

export const githubInstallationsRelations = relations(
  githubInstallations,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [githubInstallations.workspaceId],
      references: [workspaces.id],
    }),
    repos: many(githubRepos),
  })
);

export const githubReposRelations = relations(githubRepos, ({ one, many }) => ({
  installation: one(githubInstallations, {
    fields: [githubRepos.installationId],
    references: [githubInstallations.id],
  }),
  links: many(issueGitLinks),
}));

export const issueGitLinksRelations = relations(issueGitLinks, ({ one }) => ({
  issue: one(issues, { fields: [issueGitLinks.issueId], references: [issues.id] }),
  repo: one(githubRepos, {
    fields: [issueGitLinks.repoId],
    references: [githubRepos.id],
  }),
}));

export type Issue = typeof issues.$inferSelect;
export type IssueStatus = (typeof issueStatus.enumValues)[number];
export type IssuePriority = (typeof issuePriority.enumValues)[number];
