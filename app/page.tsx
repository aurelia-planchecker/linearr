import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { requireUser } from "@/lib/guards";

export default async function Home() {
  const user = await requireUser();
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
    with: { workspace: true },
  });
  if (!membership) redirect("/welcome");
  redirect(`/${membership.workspace.slug}`);
}
