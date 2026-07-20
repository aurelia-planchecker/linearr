import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { memberships, workspaces } from "@/db/schema";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

/** Resolve workspace by slug and assert current user is a member. */
export async function requireWorkspace(slug: string) {
  const user = await requireUser();
  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, slug),
  });
  if (!ws) redirect("/");
  const membership = await db.query.memberships.findFirst({
    where: and(eq(memberships.userId, user.id), eq(memberships.workspaceId, ws.id)),
  });
  if (!membership) redirect("/");
  return { user, workspace: ws, role: membership.role };
}
