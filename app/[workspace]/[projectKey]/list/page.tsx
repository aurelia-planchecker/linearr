import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/guards";
import { getProjectByKey, loadProjectIssues } from "@/lib/queries";
import { getWorkspaceMembers } from "@/lib/actions";
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

  const [issues, members] = await Promise.all([
    loadProjectIssues(project.id, project.key),
    getWorkspaceMembers(slug),
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
      </div>
    </>
  );
}
