"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, Check, CheckCheck, GitPullRequest, MessageSquare, UserPlus, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberAvatar, type Member } from "@/components/issue-bits";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import { relativeTime } from "@/lib/issue-meta";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  type: "mention" | "assignment" | "comment" | "status_change" | "github";
  message: string;
  read: boolean;
  createdAt: string;
  actor: Member | null;
  issueKey: string;
  issueTitle: string;
};

const TYPE_ICON = {
  mention: AtSign,
  assignment: UserPlus,
  comment: MessageSquare,
  status_change: ArrowRightLeft,
  github: GitPullRequest,
};

export function InboxList({ items, workspaceSlug }: { items: Item[]; workspaceSlug: string }) {
  const router = useRouter();
  const unread = items.filter((i) => !i.read).length;

  return (
    <>
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="text-sm font-medium">Inbox</span>
        {unread > 0 && <span className="text-xs text-muted-foreground">{unread} unread</span>}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 gap-1.5 text-xs"
          onClick={async () => {
            await markAllNotificationsRead();
            router.refresh();
          }}
          disabled={unread === 0}
        >
          <CheckCheck className="size-3.5" />
          Mark all read
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium">You’re all caught up.</p>
            <p className="text-xs text-muted-foreground">
              Mentions, assignments, and GitHub updates land here.
            </p>
          </div>
        ) : (
          items.map((n) => {
            const Icon = TYPE_ICON[n.type];
            return (
              <div
                key={n.id}
                className={cn(
                  "group flex items-center gap-3 border-b border-border/50 px-4 py-2.5",
                  !n.read && "bg-primary/[0.04]"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    n.read ? "bg-transparent" : "bg-primary"
                  )}
                />
                {n.actor ? (
                  <MemberAvatar member={n.actor} size={24} />
                ) : (
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </span>
                )}
                <Link
                  href={`/${workspaceSlug}/issue/${n.issueKey}`}
                  className="min-w-0 flex-1"
                  onClick={() => !n.read && markNotificationRead(n.id)}
                >
                  <p className={cn("truncate text-sm", !n.read && "font-medium")}>{n.message}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{n.issueKey}</span> · {n.issueTitle}
                  </p>
                </Link>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {relativeTime(n.createdAt)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 opacity-0 group-hover:opacity-100"
                  aria-label={n.read ? "Mark unread" : "Mark read"}
                  onClick={async () => {
                    await markNotificationRead(n.id, !n.read);
                    router.refresh();
                  }}
                >
                  <Check className={cn("size-3.5", n.read && "text-primary")} />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
