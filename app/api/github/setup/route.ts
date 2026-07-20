import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { githubInstallations, workspaces } from "@/db/schema";
import { requireUser } from "@/lib/guards";
import { getGithubApp, syncInstallationRepos } from "@/lib/github";

/**
 * GitHub App post-install callback ("Setup URL"):
 * /api/github/setup?installation_id=...&state=<workspaceId>
 */
export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const installationId = Number(url.searchParams.get("installation_id"));
  const workspaceId = url.searchParams.get("state");
  if (!installationId || !workspaceId) {
    return NextResponse.json({ error: "missing installation_id/state" }, { status: 400 });
  }
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) return NextResponse.json({ error: "unknown workspace" }, { status: 400 });

  const app = getGithubApp();
  let accountLogin = "unknown";
  let accountType = "Organization";
  if (app) {
    const { data } = await app.octokit.request("GET /app/installations/{installation_id}", {
      installation_id: installationId,
    });
    const account = data.account as { login?: string; type?: string } | null;
    accountLogin = account?.login ?? "unknown";
    accountType = account?.type ?? "Organization";
  }

  const [inst] = await db
    .insert(githubInstallations)
    .values({ workspaceId, installationId, accountLogin, accountType })
    .onConflictDoUpdate({
      target: githubInstallations.installationId,
      set: { workspaceId, accountLogin, accountType },
    })
    .returning();

  if (app) await syncInstallationRepos(inst.id).catch(console.error);

  return NextResponse.redirect(new URL(`/${ws.slug}/settings`, req.url));
}
