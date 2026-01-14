type ProgressStep = {
  label: string;
  description: string;
  complete: boolean;
};

type TenantProgressProps = {
  steps: ProgressStep[];
};

function resolveStatus(steps: ProgressStep[], index: number) {
  if (steps[index]?.complete) return "complete";
  const firstIncomplete = steps.findIndex((step) => !step.complete);
  if (firstIncomplete === index) return "current";
  return "upcoming";
}

export function TenantProgress({ steps }: TenantProgressProps) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <p className="text-sm font-semibold text-slate-900">Your progress</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => {
          const status = resolveStatus(steps, index);
          const badgeStyles =
            status === "complete"
              ? "bg-emerald-100 text-emerald-700"
              : status === "current"
                ? "bg-sky-100 text-sky-700"
                : "bg-slate-100 text-slate-500";
          const titleStyles =
            status === "complete"
              ? "text-slate-900"
              : status === "current"
                ? "text-slate-900"
                : "text-slate-600";

          return (
            <div
              key={step.label}
              className="flex items-center justify-between rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-200/60"
            >
              <div>
                <p className={`text-sm font-semibold ${titleStyles}`}>
                  {step.label}
                </p>
                <p className="text-xs text-slate-500">{step.description}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeStyles}`}
              >
                {status === "complete" ? "Complete" : status === "current" ? "Next" : "Later"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
