"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Kanban, List, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ViewHeader({
  workspaceSlug,
  projectKey,
  projectName,
  projectId,
}: {
  workspaceSlug: string;
  projectKey: string;
  projectName: string;
  projectId: string;
}) {
  const pathname = usePathname();
  const base = `/${workspaceSlug}/${projectKey}`;
  const tabs = [
    { href: base, label: "Board", icon: Kanban },
    { href: `${base}/list`, label: "List", icon: List },
    { href: `${base}/cycles`, label: "Cycles", icon: RefreshCw },
  ];
  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
      <span className="text-sm font-medium">{projectName}</span>
      <div className="flex items-center rounded-md border border-border p-0.5">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs text-muted-foreground",
              pathname === t.href && "bg-accent text-foreground"
            )}
          >
            <t.icon className="size-3" />
            {t.label}
          </Link>
        ))}
      </div>
      <Button
        size="sm"
        className="ml-auto h-7 gap-1 text-xs"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("new-issue", { detail: { projectId } }))
        }
      >
        <Plus className="size-3.5" />
        New issue
      </Button>
    </header>
  );
}

export function NewIssueTrigger({
  projectId,
  status,
  className,
}: {
  projectId: string;
  status?: string;
  className?: string;
}) {
  return (
    <button
      className={cn(
        "flex items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("new-issue", { detail: { projectId, status } })
        )
      }
      aria-label="Add issue"
    >
      <Plus className="size-3.5" />
    </button>
  );
}
