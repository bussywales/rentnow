"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import type {
  AdminBulkListingAction,
  AdminBulkListingEligibility,
  AdminBulkListingPreflightSummary,
} from "@/lib/admin/admin-listing-lifecycle.server";

type Props = {
  selectedItems: AdminReviewListItem[];
  onClearSelection: () => void;
  onActionApplied: (input: { action: AdminBulkListingAction; affectedIds: string[] }) => void;
  onToast: (message: string) => void;
};

type BulkResponse = {
  ok: boolean;
  preflight: AdminBulkListingPreflightSummary;
  affectedIds?: string[];
  affectedCount?: number;
  blockedCount?: number;
  shareLinksRevoked?: number;
  error?: string;
};

type ModalState = {
  action: AdminBulkListingAction;
  selectedIds: string[];
};

function labelForEligibility(value: AdminBulkListingEligibility) {
  if (value === "already_removed") return "Already removed";
  if (value === "requires_removed_status") return "Deactivate first";
  if (value === "protected_history") return "Protected history";
  if (value === "dependency_audit_failed") return "Dependency audit failed";
  if (value === "not_found") return "Missing";
  return "Eligible";
}

function summarizeBlockedReasons(summary: AdminBulkListingPreflightSummary) {
  const counts = new Map<string, number>();
  summary.items
    .filter((item) => item.eligibility !== "eligible")
    .forEach((item) => {
      const label = labelForEligibility(item.eligibility);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

function preflightSnapshotKey(summary: AdminBulkListingPreflightSummary | null) {
  if (!summary) return null;
  return JSON.stringify({
    action: summary.action,
    selectedCount: summary.selectedCount,
    foundCount: summary.foundCount,
    eligibleCount: summary.eligibleCount,
    blockedCount: summary.blockedCount,
    alreadyRemovedCount: summary.alreadyRemovedCount,
    recommendedDeactivateCount: summary.recommendedDeactivateCount,
    missingCount: summary.missingCount,
    requiredConfirmationText: summary.requiredConfirmationText,
    items: summary.items.map((item) => ({
      id: item.id,
      status: item.status,
      eligibility: item.eligibility,
      reason: item.reason,
    })),
  });
}

export default function AdminListingsBulkActions({
  selectedItems,
  onClearSelection,
  onActionApplied,
  onToast,
}: Props) {
  const router = useRouter();
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [preflight, setPreflight] = useState<AdminBulkListingPreflightSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [snapshotResetNotice, setSnapshotResetNotice] = useState<string | null>(null);

  const selectedIds = useMemo(() => selectedItems.map((item) => item.id), [selectedItems]);
  const selectedCount = selectedIds.length;
  const mode = modalState?.action ?? null;
  const blockedSummaries = useMemo(
    () => (preflight ? summarizeBlockedReasons(preflight) : []),
    [preflight]
  );
  const requiredConfirmationText = preflight?.requiredConfirmationText ?? "DELETE 0 LISTINGS";
  const confirmationMatches =
    mode !== "purge" || (!!preflight?.requiredConfirmationText && confirmationText === preflight.requiredConfirmationText);
  const confirmDisabled =
    pending ||
    loading ||
    !preflight ||
    !preflight.eligibleCount ||
    !reason.trim() ||
    !confirmationMatches;

  useEffect(() => {
    if (selectedCount === 0) {
      setModalState(null);
      setPreflight(null);
      setReason("");
      setConfirmationText("");
      setError(null);
      setSnapshotResetNotice(null);
    }
  }, [selectedCount]);

  useEffect(() => {
    if (!modalState || modalState.selectedIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setPreflight(null);
    setError(null);
    setSnapshotResetNotice(null);

    void fetch("/api/admin/listings/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: modalState.action,
        mode: "preflight",
        ids: modalState.selectedIds,
      }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as BulkResponse;
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load bulk cleanup preflight.");
        }
        if (!cancelled) {
          setPreflight(payload.preflight);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load bulk cleanup preflight.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modalState]);

  const closeModal = () => {
    if (pending) return;
    setModalState(null);
    setPreflight(null);
    setReason("");
    setConfirmationText("");
    setError(null);
    setSnapshotResetNotice(null);
  };

  const openModal = (nextMode: AdminBulkListingAction) => {
    setModalState({
      action: nextMode,
      selectedIds,
    });
    setPreflight(null);
    setReason("");
    setConfirmationText("");
    setError(null);
    setSnapshotResetNotice(null);
  };

  const invalidateSnapshot = (nextPreflight: AdminBulkListingPreflightSummary, nextError: string) => {
    const changed = preflightSnapshotKey(preflight) !== preflightSnapshotKey(nextPreflight);
    setPreflight(nextPreflight);
    setError(nextError);
    if (changed) {
      setConfirmationText("");
      setSnapshotResetNotice("Eligibility changed. Review the updated summary and confirm again.");
    } else {
      setSnapshotResetNotice(null);
    }
  };

  const submit = async () => {
    if (!mode || !modalState) return;
    setPending(true);
    setError(null);
    setSnapshotResetNotice(null);
    try {
      const response = await fetch("/api/admin/listings/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          mode: "execute",
          ids: modalState.selectedIds,
          reason,
          confirmationText: mode === "purge" ? confirmationText : undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as BulkResponse;
      if (!response.ok) {
        if (payload.preflight) {
          invalidateSnapshot(payload.preflight, payload.error || "Unable to execute bulk cleanup.");
        } else {
          setError(payload.error || "Unable to execute bulk cleanup.");
        }
        return;
      }

      const affectedIds = payload.affectedIds ?? [];
      onActionApplied({ action: mode, affectedIds });
      onClearSelection();
      router.refresh();
      if (mode === "deactivate") {
        onToast(`Deactivated ${payload.affectedCount ?? affectedIds.length} listings.`);
      } else {
        onToast(`Permanently deleted ${payload.affectedCount ?? affectedIds.length} listings.`);
      }
      closeModal();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to execute bulk cleanup.");
    } finally {
      setPending(false);
    }
  };

  if (!selectedCount) return null;

  return (
    <>
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-sm text-white"
        data-testid="admin-listings-bulk-bar"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold" data-testid="admin-listings-selected-count">
            {selectedCount} selected
          </span>
          <button
            type="button"
            className="rounded border border-slate-500 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800"
            onClick={onClearSelection}
          >
            Clear selection
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            onClick={() => openModal("deactivate")}
            data-testid="admin-listings-bulk-deactivate-open"
          >
            Bulk deactivate
          </button>
          <button
            type="button"
            className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            onClick={() => openModal("purge")}
            data-testid="admin-listings-bulk-purge-open"
          >
            Bulk permanent delete
          </button>
        </div>
      </div>

      {mode ? (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/60 px-4"
          role="dialog"
          aria-modal="true"
          data-testid="admin-listings-bulk-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {mode === "deactivate" ? "Bulk deactivate selected listings" : "Bulk permanent delete selected listings"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {mode === "deactivate"
                    ? "Remove selected listings from the marketplace while preserving support and ops history."
                    : "Permanent delete is only executed for selected listings that are already removed and pass the protected-history audit."}
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                onClick={closeModal}
                disabled={pending}
              >
                Close
              </button>
            </div>

            {loading ? <p className="mt-4 text-sm text-slate-600">Loading preflight summary…</p> : null}
            {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
            {snapshotResetNotice ? (
              <p
                className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                data-testid="admin-listings-bulk-snapshot-reset"
              >
                {snapshotResetNotice}
              </p>
            ) : null}

            {preflight ? (
              <div className="mt-4 space-y-4" data-testid="admin-listings-bulk-preflight">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Selected</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">{preflight.selectedCount}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-emerald-700">Eligible</div>
                    <div className="mt-1 text-2xl font-semibold text-emerald-900">{preflight.eligibleCount}</div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-amber-700">Blocked</div>
                    <div className="mt-1 text-2xl font-semibold text-amber-900">{preflight.blockedCount}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Action</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {mode === "deactivate"
                        ? `Deactivate ${preflight.eligibleCount} listings`
                        : `Delete ${preflight.eligibleCount} listings permanently`}
                    </div>
                  </div>
                </div>

                {preflight.recommendedDeactivateCount > 0 ? (
                  <p className="text-sm text-amber-800">
                    {preflight.recommendedDeactivateCount} selected listings are not yet removed and are recommended for bulk deactivate instead of permanent delete.
                  </p>
                ) : null}
                {preflight.alreadyRemovedCount > 0 && mode === "deactivate" ? (
                  <p className="text-sm text-slate-600">
                    {preflight.alreadyRemovedCount} selected listings are already removed and will be skipped.
                  </p>
                ) : null}

                {blockedSummaries.length ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Blocked summary</p>
                    <ul className="mt-2 flex flex-wrap gap-2 text-sm text-slate-700">
                      {blockedSummaries.map((item) => (
                        <li key={item.label} className="rounded-full border border-slate-200 bg-white px-3 py-1">
                          {item.label}: {item.count}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selected listings preflight</p>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-2">Listing</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">Outcome</th>
                          <th className="px-4 py-2">Why</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preflight.items.map((item) => (
                          <tr key={item.id} data-testid="admin-listings-bulk-preflight-row">
                            <td className="px-4 py-3 align-top text-slate-800">
                              <div className="font-semibold">{item.title || item.id}</div>
                              {item.title ? <div className="mt-1 text-xs text-slate-500 break-all">{item.id}</div> : null}
                            </td>
                            <td className="px-4 py-3 align-top text-slate-600">{item.status || "—"}</td>
                            <td className="px-4 py-3 align-top">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {labelForEligibility(item.eligibility)}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-600">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Admin reason
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    placeholder={
                      mode === "deactivate"
                        ? "Explain why these listings are being removed from the marketplace."
                        : "Explain why permanent deletion is required for these listings."
                    }
                    data-testid="admin-listings-bulk-reason"
                  />
                </label>

                {mode === "purge" ? (
                  <label className="block text-sm font-medium text-slate-700">
                    Type {requiredConfirmationText} to confirm
                    <input
                      value={confirmationText}
                      onChange={(event) => setConfirmationText(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      placeholder={requiredConfirmationText}
                      data-testid="admin-listings-bulk-confirmation"
                    />
                  </label>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={closeModal}
                    disabled={pending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void submit()}
                    disabled={confirmDisabled}
                    data-testid="admin-listings-bulk-confirm"
                  >
                    {pending
                      ? "Saving..."
                      : mode === "deactivate"
                        ? "Confirm bulk deactivate"
                        : "Confirm permanent delete"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
