import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-8 py-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
