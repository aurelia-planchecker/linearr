import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Layers,
} from "lucide-react";
import { db } from "@/db";
import { cycles, issues } from "@/db/schema";
import { requireWorkspace } from "@/lib/guards";
import { getProjectByKey } from "@/lib/queries";
import { getWorkspaceMembers } from "@/lib/actions";
import { relativeTime } from "@/lib/issue-meta";
import { RichText } from "@/components/rich-text";
import { MemberAvatar, StatusIcon } from "@/components/issue-bits";
import {
  AddSubIssue,
  CommentComposer,
  CopyBranchButton,
  CopyLinkButton,
  DescriptionEditor,
  PropertySidebar,
  TitleEditor,
} from "@/components/issue-detail-client";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/issue-meta";
import { labels as labelsTable } from "@/db/schema";

const STATE_COLORS: Record<string, string> = {
  open: "#61a8ff",
  draft: "#a6adba",
  merged: "#45c28a",
  closed: "#747c8c",
};

const FIELD_VERBS: Record<string, string> = {
  created: "created the issue",
  status: "changed status",
  priority: "changed priority",
  assignee: "changed assignee",
  cycle: "moved to cycle",
  due_date: "changed due date",
  github: "",
};

export default async function IssuePage({
  params,
}: {
  params: Promise<{ workspace: string; key: string }>;
}) {
  const { workspace: slug, key } = await params;
  await requireWorkspace(slug);

  const match = key.match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/);
  if (!match) notFound();
  const project = await getProjectByKey(slug, match[1]);
  if (!project) notFound();

  const issue = await db.query.issues.findFirst({
    where: and(eq(issues.projectId, project.id), eq(issues.number, Number(match[2]))),
    with: {
      assignee: true,
      creator: true,
      labels: { with: { label: true } },
      subIssues: { with: { assignee: true } },
      comments: { with: { author: true }, orderBy: (c, { asc }) => [asc(c.createdAt)] },
      activities: { with: { actor: true }, orderBy: (a, { asc }) => [asc(a.createdAt)] },
      gitLinks: { with: { repo: true } },
      cycle: true,
      parent: true,
    },
  });
  if (!issue) notFound();

  const [members, wsLabels, projectCycles] = await Promise.all([
    getWorkspaceMembers(slug),
    db.query.labels.findMany({ where: eq(labelsTable.workspaceId, project.workspaceId) }),
    db.query.cycles.findMany({ where: eq(cycles.projectId, project.id), orderBy: asc(cycles.number) }),
  ]);

  const issueKey = `${project.key}-${issue.number}`;
  const feed = [
    ...issue.activities.map((a) => ({ kind: "activity" as const, at: a.createdAt, activity: a })),
    ...issue.comments.map((c) => ({ kind: "comment" as const, at: c.createdAt, comment: c })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const linksByRepo = new Map<string, typeof issue.gitLinks>();
  for (const l of issue.gitLinks) {
    const k = l.repo.fullName;
    linksByRepo.set(k, [...(linksByRepo.get(k) ?? []), l]);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href={`/${slug}/${project.key}`}
              className="flex items-center gap-1 hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {project.name}
            </Link>
            <span>/</span>
            {issue.parent && (
              <>
                <Link
                  href={`/${slug}/issue/${project.key}-${issue.parent.number}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  {issue.parent.type === "epic" && <Layers className="size-3.5" />}
                  {project.key}-{issue.parent.number}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="font-mono text-xs">{issueKey}</span>
            <CopyLinkButton text={`${issueKey}: ${issue.title}`} />
            <CopyBranchButton issueKey={issueKey} title={issue.title} />
            {issue.type === "epic" && (
              <Badge variant="outline" className="gap-1 text-primary">
                <Layers className="size-3" /> Epic
              </Badge>
            )}
          </div>

          <TitleEditor issueId={issue.id} title={issue.title} />

          <div className="mt-4">
            <DescriptionEditor
              issueId={issue.id}
              description={issue.description}
              members={members}
            />
          </div>

          {(issue.subIssues.length > 0 || issue.type === "epic") && (
            <section className="mt-8">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sub-issues{" "}
                {issue.subIssues.length > 0 && (
                  <span className="font-mono">
                    {issue.subIssues.filter((s) => s.status === "done").length}/
                    {issue.subIssues.length}
                  </span>
                )}
              </h3>
              <div className="space-y-0.5">
                {issue.subIssues.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/${slug}/issue/${project.key}-${sub.number}`}
                    className="flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent"
                  >
                    <StatusIcon status={sub.status} />
                    <span className="font-mono text-xs text-muted-foreground">
                      {project.key}-{sub.number}
                    </span>
                    <span className="truncate">{sub.title}</span>
                    <span className="ml-auto">
                      <MemberAvatar
                        member={
                          sub.assignee
                            ? { id: sub.assignee.id, name: sub.assignee.name ?? "?", image: sub.assignee.image }
                            : null
                        }
                        size={16}
                      />
                    </span>
                  </Link>
                ))}
              </div>
              <div className="mt-2">
                <AddSubIssue parentId={issue.id} projectId={project.id} />
              </div>
            </section>
          )}

          {linksByRepo.size > 0 && (
            <section className="mt-8">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Development
              </h3>
              <div className="space-y-3">
                {[...linksByRepo.entries()].map(([repo, links]) => (
                  <div key={repo} className="rounded-lg border border-border">
                    <div className="border-b border-border px-3 py-1.5 font-mono text-xs text-muted-foreground">
                      {repo}
                    </div>
                    {links.map((l) => (
                      <a
                        key={l.id}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                      >
                        {l.type === "pr" ? (
                          <GitPullRequest
                            className="size-4 shrink-0"
                            style={{ color: STATE_COLORS[l.state ?? "closed"] ?? "#747c8c" }}
                          />
                        ) : l.type === "branch" ? (
                          <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <GitCommitHorizontal className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate font-mono text-xs">
                          {l.type === "pr" ? `#${l.prNumber}` : l.ref.slice(0, 24)}
                        </span>
                        <span className="truncate text-muted-foreground">{l.title}</span>
                        {l.state && (
                          <Badge
                            variant="outline"
                            className="ml-auto shrink-0 capitalize"
                            style={{ color: STATE_COLORS[l.state] ?? undefined }}
                          >
                            {l.state}
                          </Badge>
                        )}
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          synced {relativeTime(l.lastSyncedAt)}
                        </span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Activity
            </h3>
            <div className="space-y-3">
              {feed.map((item) =>
                item.kind === "comment" ? (
                  <div key={`c-${item.comment.id}`} className="rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-2 px-3 pt-2.5 text-sm">
                      <MemberAvatar
                        member={{
                          id: item.comment.author.id,
                          name: item.comment.author.name ?? "?",
                          image: item.comment.author.image,
                        }}
                        size={20}
                      />
                      <span className="font-medium">{item.comment.author.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {relativeTime(item.comment.createdAt)}
                      </span>
                    </div>
                    <RichText doc={item.comment.body} className="px-3 pb-3 pt-1 text-sm" />
                  </div>
                ) : (
                  <div
                    key={`a-${item.activity.id}`}
                    className="flex items-center gap-2 px-1 text-xs text-muted-foreground"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-border" />
                    <span className="font-medium text-foreground">
                      {item.activity.actor?.name ?? "GitHub"}
                    </span>
                    {item.activity.field === "github" ? (
                      <span>{item.activity.newValue}</span>
                    ) : item.activity.field === "status" ? (
                      <span>
                        changed status{" "}
                        {item.activity.oldValue && (
                          <>
                            from{" "}
                            <b className="text-foreground">
                              {STATUS_META[item.activity.oldValue as keyof typeof STATUS_META]?.label ??
                                item.activity.oldValue}
                            </b>{" "}
                          </>
                        )}
                        to{" "}
                        <b className="text-foreground">
                          {STATUS_META[item.activity.newValue as keyof typeof STATUS_META]?.label ??
                            item.activity.newValue}
                        </b>
                      </span>
                    ) : item.activity.field === "created" ? (
                      <span>created the issue</span>
                    ) : (
                      <span>
                        {FIELD_VERBS[item.activity.field] ?? `changed ${item.activity.field}`}
                        {item.activity.newValue && (
                          <>
                            {" "}to <b className="text-foreground">{item.activity.newValue}</b>
                          </>
                        )}
                      </span>
                    )}
                    <span className="ml-auto shrink-0">{relativeTime(item.activity.createdAt)}</span>
                  </div>
                )
              )}
            </div>
            <div className="mt-4">
              <CommentComposer issueId={issue.id} members={members} />
            </div>
          </section>
        </div>
      </div>

      <aside className="w-72 shrink-0 overflow-y-auto border-l border-border p-4">
        <PropertySidebar
          issueId={issue.id}
          status={issue.status}
          priority={issue.priority}
          assignee={
            issue.assignee
              ? { id: issue.assignee.id, name: issue.assignee.name ?? "?", image: issue.assignee.image }
              : null
          }
          members={members}
          labels={wsLabels.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
          activeLabelIds={issue.labels.map((il) => il.labelId)}
          cycles={projectCycles.map((c) => ({ id: c.id, name: c.name ?? `Cycle ${c.number}` }))}
          cycleId={issue.cycleId}
          dueDate={issue.dueDate}
          estimate={issue.estimate}
        />
        <div className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
          Created by {issue.creator.name} · {relativeTime(issue.createdAt)}
        </div>
      </aside>
    </div>
  );
}
