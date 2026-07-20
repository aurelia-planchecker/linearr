import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireWorkspace } from "@/lib/guards";

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace } = await requireWorkspace(slug);
  const first = await db.query.projects.findFirst({
    where: eq(projects.workspaceId, workspace.id),
    orderBy: projects.name,
  });
  redirect(first ? `/${slug}/${first.key}` : `/${slug}/settings`);
}
