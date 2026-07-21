import { eq } from "drizzle-orm";
import { db } from "@/db";
import { githubInstallations, memberships, workspaceInvites } from "@/db/schema";
import { inviteMember, revokeInvite } from "@/lib/actions";
import { requireWorkspace } from "@/lib/guards";
import { Input } from "@/components/ui/input";
import { githubConfigured } from "@/lib/github";
import { relativeTime } from "@/lib/issue-meta";
import { MemberAvatar } from "@/components/issue-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GithubRepoActions } from "@/components/github-repo-actions";

function Github({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace, role } = await requireWorkspace(slug);

  const [members, installations, invites] = await Promise.all([
    db.query.memberships.findMany({
      where: eq(memberships.workspaceId, workspace.id),
      with: { user: true },
    }),
    db.query.githubInstallations.findMany({
      where: eq(githubInstallations.workspaceId, workspace.id),
      with: { repos: true },
    }),
    db.query.workspaceInvites.findMany({
      where: eq(workspaceInvites.workspaceId, workspace.id),
    }),
  ]);

  const appSlug = process.env.GITHUB_APP_SLUG;
  const installUrl = appSlug
    ? `https://github.com/apps/${appSlug}/installations/new?state=${workspace.id}`
    : null;

  return (
    <>
      <header className="flex h-11 shrink-0 items-center border-b border-border px-4">
        <span className="text-sm font-medium">Settings</span>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Workspace</h2>
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  {workspace.name.slice(0, 1)}
                </div>
                <div>
                  <p className="font-medium">{workspace.name}</p>
                  <p className="text-xs text-muted-foreground">/{workspace.slug}</p>
                </div>
                <Badge variant="outline" className="ml-auto capitalize">
                  {role}
                </Badge>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Members</h2>
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <MemberAvatar
                    member={{ id: m.user.id, name: m.user.name ?? "?", image: m.user.image }}
                    size={26}
                  />
                  <div>
                    <p className="font-medium">{m.user.name}</p>
                    <p className="text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                  <Badge variant="outline" className="ml-auto capitalize">
                    {m.role}
                  </Badge>
                </div>
              ))}
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground"
                >
                  <div className="flex size-[26px] items-center justify-center rounded-full border border-dashed border-border text-[10px]">
                    ?
                  </div>
                  <p>{inv.email}</p>
                  <Badge variant="outline" className="ml-auto">
                    invited
                  </Badge>
                  {role === "admin" && (
                    <form
                      action={async () => {
                        "use server";
                        await revokeInvite(slug, inv.id);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-xs">
                        Revoke
                      </Button>
                    </form>
                  )}
                </div>
              ))}
            </div>
            {role === "admin" && (
              <form
                className="mt-2 flex gap-2"
                action={async (fd: FormData) => {
                  "use server";
                  await inviteMember(slug, String(fd.get("email")));
                }}
              >
                <Input
                  name="email"
                  type="email"
                  required
                  placeholder="teammate@example.com"
                  className="h-8 text-sm"
                />
                <Button type="submit" size="sm" variant="outline" className="h-8">
                  Invite
                </Button>
              </form>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">GitHub integration</h2>
              {installUrl && (
                <Button asChild size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                  <a href={installUrl}>
                    <Github className="size-3.5" />
                    {installations.length ? "Add organization" : "Connect GitHub"}
                  </a>
                </Button>
              )}
            </div>

            {!githubConfigured() && (
              <div className="mb-3 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">GitHub App not configured</p>
                <p>
                  Create a GitHub App (Settings → Developer settings → GitHub Apps) with{" "}
                  <b>Contents: read</b>, <b>Pull requests: read</b> and <b>Webhooks</b> for{" "}
                  <code className="font-mono">create</code>,{" "}
                  <code className="font-mono">push</code>,{" "}
                  <code className="font-mono">pull_request</code>,{" "}
                  <code className="font-mono">installation</code> events. Webhook URL:{" "}
                  <code className="font-mono">/api/github/webhook</code>, Setup URL:{" "}
                  <code className="font-mono">/api/github/setup</code>. Then set GITHUB_APP_ID,
                  GITHUB_APP_SLUG, GITHUB_APP_PRIVATE_KEY and GITHUB_WEBHOOK_SECRET in .env.
                  {installations.length > 0 && " The connection below is seeded demo data."}
                </p>
              </div>
            )}

            {installations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No GitHub organizations connected. Issues auto-link to branches and PRs that
                mention their key (e.g. ENG-12), and merged PRs move issues to Done.
              </div>
            ) : (
              <div className="space-y-3">
                {installations.map((inst) => (
                  <div key={inst.id} className="rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                      <Github className="size-4" />
                      <span className="text-sm font-medium">{inst.accountLogin}</span>
                      <span className="text-xs text-muted-foreground">{inst.accountType}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        connected {relativeTime(inst.createdAt)}
                      </span>
                      <GithubRepoActions
                        workspaceSlug={slug}
                        installationDbId={inst.id}
                        canDisconnect={role === "admin"}
                        apiConfigured={githubConfigured()}
                      />
                    </div>
                    {inst.repos.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-muted-foreground">
                        No repositories synced yet.
                      </p>
                    ) : (
                      inst.repos.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 border-b border-border/50 px-4 py-2 text-sm last:border-b-0"
                        >
                          <span className="font-mono text-xs">{r.fullName}</span>
                          {r.private && (
                            <Badge variant="outline" className="text-[10px]">
                              private
                            </Badge>
                          )}
                          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-[#45c28a]" />
                            auto-linking active
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
