import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deletedIssues } from "@/db/schema";
import { requireWorkspace } from "@/lib/guards";
import { getProjectByKey, loadProjectIssues } from "@/lib/queries";
import { getWorkspaceMembers, restoreIssue } from "@/lib/actions";
import { relativeTime } from "@/lib/issue-meta";
import { Button } from "@/components/ui/button";
import { IssueRow } from "@/components/issue-row";
import { ViewHeader, NewIssueTrigger } from "@/components/view-header";
import { StatusIcon } from "@/components/issue-bits";
import { STATUSES, STATUS_META } from "@/lib/issue-meta";

export default async function IssuesListPage({
  params,
}: {
  params: Promise<{ workspace: string; projectKey: string }>;
}) {
  const { workspace: slug, projectKey } = await params;
  await requireWorkspace(slug);
  const project = await getProjectByKey(slug, projectKey);
  if (!project) notFound();

  const [issues, members, trash] = await Promise.all([
    loadProjectIssues(project.id, project.key),
    getWorkspaceMembers(slug),
    db.query.deletedIssues.findMany({
      where: eq(deletedIssues.projectId, project.id),
      orderBy: desc(deletedIssues.deletedAt),
      limit: 20,
    }),
  ]);

  const groups = STATUSES.map((status) => ({
    status,
    issues: issues.filter((i) => i.status === status),
  })).filter((g) => g.issues.length > 0 || g.status === "todo");

  return (
    <>
      <ViewHeader
        workspaceSlug={slug}
        projectKey={project.key}
        projectName={project.name}
        projectId={project.id}
      />
      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium">No issues yet</p>
            <p className="text-xs text-muted-foreground">
              Press <kbd className="rounded border border-border px-1 font-mono">C</kbd> or use
              the New issue button to create the first one.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.status}>
              <div className="sticky top-0 z-10 flex h-8 items-center gap-2 border-b border-border bg-secondary/80 px-4 backdrop-blur">
                <StatusIcon status={g.status} />
                <span className="text-xs font-semibold">{STATUS_META[g.status].label}</span>
                <span className="text-xs text-muted-foreground">{g.issues.length}</span>
                <NewIssueTrigger
                  projectId={project.id}
                  status={g.status}
                  className="ml-auto opacity-60 hover:opacity-100"
                />
              </div>
              {g.issues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  members={members}
                  workspaceSlug={slug}
                />
              ))}
            </section>
          ))
        )}
        {trash.length > 0 && (
          <section>
            <div className="flex h-8 items-center gap-2 border-b border-border bg-secondary/40 px-4">
              <span className="text-xs font-semibold text-muted-foreground">
                Recently deleted
              </span>
              <span className="text-xs text-muted-foreground">{trash.length}</span>
            </div>
            {trash.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 border-b border-border/50 px-4 py-2 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {project.key}-{t.number}
                </span>
                <span className="text-muted-foreground line-through">{t.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  deleted {relativeTime(t.deletedAt)}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await restoreIssue(t.id);
                  }}
                >
                  <Button type="submit" variant="outline" size="sm" className="h-6 px-2 text-xs">
                    Restore
                  </Button>
                </form>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
