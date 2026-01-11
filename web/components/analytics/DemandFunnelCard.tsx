import type { DemandFunnelSnapshot, DemandFunnelStageKey } from "@/lib/analytics/demand-funnel";

const STAGE_DESCRIPTIONS: Record<DemandFunnelStageKey, string> = {
  views: "Tenant and anonymous property detail views (tenant-side demand).",
  saves: "Saved listings recorded in saved_properties.",
  enquiries: "Distinct non-owner senders messaging a host within the window.",
  viewings: "Viewing requests created by tenants.",
};

const formatCount = (count: number | null, available: boolean) => {
  if (!available || count === null) return "Not available";
  return count.toLocaleString();
};

const formatDelta = (delta: number | null, available: boolean) => {
  if (!available || delta === null) return "Not available";
  if (delta === 0) return "No change";
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;
};

export function DemandFunnelCard({
  funnel,
  title = "Demand funnel",
  showDelta = false,
}: {
  funnel: DemandFunnelSnapshot;
  title?: string;
  showDelta?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600">
        Tenant-side demand from views through viewing requests (read-only).
      </p>

      <div className="mt-4 space-y-3 text-sm text-slate-700">
        {funnel.stages.map((stage) => (
          <div key={stage.key} className="flex items-start justify-between gap-3">
            <span className="text-slate-700" title={STAGE_DESCRIPTIONS[stage.key]}>
              {stage.label}
            </span>
            <div className="text-right">
              <div className="font-semibold text-slate-900">
                {formatCount(stage.count, stage.available)}
              </div>
              {showDelta && (
                <div className="text-xs text-slate-500">
                  {formatDelta(stage.delta, stage.available)} vs previous period
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2 text-sm text-slate-700">
        {funnel.conversions.map((conversion) => (
          <div key={conversion.label} className="flex items-center justify-between">
            <span>{conversion.label}</span>
            <span className="font-semibold">
              {conversion.available && conversion.rate !== null
                ? `${conversion.rate}%`
                : "Not available"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Biggest drop-off:{" "}
        {funnel.dropOff?.available && funnel.dropOff.rate !== null
          ? `${funnel.dropOff.label} (${funnel.dropOff.rate}%)`
          : "Not available"}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Anonymous views are recorded without per-viewer dedupe.
      </p>
    </div>
  );
}
