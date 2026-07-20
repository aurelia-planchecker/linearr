"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectInstallation, resyncRepos } from "@/lib/github-actions";

export function GithubRepoActions({
  workspaceSlug,
  installationDbId,
  canDisconnect,
  apiConfigured,
}: {
  workspaceSlug: string;
  installationDbId: string;
  canDisconnect: boolean;
  apiConfigured: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  return (
    <div className="flex items-center gap-1">
      {apiConfigured && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Resync repositories"
          disabled={syncing}
          onClick={async () => {
            setSyncing(true);
            try {
              const n = await resyncRepos(workspaceSlug, installationDbId);
              toast.success(`Synced ${n} repositories`);
              router.refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Sync failed");
            } finally {
              setSyncing(false);
            }
          }}
        >
          <RefreshCw className={syncing ? "size-3.5 animate-spin" : "size-3.5"} />
        </Button>
      )}
      {canDisconnect && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-destructive"
          aria-label="Disconnect"
          onClick={async () => {
            if (!confirm("Disconnect this GitHub organization? Issue links are preserved.")) return;
            await disconnectInstallation(workspaceSlug, installationDbId);
            toast.success("Disconnected");
            router.refresh();
          }}
        >
          <Unlink className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
