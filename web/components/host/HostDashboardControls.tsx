import { Input } from "@/components/ui/Input";

type Props = {
  search: string;
  onSearch: (value: string) => void;
  summary: { total: number; needsAttention: number; ready: number };
  showing: number;
};

export function HostDashboardControls({ search, onSearch, summary, showing }: Props) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
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
      <p className="text-xs text-slate-600">
        {summary.total} listings · {summary.needsAttention} need attention · {summary.ready} ready
      </p>
    </div>
  );
}
