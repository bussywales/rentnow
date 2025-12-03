import { Button } from "@/components/ui/Button";
import type { ViewingRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

const viewingRequests: ViewingRequest[] = [
  {
    id: "v1",
    property_id: "mock-1",
    tenant_id: "tenant-1",
    preferred_date: "2025-01-06",
    preferred_time_window: "10:00 - 12:00",
    note: "Happy to do virtual if easier.",
    status: "pending",
    created_at: new Date().toISOString(),
  },
];

export default function ViewingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Viewing requests
        </h1>
        <p className="text-sm text-slate-600">
          Coordinate tours and confirm availability with tenants.
        </p>
      </div>

      <div className="space-y-3">
        {viewingRequests.map((req) => (
          <div
            key={req.id}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Property: {req.property_id}
              </p>
              <p className="text-sm text-slate-600">
                {req.preferred_date} • {req.preferred_time_window}
              </p>
              {req.note && <p className="text-sm text-slate-600">{req.note}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm">Accept</Button>
              <Button size="sm" variant="secondary">
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
