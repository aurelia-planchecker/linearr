import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="space-y-0 p-0">
        <Skeleton className="m-0 h-8 w-full rounded-none opacity-40" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex h-9 items-center gap-3 border-b border-border/50 px-4">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="ml-auto size-5 rounded-full" />
          </div>
        ))}
      </div>
    </>
  );
}
