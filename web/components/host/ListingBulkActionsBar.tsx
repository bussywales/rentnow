import { HOST_DASHBOARD_COPY } from "@/lib/host/host-dashboard-microcopy";
import { Button } from "@/components/ui/Button";

type Props = {
  count: number;
  onResume: () => void;
  onOpenFive: () => void;
  onExport: () => void;
  onClear: () => void;
};

export function ListingBulkActionsBar({ count, onResume, onOpenFive, onExport, onClear }: Props) {
  if (count === 0) return null;
  const overFive = count > 5;
  return (
    <div className="fixed inset-x-4 bottom-4 z-40 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:left-1/2 sm:-translate-x-1/2 sm:w-[640px]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
          <span>{HOST_DASHBOARD_COPY.bulkBar.selected.replace("{count}", String(count))}</span>
          {overFive && (
            <span className="text-xs font-normal text-slate-500">
              {HOST_DASHBOARD_COPY.bulkBar.helper}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onResume}>
            {HOST_DASHBOARD_COPY.bulkBar.resume}
          </Button>
          <Button size="sm" variant="secondary" onClick={onOpenFive} disabled={count === 0}>
            {HOST_DASHBOARD_COPY.bulkBar.openFive}
          </Button>
          <Button size="sm" variant="secondary" onClick={onExport}>
            {HOST_DASHBOARD_COPY.bulkBar.exportCsv}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear}>
            {HOST_DASHBOARD_COPY.bulkBar.clear}
          </Button>
        </div>
      </div>
    </div>
  );
}
