import type { IssuePriority, IssueStatus } from "@/db/schema";

export const STATUSES: IssueStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
];

export const STATUS_META: Record<IssueStatus, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "#747c8c" },
  todo: { label: "Todo", color: "#a6adba" },
  in_progress: { label: "In Progress", color: "#f2b84b" },
  in_review: { label: "In Review", color: "#61a8ff" },
  done: { label: "Done", color: "#45c28a" },
  canceled: { label: "Canceled", color: "#747c8c" },
};

export const PRIORITIES: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];

export const PRIORITY_META: Record<IssuePriority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#f16b6b" },
  high: { label: "High", color: "#f2a04b" },
  medium: { label: "Medium", color: "#61a8ff" },
  low: { label: "Low", color: "#a6adba" },
  none: { label: "No priority", color: "#747c8c" },
};

// Case-insensitive so lowercase branch names like stack-12-fix-login link too.
export const ISSUE_KEY_REGEX = /\b([A-Za-z][A-Za-z0-9]{1,9})-(\d+)\b/g;

export function relativeTime(d: Date | string) {
  const t = typeof d === "string" ? new Date(d) : d;
  const s = Math.round((Date.now() - t.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: { id?: string; label?: string };
  content?: TiptapNode[];
};

/** Collect mention user ids from a Tiptap JSON doc. */
export function extractMentionIds(node: unknown): string[] {
  const ids = new Set<string>();
  const walk = (n: TiptapNode | undefined) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "mention" && n.attrs?.id) ids.add(n.attrs.id);
    n.content?.forEach(walk);
  };
  walk(node as TiptapNode);
  return [...ids];
}

/** Plain-text preview of a Tiptap JSON doc. */
export function docToText(node: unknown): string {
  const parts: string[] = [];
  const walk = (n: TiptapNode | undefined) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "text" && n.text) parts.push(n.text);
    if (n.type === "mention" && n.attrs?.label) parts.push(`@${n.attrs.label}`);
    n.content?.forEach(walk);
  };
  walk(node as TiptapNode);
  return parts.join("");
}
