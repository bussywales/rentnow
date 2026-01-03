import { PropertyCardSkeleton } from "@/components/properties/PropertyCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function PropertyDetailLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Skeleton className="h-[360px] w-full rounded-2xl" />
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-32" />
          <div className="flex gap-3">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-6 w-16 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-[280px] w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Skeleton className="h-5 w-40" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-3 h-24 w-full" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <PropertyCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
