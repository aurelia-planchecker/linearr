import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { githubInstallations, githubRepos } from "@/db/schema";
import { automationMove, findIssuesByKeys, upsertGitLink } from "@/lib/github";

function verifySignature(payload: string, signature: string | null) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // dev convenience
  if (!signature) return false;
  const digest = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function repoContext(ghRepoId: number) {
  const repo = await db.query.githubRepos.findFirst({
    where: eq(githubRepos.repoId, ghRepoId),
    with: { installation: true },
  });
  if (!repo) return null;
  return { repo, workspaceId: repo.installation.workspaceId };
}

export async function POST(req: Request) {
  const payload = await req.text();
  if (!verifySignature(payload, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  const event = req.headers.get("x-github-event");
  const body = JSON.parse(payload);

  try {
    switch (event) {
      case "installation": {
        // keep installation records in sync when app is uninstalled
        if (body.action === "deleted") {
          await db
            .delete(githubInstallations)
            .where(eq(githubInstallations.installationId, body.installation.id));
        }
        break;
      }

      case "installation_repositories": {
        const inst = await db.query.githubInstallations.findFirst({
          where: eq(githubInstallations.installationId, body.installation.id),
        });
        if (!inst) break;
        for (const r of body.repositories_added ?? []) {
          await db
            .insert(githubRepos)
            .values({
              installationId: inst.id,
              repoId: r.id,
              fullName: r.full_name,
              private: r.private,
            })
            .onConflictDoNothing();
        }
        for (const r of body.repositories_removed ?? []) {
          await db.delete(githubRepos).where(eq(githubRepos.repoId, r.id));
        }
        break;
      }

      case "create": {
        // branch created — auto-link if the branch name contains an issue key
        if (body.ref_type !== "branch") break;
        const ctx = await repoContext(body.repository.id);
        if (!ctx) break;
        const matches = await findIssuesByKeys(ctx.workspaceId, body.ref);
        for (const { issue, key } of matches) {
          await upsertGitLink({
            issueId: issue.id,
            repoId: ctx.repo.id,
            type: "branch",
            ref: body.ref,
            url: `https://github.com/${body.repository.full_name}/tree/${body.ref}`,
          });
          await automationMove(issue, key, "in_progress", `Branch ${body.ref} created`);
        }
        break;
      }

      case "pull_request": {
        const ctx = await repoContext(body.repository.id);
        if (!ctx) break;
        const pr = body.pull_request;
        const text = `${pr.head?.ref ?? ""} ${pr.title ?? ""} ${pr.body ?? ""}`;
        const matches = await findIssuesByKeys(ctx.workspaceId, text);
        const state: string = pr.merged
          ? "merged"
          : pr.draft
            ? "draft"
            : pr.state === "closed"
              ? "closed"
              : "open";

        for (const { issue, key } of matches) {
          await upsertGitLink({
            issueId: issue.id,
            repoId: ctx.repo.id,
            type: "pr",
            ref: pr.head?.ref ?? String(pr.number),
            prNumber: pr.number,
            title: pr.title,
            url: pr.html_url,
            state,
            metadata: { author: pr.user?.login, baseRef: pr.base?.ref },
          });
          if (body.action === "opened" || body.action === "ready_for_review") {
            await automationMove(issue, key, "in_progress", `PR #${pr.number} opened`);
          } else if (body.action === "closed" && pr.merged) {
            await automationMove(issue, key, "done", `PR #${pr.number} merged`);
          }
        }
        break;
      }

      case "push": {
        // link commits whose message contains an issue key
        const ctx = await repoContext(body.repository.id);
        if (!ctx) break;
        for (const commit of body.commits ?? []) {
          const matches = await findIssuesByKeys(ctx.workspaceId, commit.message ?? "");
          for (const { issue } of matches) {
            await upsertGitLink({
              issueId: issue.id,
              repoId: ctx.repo.id,
              type: "commit",
              ref: commit.id,
              title: (commit.message ?? "").split("\n")[0].slice(0, 120),
              url: commit.url,
            });
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("webhook error", event, err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
