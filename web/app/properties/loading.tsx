import { PropertyCardSkeleton } from "@/components/properties/PropertyCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function PropertiesLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <PropertyCardSkeleton key={index} />
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-[320px] w-full rounded-2xl" />
      </div>
    </div>
  );
}
