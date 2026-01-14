export default function TenantWorkspaceLoading() {
  return (
    <div className="mx-auto flex max-w-7xl animate-pulse flex-col gap-8 px-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl bg-slate-900 px-6 py-6 text-white shadow-lg ring-1 ring-white/10">
        <div className="h-3 w-32 rounded-full bg-slate-700/80" />
        <div className="mt-3 h-6 w-56 rounded-full bg-slate-700/80" />
        <div className="mt-2 h-4 w-72 rounded-full bg-slate-700/70" />
        <div className="mt-4 flex gap-3">
          <div className="h-9 w-36 rounded-lg bg-slate-700/80" />
          <div className="h-9 w-28 rounded-lg border border-slate-600/60" />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
        <div className="h-4 w-32 rounded-full bg-slate-200" />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`progress-${index}`}
              className="rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-200/60"
            >
              <div className="h-3 w-24 rounded-full bg-slate-200" />
              <div className="mt-2 h-2 w-32 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`summary-${index}`}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70"
          >
            <div className="h-3 w-28 rounded-full bg-slate-200" />
            <div className="mt-3 h-7 w-20 rounded-full bg-slate-200" />
            <div className="mt-2 h-3 w-36 rounded-full bg-slate-100" />
            <div className="mt-2 h-2 w-24 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <div className="h-3 w-32 rounded-full bg-slate-200" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`activity-${index}`}
                className="rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-200/60"
              >
                <div className="h-3 w-40 rounded-full bg-slate-200" />
                <div className="mt-2 h-2 w-48 rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <div className="h-3 w-28 rounded-full bg-slate-200" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`search-${index}`}
                className="rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-200/60"
              >
                <div className="h-3 w-32 rounded-full bg-slate-200" />
                <div className="mt-2 h-2 w-40 rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
