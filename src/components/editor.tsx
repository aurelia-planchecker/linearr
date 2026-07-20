"use client";

import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { MemberAvatar, type Member } from "@/components/issue-bits";

type MentionListRef = { onKeyDown: (e: { event: KeyboardEvent }) => boolean };

const MentionList = forwardRef<
  MentionListRef,
  SuggestionProps<Member> & { items: Member[] }
>(function MentionList(props, ref) {
  const [index, setIndex] = useState(0);

  // reset highlight when the filtered items change (render-time reconcile)
  const [prevItems, setPrevItems] = useState(props.items);
  if (prevItems !== props.items) {
    setPrevItems(props.items);
    setIndex(0);
  }

  const select = (i: number) => {
    const item = props.items[i];
    if (item) props.command({ id: item.id, label: item.name } as never);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }) {
      if (event.key === "ArrowDown") {
        setIndex((i) => (i + 1) % props.items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setIndex((i) => (i - 1 + props.items.length) % props.items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        select(index);
        return true;
      }
      return false;
    },
  }));

  if (!props.items.length)
    return (
      <div className="rounded-md border border-border bg-popover px-2 py-1.5 text-xs text-muted-foreground shadow-md">
        No members
      </div>
    );

  return (
    <div className="w-56 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md">
      {props.items.map((m, i) => (
        <button
          key={m.id}
          className={cn(
            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
            i === index ? "bg-accent" : "hover:bg-accent/50"
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            select(i);
          }}
        >
          <MemberAvatar member={m} size={18} />
          {m.name}
        </button>
      ))}
    </div>
  );
});

function mentionSuggestion(members: Member[]) {
  return {
    items: ({ query }: { query: string }) =>
      members
        .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6),
    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null;
      let popup: HTMLDivElement | null = null;

      const position = (props: SuggestionProps) => {
        if (!popup) return;
        const rect = props.clientRect?.();
        if (!rect) return;
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 4}px`;
      };

      return {
        onStart(props: SuggestionProps) {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });
          popup = document.createElement("div");
          popup.style.position = "fixed";
          popup.style.zIndex = "100";
          popup.appendChild(component.element);
          document.body.appendChild(popup);
          position(props);
        },
        onUpdate(props: SuggestionProps) {
          component?.updateProps(props);
          position(props);
        },
        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === "Escape") {
            popup?.remove();
            popup = null;
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          popup?.remove();
          component?.destroy();
          popup = null;
          component = null;
        },
      };
    },
  };
}

export function Editor({
  content,
  onChange,
  placeholder = "Add a description…",
  members,
  className,
  autoFocus,
  onSubmit,
}: {
  content?: unknown;
  onChange: (json: unknown) => void;
  placeholder?: string;
  members: Member[];
  className?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: mentionSuggestion(members),
      }),
    ],
    content: (content as never) ?? "",
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm prose-invert max-w-none min-h-[60px] focus:outline-none text-sm leading-relaxed",
          className
        ),
      },
      handleKeyDown: (_view, event) => {
        if (onSubmit && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          onSubmit();
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      // serialize: Next server actions can't ingest Tiptap's node objects directly
      onChange(editor.isEmpty ? null : JSON.stringify(editor.getJSON()));
    },
  });

  // allow parent to clear after submit
  useEffect(() => {
    if (content === null && editor && !editor.isEmpty) editor.commands.clearContent();
  }, [content, editor]);

  return <EditorContent editor={editor} />;
}
