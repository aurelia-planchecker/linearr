import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { claimInvites } from "@/lib/actions";
import { requireUser } from "@/lib/guards";

export default async function Home() {
  const user = await requireUser();
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
    with: { workspace: true },
  });
  if (!membership) {
    const claimedSlug = await claimInvites();
    redirect(claimedSlug ? `/${claimedSlug}` : "/welcome");
  }
  redirect(`/${membership.workspace.slug}`);
}
