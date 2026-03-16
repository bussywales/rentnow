"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { PropertyRequestStatus } from "@/lib/requests/property-requests";

type Props = {
  requestId: string;
  status: PropertyRequestStatus;
};

export function PropertyRequestManageActions({ requestId, status }: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"open" | "draft" | "closed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = useMemo(() => {
    if (status === "open") {
      return [
        { status: "draft" as const, label: "Pause request", variant: "secondary" as const },
        { status: "closed" as const, label: "Close request", variant: "secondary" as const },
      ];
    }
    return [{ status: "open" as const, label: "Publish request", variant: "primary" as const }];
  }, [status]);

  async function runAction(nextStatus: "open" | "draft" | "closed") {
    setPendingAction(nextStatus);
    setError(null);

    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; missingFields?: string[] }
        | null;
      if (!response.ok) {
        if (payload?.missingFields?.length) {
          throw new Error(`Complete these fields before publish: ${payload.missingFields.join(", ")}`);
        }
        throw new Error(payload?.error || "Unable to update request");
      }

      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update request");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-3" data-testid="property-request-manage-actions">
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <Button
            key={action.status}
            type="button"
            variant={action.variant}
            onClick={() => void runAction(action.status)}
            disabled={pendingAction !== null}
          >
            {pendingAction === action.status ? "Updating..." : action.label}
          </Button>
        ))}
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
