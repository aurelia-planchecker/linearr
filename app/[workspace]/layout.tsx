import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { labels, memberships, notifications, projects } from "@/db/schema";
import { requireWorkspace } from "@/lib/guards";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import { GlobalShortcuts } from "@/components/global-shortcuts";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { user, workspace } = await requireWorkspace(slug);

  const [projectRows, labelRows, memberRows, [{ unread }]] = await Promise.all([
    db.query.projects.findMany({
      where: eq(projects.workspaceId, workspace.id),
      with: { cycles: true },
      orderBy: projects.name,
    }),
    db.query.labels.findMany({ where: eq(labels.workspaceId, workspace.id) }),
    db.query.memberships.findMany({
      where: eq(memberships.workspaceId, workspace.id),
      with: { user: true },
    }),
    db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
  ]);

  const members = memberRows.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? m.user.email ?? "Unknown",
    image: m.user.image,
  }));

  const projectData = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    key: p.key,
    cycles: p.cycles.map((c) => ({
      id: c.id,
      name: c.name ?? `Cycle ${c.number}`,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
    })),
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        workspace={{ name: workspace.name, slug: workspace.slug }}
        projects={projectData}
        unread={unread}
        user={{ name: user.name ?? "Me", image: user.image ?? null }}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      <CommandPalette workspaceSlug={workspace.slug} projects={projectData} />
      <GlobalShortcuts workspaceSlug={workspace.slug} />
      <NewIssueDialog
        workspaceSlug={workspace.slug}
        projects={projectData}
        labels={labelRows.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
        members={members}
      />
    </div>
  );
}
