import { Fragment } from "react";

/* Server-safe renderer for the Tiptap JSON we produce (paragraphs, marks,
   lists, code, blockquote, mentions). */

type Node = {
  type?: string;
  text?: string;
  content?: Node[];
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

function renderText(node: Node, i: number) {
  let el: React.ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") el = <strong>{el}</strong>;
    else if (mark.type === "italic") el = <em>{el}</em>;
    else if (mark.type === "strike") el = <s>{el}</s>;
    else if (mark.type === "code")
      el = <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{el}</code>;
    else if (mark.type === "link")
      el = (
        <a
          href={String(mark.attrs?.href ?? "#")}
          className="text-primary underline"
          target="_blank"
          rel="noreferrer"
        >
          {el}
        </a>
      );
  }
  return <Fragment key={i}>{el}</Fragment>;
}

function renderNode(node: Node, i: number): React.ReactNode {
  const children = node.content?.map(renderNode) ?? null;
  switch (node.type) {
    case "doc":
      return <Fragment key={i}>{children}</Fragment>;
    case "paragraph":
      return (
        <p key={i} className="my-1 leading-relaxed">
          {children}
        </p>
      );
    case "text":
      return renderText(node, i);
    case "mention":
      return (
        <span key={i} className="mention">
          @{String(node.attrs?.label ?? "unknown")}
        </span>
      );
    case "bulletList":
      return (
        <ul key={i} className="my-1 list-disc pl-5">
          {children}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={i} className="my-1 list-decimal pl-5">
          {children}
        </ol>
      );
    case "listItem":
      return <li key={i}>{children}</li>;
    case "codeBlock":
      return (
        <pre key={i} className="my-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
          <code>{children}</code>
        </pre>
      );
    case "blockquote":
      return (
        <blockquote key={i} className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
          {children}
        </blockquote>
      );
    case "heading":
      return (
        <p key={i} className="mt-3 mb-1 font-semibold">
          {children}
        </p>
      );
    case "hardBreak":
      return <br key={i} />;
    case "horizontalRule":
      return <hr key={i} className="my-3 border-border" />;
    default:
      return <Fragment key={i}>{children}</Fragment>;
  }
}

export function RichText({ doc, className }: { doc: unknown; className?: string }) {
  if (!doc || typeof doc !== "object") return null;
  return <div className={className}>{renderNode(doc as Node, 0)}</div>;
}
