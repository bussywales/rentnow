import { Input } from "@/components/ui/Input";

type Props = {
  selectAllChecked: boolean;
  onToggleSelectAll: () => void;
  search: string;
  onSearch: (value: string) => void;
  summary: { total: number; needsAttention: number; ready: number };
  showing: number;
};

export function HostDashboardControls({ search, onSearch, summary, showing, selectAllChecked, onToggleSelectAll }: Props) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Search listings</p>
          <p className="text-xs text-slate-500">Showing {showing}</p>
        </div>
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by title or area"
          className="sm:max-w-xs"
        />
      </div>
      {showing > 0 && (
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            checked={selectAllChecked}
            onChange={onToggleSelectAll}
          />
          <span>Select all</span>
        </label>
      )}
      <p className="text-xs text-slate-600 break-words">
        {summary.total} listings · {summary.needsAttention} need attention · {summary.ready} ready
      </p>
    </div>
  );
}
