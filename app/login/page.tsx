import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { db } from "@/db";
import { Button } from "@/components/ui/button";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  const demoUsers =
    process.env.NODE_ENV !== "production"
      ? await db.query.users.findMany({ limit: 6 })
      : [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8">
        <div className="space-y-1 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            L
          </div>
          <h1 className="text-lg font-semibold">Sign in to Linearr</h1>
          <p className="text-sm text-muted-foreground">
            Project management, without the trade-offs.
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <Button type="submit" className="w-full" disabled={!process.env.AUTH_GITHUB_ID}>
            Continue with GitHub
          </Button>
        </form>
        {!process.env.AUTH_GITHUB_ID && (
          <p className="text-center text-xs text-muted-foreground">
            Set AUTH_GITHUB_ID / AUTH_GITHUB_SECRET in .env to enable GitHub login.
          </p>
        )}

        {demoUsers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              demo users (dev only)
              <div className="h-px flex-1 bg-border" />
            </div>
            {demoUsers.map((u) => (
              <form
                key={u.id}
                action={async () => {
                  "use server";
                  await signIn("demo", { email: u.email, redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="secondary" className="w-full justify-start">
                  <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px]">
                    {(u.name ?? "?").slice(0, 1)}
                  </span>
                  {u.name}
                  <span className="ml-auto text-xs text-muted-foreground">{u.email}</span>
                </Button>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
