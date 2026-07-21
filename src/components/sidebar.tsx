"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Inbox,
  Kanban,
  List,
  Plus,
  RefreshCw,
  Search,
  Settings,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject } from "@/lib/actions";

type Project = { id: string; name: string; key: string };

export function Sidebar({
  workspace,
  projects,
  unread,
  user,
}: {
  workspace: { name: string; slug: string };
  projects: Project[];
  unread: number;
  user: { name: string; image: string | null };
}) {
  const pathname = usePathname();
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const item = (href: string, exact = false) =>
    cn(
      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
      (exact ? pathname === href : pathname.startsWith(href)) &&
        "bg-accent text-foreground"
    );

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-12 items-center gap-2 px-3">
        <div className="flex size-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
          {workspace.name.slice(0, 1)}
        </div>
        <span className="truncate text-sm font-semibold">{workspace.name}</span>
      </div>

      <div className="px-2">
        <button
          className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("open-command-palette"))
          }
        >
          <Search className="size-3.5" />
          Search…
          <kbd className="ml-auto rounded border border-border px-1 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2">
        <Link href={`/${workspace.slug}/inbox`} className={item(`/${workspace.slug}/inbox`)}>
          <Inbox className="size-4" />
          Inbox
          {unread > 0 && (
            <Badge className="ml-auto h-5 min-w-5 justify-center px-1" variant="default">
              {unread}
            </Badge>
          )}
        </Link>

        <div className="flex items-center justify-between px-2 pt-4 pb-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Projects
          </span>
          <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="size-5">
                <Plus className="size-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-3"
                action={async (fd: FormData) => {
                  await createProject(
                    workspace.slug,
                    String(fd.get("name")),
                    String(fd.get("key"))
                  );
                  setNewProjectOpen(false);
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="p-name">Name</Label>
                  <Input id="p-name" name="name" placeholder="Mobile app" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-key">Key</Label>
                  <Input
                    id="p-key"
                    name="key"
                    placeholder="APP"
                    required
                    className="uppercase"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    Issue keys look like APP-123. Immutable after creation.
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  Create project
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {projects.map((p) => (
          <ProjectNav key={p.id} workspaceSlug={workspace.slug} project={p} pathname={pathname} />
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-border p-2">
        <Link href={`/${workspace.slug}/settings`} className={item(`/${workspace.slug}/settings`)}>
          <Settings className="size-4" />
          Settings
        </Link>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px]">
            {user.name.slice(0, 1)}
          </span>
          <span className="truncate text-sm text-muted-foreground">{user.name}</span>
          <button
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function ProjectNav({
  workspaceSlug,
  project,
  pathname,
}: {
  workspaceSlug: string;
  project: Project;
  pathname: string;
}) {
  const base = `/${workspaceSlug}/${project.key}`;
  const [open, setOpen] = useState(pathname.startsWith(base));
  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="truncate">{project.name}</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{project.key}</span>
      </button>
      {open && (
        <div className="ml-4 space-y-0.5 border-l border-border pl-2">
          <Link
            href={base}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
              pathname === base && "bg-accent text-foreground"
            )}
          >
            <Kanban className="size-3.5" /> Board
          </Link>
          <Link
            href={`${base}/list`}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
              pathname === `${base}/list` && "bg-accent text-foreground"
            )}
          >
            <List className="size-3.5" /> Issues
          </Link>
          <Link
            href={`${base}/cycles`}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
              pathname === `${base}/cycles` && "bg-accent text-foreground"
            )}
          >
            <RefreshCw className="size-3.5" /> Cycles
          </Link>
        </div>
      )}
    </div>
  );
}
