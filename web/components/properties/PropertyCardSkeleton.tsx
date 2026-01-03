import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/cn";

type Props = {
  compact?: boolean;
};

export function PropertyCardSkeleton({ compact }: Props) {
  return (
    <div
      className={cn(
        "card h-full overflow-hidden rounded-2xl bg-white",
        compact && "flex"
      )}
    >
      <Skeleton className={cn(compact ? "h-32 w-32 flex-none" : "h-52 w-full")} />
      <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      </div>
    </div>
  );
}
