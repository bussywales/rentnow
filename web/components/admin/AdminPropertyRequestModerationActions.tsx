"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { PropertyRequestStatus } from "@/lib/requests/property-requests";

const ACTION_LABELS = {
  close: "Close request",
  expire: "Expire request",
  remove: "Remove request",
} as const;

type AdminPropertyRequestAction = keyof typeof ACTION_LABELS;

type Props = {
  requestId: string;
  status: PropertyRequestStatus;
};

export function AdminPropertyRequestModerationActions({ requestId, status }: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<AdminPropertyRequestAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = useMemo(() => {
    if (status === "removed") return [] as AdminPropertyRequestAction[];
    if (status === "expired") return ["remove"] as AdminPropertyRequestAction[];
    if (status === "closed") return ["expire", "remove"] as AdminPropertyRequestAction[];
    return ["close", "expire", "remove"] as AdminPropertyRequestAction[];
  }, [status]);

  async function runAction(action: AdminPropertyRequestAction) {
    setPendingAction(action);
    setError(null);

    try {
      const response = await fetch(`/api/admin/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update request");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update request");
    } finally {
      setPendingAction(null);
    }
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" data-testid="admin-property-request-moderation-actions">
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === "remove" ? "ghost" : "secondary"}
            onClick={() => void runAction(action)}
            disabled={pendingAction !== null}
          >
            {pendingAction === action ? "Updating..." : ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
