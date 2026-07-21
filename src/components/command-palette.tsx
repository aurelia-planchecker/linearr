"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Inbox,
  Kanban,
  List,
  Plus,
  RefreshCw,
  ArrowRightLeft,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { StatusIcon } from "@/components/issue-bits";
import { searchIssues, updateIssue } from "@/lib/actions";
import { STATUSES, STATUS_META } from "@/lib/issue-meta";
import type { IssueStatus } from "@/db/schema";

type Project = { id: string; name: string; key: string };
type IssueHit = {
  id: string;
  key: string;
  title: string;
  status: IssueStatus;
};

export function CommandPalette({
  workspaceSlug,
  projects,
}: {
  workspaceSlug: string;
  projects: Project[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<IssueHit[]>([]);
  // page: root, or picking a status for a chosen issue
  const [statusTarget, setStatusTarget] = useState<IssueHit | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setStatusTarget(null);
      setHits([]);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpenChange(!open);
      }
    };
    const onOpen = () => handleOpenChange(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
     
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!query.trim()) setHits([]);
      else searchIssues(workspaceSlug, query).then(setHits).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [query, workspaceSlug]);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const nav = useMemo(
    () =>
      projects.flatMap((p) => [
        { icon: Kanban, label: `${p.name} · Board`, path: `/${workspaceSlug}/${p.key}` },
        { icon: List, label: `${p.name} · Issues`, path: `/${workspaceSlug}/${p.key}/list` },
        { icon: RefreshCw, label: `${p.name} · Cycles`, path: `/${workspaceSlug}/${p.key}/cycles` },
      ]),
    [projects, workspaceSlug]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Command palette"
      description="Search or run a command"
    >
      <CommandInput
        placeholder={
          statusTarget
            ? `Set status for ${statusTarget.key}…`
            : "Search issues or run a command…"
        }
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {statusTarget ? (
          <CommandGroup heading={`${statusTarget.key} · ${statusTarget.title}`}>
            {STATUSES.map((s) => (
              <CommandItem
                key={s}
                onSelect={async () => {
                  setOpen(false);
                  await updateIssue(statusTarget.id, { status: s });
                  toast.success(`${statusTarget.key} → ${STATUS_META[s].label}`);
                  router.refresh();
                }}
              >
                <StatusIcon status={s} />
                {STATUS_META[s].label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <>
            <CommandEmpty>No results.</CommandEmpty>
            {hits.length > 0 && (
              <CommandGroup heading="Issues">
                {hits.map((h) => (
                  <CommandItem
                    key={h.id}
                    value={`${h.key} ${h.title}`}
                    onSelect={() => go(`/${workspaceSlug}/issue/${h.key}`)}
                  >
                    <StatusIcon status={h.status} />
                    <span className="font-mono text-xs text-muted-foreground">{h.key}</span>
                    <span className="truncate">{h.title}</span>
                  </CommandItem>
                ))}
                {hits.map((h) => (
                  <CommandItem
                    key={`${h.id}-status`}
                    value={`${h.key} ${h.title} set status`}
                    onSelect={() => {
                      setStatusTarget(h);
                      setQuery("");
                    }}
                  >
                    <ArrowRightLeft className="size-3.5" />
                    <span className="font-mono text-xs text-muted-foreground">{h.key}</span>
                    <span className="truncate">Set status…</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("new-issue"));
                }}
              >
                <Plus className="size-3.5" />
                Create new issue
                <kbd className="ml-auto rounded border border-border px-1 font-mono text-[10px]">C</kbd>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => go(`/${workspaceSlug}/inbox`)}>
                <Inbox className="size-3.5" /> Inbox
              </CommandItem>
              {nav.map((n) => (
                <CommandItem key={n.path} onSelect={() => go(n.path)}>
                  <n.icon className="size-3.5" />
                  {n.label}
                </CommandItem>
              ))}
              <CommandItem onSelect={() => go(`/${workspaceSlug}/settings`)}>
                <Settings className="size-3.5" /> Settings
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
