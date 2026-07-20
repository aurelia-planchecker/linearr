import { requireUser } from "@/lib/guards";
import { createWorkspace } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function WelcomePage() {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8">
        <div>
          <h1 className="text-lg font-semibold">Welcome, {user.name?.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">
            Create a workspace to get started.
          </p>
        </div>
        <form
          className="space-y-3"
          action={async (fd: FormData) => {
            "use server";
            await createWorkspace(String(fd.get("name")));
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" name="name" placeholder="Acme Inc" required autoFocus />
          </div>
          <Button type="submit" className="w-full">
            Create workspace
          </Button>
        </form>
      </div>
    </div>
  );
}
