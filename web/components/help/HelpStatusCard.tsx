type StatusCardProps = {
  status: string;
  label: string;
  meaning: string;
  who: string;
  triggers: string[];
  visibility: string[];
  actions: string[];
  report: string;
};

export function HelpStatusCard({
  status,
  label,
  meaning,
  who,
  triggers,
  visibility,
  actions,
  report,
}: StatusCardProps) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      data-testid={`help-status-${status}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
          {status}
        </span>
        <h3 className="text-lg font-semibold text-slate-900">{label}</h3>
      </div>
      <p className="mt-2 text-sm text-slate-600">{meaning}</p>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Who can cause it</p>
          <p className="mt-1">{who}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Visibility</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {visibility.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Common triggers</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {triggers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ops actions</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {actions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">If user reports…</p>
        <p className="mt-2 text-sm text-slate-700">{report}</p>
      </div>
    </section>
  );
}
