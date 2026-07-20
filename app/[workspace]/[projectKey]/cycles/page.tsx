import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cycles, issues } from "@/db/schema";
import { requireWorkspace } from "@/lib/guards";
import { getProjectByKey } from "@/lib/queries";
import { ViewHeader } from "@/components/view-header";
import { NewCycleButton } from "@/components/new-cycle-button";
import { cn } from "@/lib/utils";

export default async function CyclesPage({
  params,
}: {
  params: Promise<{ workspace: string; projectKey: string }>;
}) {
  const { workspace: slug, projectKey } = await params;
  await requireWorkspace(slug);
  const project = await getProjectByKey(slug, projectKey);
  if (!project) notFound();

  const [cycleRows, issueRows] = await Promise.all([
    db.query.cycles.findMany({
      where: eq(cycles.projectId, project.id),
      orderBy: asc(cycles.number),
    }),
    db.query.issues.findMany({ where: eq(issues.projectId, project.id) }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <ViewHeader
        workspaceSlug={slug}
        projectKey={project.key}
        projectName={project.name}
        projectId={project.id}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Cycles</h2>
            <NewCycleButton workspaceSlug={slug} projectId={project.id} />
          </div>
          {cycleRows.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No cycles yet. Create one to time-box work into sprints.
            </p>
          )}
          {cycleRows.map((c) => {
            const inCycle = issueRows.filter((i) => i.cycleId === c.id);
            const total =
              inCycle.reduce((sum, i) => sum + (i.estimate ?? 0), 0) ||
              inCycle.length;
            const done =
              inCycle.reduce(
                (sum, i) => sum + (i.status === "done" ? (i.estimate ?? 0) : 0),
                0
              ) || inCycle.filter((i) => i.status === "done").length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const current = c.startsAt <= today && today <= c.endsAt;
            const past = c.endsAt < today;
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-lg border border-border bg-card p-4",
                  current && "border-primary/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.name ?? `Cycle ${c.number}`}</span>
                  {current && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Current
                    </span>
                  )}
                  {past && !current && (
                    <span className="text-[11px] text-muted-foreground">Completed</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(c.startsAt + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {" – "}
                    {new Date(c.endsAt + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {pct}% · {inCycle.filter((i) => i.status === "done").length}/{inCycle.length} issues
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
