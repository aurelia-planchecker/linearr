"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** G-then-X navigation sequences (Linear style). C and ⌘K live in their own components. */
export function GlobalShortcuts({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const pendingG = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;

      if (e.key === "g") {
        pendingG.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => (pendingG.current = false), 1000);
        return;
      }
      if (!pendingG.current) return;
      pendingG.current = false;

      // g i → inbox · g e → issues · g b → board (relative to current project)
      if (e.key === "i") router.push(`/${workspaceSlug}/inbox`);
      else if (e.key === "e" || e.key === "b") {
        const seg = pathname.split("/").filter(Boolean); // [ws, PROJ, ...]
        const projectKey = seg[1] && !["inbox", "settings", "issue"].includes(seg[1]) ? seg[1] : null;
        if (projectKey)
          router.push(`/${workspaceSlug}/${projectKey}${e.key === "b" ? "" : "/list"}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname, workspaceSlug]);

  return null;
}
