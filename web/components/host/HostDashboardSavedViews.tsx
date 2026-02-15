import { HOST_DASHBOARD_COPY, HOST_DASHBOARD_VIEWS } from "@/lib/host/host-dashboard-microcopy";
import type { HostDashboardView } from "./useHostDashboardView";

type Props = {
  view: HostDashboardView;
  onSelect: (view: HostDashboardView) => void;
  onReset: () => void;
};

export function HostDashboardSavedViews({ view, onSelect, onReset }: Props) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{HOST_DASHBOARD_COPY.title}</p>
          <p className="text-xs text-slate-500 break-words">{HOST_DASHBOARD_COPY.helper}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {HOST_DASHBOARD_COPY.resetLabel}
          </button>
          <p className="min-w-0 text-[11px] text-slate-500 break-words">{HOST_DASHBOARD_COPY.resetHelper}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(HOST_DASHBOARD_VIEWS).map(([key, value]) => {
          const selected = key === view;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key as HostDashboardView)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                selected
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {value.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-600 break-words">{HOST_DASHBOARD_VIEWS[view].description}</p>
    </div>
  );
}
