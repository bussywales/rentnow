import { HOST_DASHBOARD_COPY } from "@/lib/host/host-dashboard-microcopy";
import type { DashboardListing } from "@/lib/properties/host-dashboard";
import { buildEditorLink, topIssueLabel } from "@/lib/host/bulk-triage";
import { Button } from "@/components/ui/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  listings: DashboardListing[];
};

export function HostBulkResumeSetupModal({ open, onClose, listings }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {HOST_DASHBOARD_COPY.bulkModal.title}
            </p>
            <p className="text-xs text-slate-600">
              {HOST_DASHBOARD_COPY.bulkModal.subtitle}
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3 space-y-3">
          {listings.length === 0 ? (
            <p className="text-sm text-slate-600">{HOST_DASHBOARD_COPY.bulkModal.empty}</p>
          ) : (
            listings.map((listing) => {
              const topIssue = topIssueLabel(listing);
              const link = buildEditorLink(listing);
              return (
                <div
                  key={listing.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{listing.title}</p>
                    <p className="text-xs text-slate-600">
                      {listing.readiness.score} · {listing.readiness.tier}
                    </p>
                    <p className="text-xs text-slate-600">
                      {HOST_DASHBOARD_COPY.bulkModal.topIssue.replace("{label}", topIssue)}
                    </p>
                  </div>
                  <a href={link} target="_blank" rel="noreferrer">
                    <Button size="sm">{HOST_DASHBOARD_COPY.bulkModal.open}</Button>
                  </a>
                </div>
              );
            })
          )}
        </div>
        <div className="border-t border-slate-200 px-4 py-3 text-right">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
