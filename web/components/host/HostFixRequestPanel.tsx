"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HOST_FIX_REQUEST_COPY } from "@/lib/admin/host-fix-request-microcopy";
import {
  buildDismissKey,
  buildFixRequestItems,
  parseRejectionReason,
  shouldShowFixRequestPanel,
  canResubmit,
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
  const [currentStatus, setCurrentStatus] = useState(status);
  const storageDismissed = useMemo(() => {
    if (!propertyId || typeof window === "undefined") return false;
    const key = buildDismissKey(propertyId, parsed);
    return window.sessionStorage.getItem(key) === "dismissed";
  }, [parsed, propertyId]);
  const [manualDismissed, setManualDismissed] = useState(false);

  const dismissed = storageDismissed || manualDismissed;
  const show = shouldShowFixRequestPanel(currentStatus, dismissed);
  const items = useMemo(() => buildFixRequestItems(parsed.reasons), [parsed.reasons]);
  const [resubmitting, setResubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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

      {info && (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{info}</div>
      )}
      {parsed.message && (
        <div className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-amber-900">
          <p className="text-xs font-semibold">{HOST_FIX_REQUEST_COPY.panel.adminMessageTitle}</p>
          <p className="mt-1 whitespace-pre-wrap">{parsed.message}</p>
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>
      )}
      {canResubmit(currentStatus) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-white px-3 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {HOST_FIX_REQUEST_COPY.panel.resubmitButton}
              </p>
              <p className="text-xs text-amber-800">{HOST_FIX_REQUEST_COPY.panel.resubmitHelper}</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-60"
              disabled={resubmitting}
              onClick={() => setConfirming(true)}
            >
              {resubmitting ? "Resubmitting..." : HOST_FIX_REQUEST_COPY.panel.resubmitButton}
            </button>
          </div>
          {confirming && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">{HOST_FIX_REQUEST_COPY.panel.confirmTitle}</p>
              <p className="text-xs text-amber-800">{HOST_FIX_REQUEST_COPY.panel.confirmBody}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={resubmitting}
                  className="inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  onClick={async () => {
                    if (!canResubmit(currentStatus)) {
                      setError(HOST_FIX_REQUEST_COPY.panel.invalidState);
                      setConfirming(false);
                      return;
                    }
                    setResubmitting(true);
                    setError(null);
                    try {
                      const res = await fetch(`/api/properties/${propertyId}/resubmit`, { method: "POST" });
                      if (!res.ok) {
                        const data = await res.json().catch(() => null);
                        throw new Error(data?.error || "Unable to resubmit");
                      }
                      setCurrentStatus("pending");
                      setManualDismissed(true);
                      setConfirming(false);
                      setError(null);
                      setInfo(HOST_FIX_REQUEST_COPY.panel.successToast);
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : HOST_FIX_REQUEST_COPY.panel.invalidState
                      );
                    } finally {
                      setResubmitting(false);
                    }
                  }}
                >
                  {HOST_FIX_REQUEST_COPY.panel.confirmSubmit}
                </button>
                <button
                  type="button"
                  className="text-xs text-amber-800 underline underline-offset-2"
                  onClick={() => setConfirming(false)}
                  disabled={resubmitting}
                >
                  {HOST_FIX_REQUEST_COPY.panel.confirmCancel}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
