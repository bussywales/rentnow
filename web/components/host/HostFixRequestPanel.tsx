"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HOST_FIX_REQUEST_COPY } from "@/lib/admin/host-fix-request-microcopy";
import {
  buildDismissKey,
  buildFixRequestItems,
  parseRejectionReason,
  shouldShowFixRequestPanel,
} from "@/lib/admin/host-fix-request";
import { formatRelativeTime } from "@/lib/date/relative-time";

type Props = {
  propertyId: string;
  status: string | null | undefined;
  rejectionReason: string | null | undefined;
  updatedAt?: string | null;
};

export function HostFixRequestPanel({ propertyId, status, rejectionReason, updatedAt }: Props) {
  const router = useRouter();
  const parsed = useMemo(() => parseRejectionReason(rejectionReason), [rejectionReason]);
  const storageDismissed = useMemo(() => {
    if (!propertyId || typeof window === "undefined") return false;
    const key = buildDismissKey(propertyId, parsed);
    return window.sessionStorage.getItem(key) === "dismissed";
  }, [parsed, propertyId]);
  const [manualDismissed, setManualDismissed] = useState(false);

  const dismissed = storageDismissed || manualDismissed;
  const show = shouldShowFixRequestPanel(status, dismissed);
  const items = useMemo(() => buildFixRequestItems(parsed.reasons), [parsed.reasons]);

  if (!show || !propertyId) return null;

  const lastReviewed = updatedAt ? formatRelativeTime(updatedAt) : null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-900">{HOST_FIX_REQUEST_COPY.panel.title}</p>
          <p className="text-xs text-amber-900">{HOST_FIX_REQUEST_COPY.panel.subtitle}</p>
          {lastReviewed && (
            <p className="text-[11px] text-amber-800 mt-1">
              {HOST_FIX_REQUEST_COPY.panel.lastReviewed}: {lastReviewed}
            </p>
          )}
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-amber-800 hover:underline"
          onClick={() => {
            const key = buildDismissKey(propertyId, parsed);
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(key, "dismissed");
            }
            setManualDismissed(true);
          }}
        >
          {HOST_FIX_REQUEST_COPY.panel.dismiss}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={`${item.code}-${item.action.kind}-${item.label}`}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm text-amber-900"
          >
            <span>{item.label}</span>
            <button
              type="button"
              className="text-xs font-semibold text-amber-800 hover:underline"
              onClick={() => {
                if (item.action.href) {
                  router.push(item.action.href);
                }
              }}
            >
              {HOST_FIX_REQUEST_COPY.actions[item.action.kind] || HOST_FIX_REQUEST_COPY.actions.details}
            </button>
          </div>
        ))}
      </div>

      {parsed.message && (
        <div className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-amber-900">
          <p className="text-xs font-semibold">{HOST_FIX_REQUEST_COPY.panel.adminMessageTitle}</p>
          <p className="mt-1 whitespace-pre-wrap">{parsed.message}</p>
        </div>
      )}
    </div>
  );
}
