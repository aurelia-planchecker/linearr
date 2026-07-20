import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireWorkspace } from "@/lib/guards";
import { InboxList } from "@/components/inbox-list";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { user } = await requireWorkspace(slug);

  const rows = await db.query.notifications.findMany({
    where: eq(notifications.userId, user.id),
    with: {
      actor: true,
      issue: { with: { project: true } },
    },
    orderBy: desc(notifications.createdAt),
    limit: 100,
  });

  const items = rows.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
    actor: n.actor ? { id: n.actor.id, name: n.actor.name ?? "?", image: n.actor.image } : null,
    issueKey: `${n.issue.project.key}-${n.issue.number}`,
    issueTitle: n.issue.title,
  }));

  return <InboxList items={items} workspaceSlug={slug} />;
}
