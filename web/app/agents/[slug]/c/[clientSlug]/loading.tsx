import { Skeleton } from "@/components/ui/Skeleton";

export default function LoadingAgentClientPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white">
        <div className="relative h-48">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="grid gap-4 px-6 py-6 md:grid-cols-[auto,1fr,auto] md:items-center md:px-10">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-6 w-64" />
        <Skeleton className="mt-3 h-4 w-5/6" />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={`listing-skeleton-${idx}`} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      </section>
    </div>
  );
}
