import { Input } from "@/components/ui/Input";
import type { FilterType } from "@/lib/properties/host-dashboard";

type Props = {
  filter: FilterType;
  onFilter: (filter: FilterType) => void;
  search: string;
  onSearch: (value: string) => void;
  summary: { total: number; needsAttention: number; ready: number };
  showing: number;
};

const chips: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_attention", label: "Needs attention" },
  { key: "ready", label: "Ready to publish" },
  { key: "drafts", label: "Drafts" },
];

export function HostDashboardControls({ filter, onFilter, search, onSearch, summary, showing }: Props) {
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
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => onFilter(chip.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === chip.key
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-600">
        {summary.total} listings · {summary.needsAttention} need attention · {summary.ready} ready
      </p>
    </div>
  );
}
