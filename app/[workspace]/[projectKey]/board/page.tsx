import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/guards";
import { getProjectByKey, loadProjectIssues } from "@/lib/queries";
import { getWorkspaceMembers } from "@/lib/actions";
import { Board } from "@/components/board";
import { ViewHeader } from "@/components/view-header";

export default async function BoardPage({
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

  return (
    <>
      <ViewHeader
        workspaceSlug={slug}
        projectKey={project.key}
        projectName={project.name}
        projectId={project.id}
      />
      <Board
        issues={issues}
        members={members}
        projectId={project.id}
        workspaceSlug={slug}
      />
    </>
  );
}
