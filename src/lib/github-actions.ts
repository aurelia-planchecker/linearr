"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { githubInstallations } from "@/db/schema";
import { requireWorkspace } from "@/lib/guards";
import { syncInstallationRepos } from "@/lib/github";

export async function resyncRepos(wsSlug: string, installationDbId: string) {
  const { workspace } = await requireWorkspace(wsSlug);
  const inst = await db.query.githubInstallations.findFirst({
    where: eq(githubInstallations.id, installationDbId),
  });
  if (!inst || inst.workspaceId !== workspace.id) throw new Error("Not found");
  const count = await syncInstallationRepos(installationDbId);
  revalidatePath(`/${wsSlug}/settings`);
  return count;
}

export async function disconnectInstallation(wsSlug: string, installationDbId: string) {
  const { workspace, role } = await requireWorkspace(wsSlug);
  if (role !== "admin") throw new Error("Admins only");
  const inst = await db.query.githubInstallations.findFirst({
    where: eq(githubInstallations.id, installationDbId),
  });
  if (!inst || inst.workspaceId !== workspace.id) throw new Error("Not found");
  await db.delete(githubInstallations).where(eq(githubInstallations.id, installationDbId));
  revalidatePath(`/${wsSlug}/settings`);
}
