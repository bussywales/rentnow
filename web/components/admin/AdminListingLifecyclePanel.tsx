"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type DependencyCount = {
  key: string;
  label: string;
  count: number;
};

type DependencySummary = {
  protected: DependencyCount[];
  cleanup: DependencyCount[];
  protectedCount: number;
  cleanupCount: number;
  errors: string[];
  canPurge: boolean;
};

type Props = {
  listingId: string;
  listingTitle: string;
  status: string | null | undefined;
  dependencySummary: DependencySummary;
  onDeactivated?: () => void;
};

const PURGE_CONFIRMATION = "DELETE";

function nonZeroRows(rows: DependencyCount[]) {
  return rows.filter((row) => row.count > 0);
}

export default function AdminListingLifecyclePanel({
  listingId,
  listingTitle,
  status,
  dependencySummary,
  onDeactivated,
}: Props) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState((status ?? "").toLowerCase() || null);
  const [summary, setSummary] = useState<DependencySummary>(dependencySummary);
  const [mode, setMode] = useState<"deactivate" | "purge" | null>(null);
  const [reason, setReason] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isRemoved = currentStatus === "removed";
  const protectedRows = useMemo(() => nonZeroRows(summary.protected), [summary.protected]);
  const cleanupRows = useMemo(() => nonZeroRows(summary.cleanup), [summary.cleanup]);

  const resetForm = () => {
    setMode(null);
    setReason("");
    setConfirmationText("");
    setError(null);
  };

  const submitAction = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          reason,
          confirmationText: mode === "purge" ? confirmationText : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload?.dependencySummary) {
          setSummary(payload.dependencySummary as DependencySummary);
        }
        throw new Error(payload?.error || "Unable to update listing lifecycle.");
      }

      if (mode === "deactivate") {
        setCurrentStatus("removed");
        if (payload?.dependencySummary) {
          setSummary(payload.dependencySummary as DependencySummary);
        }
        onDeactivated?.();
        setToast("Listing removed from marketplace.");
        resetForm();
        router.refresh();
        return;
      }

      router.push("/admin/listings?notice=purged");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update listing lifecycle.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm"
      data-testid="admin-inspector-listing-lifecycle"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Marketplace removal</h2>
          <p className="text-sm text-slate-600">
            Use removal as the default moderation action. Permanent delete is only for junk, spam,
            test data, or legal/privacy removal.
          </p>
        </div>
        {isRemoved ? (
          <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
            Removed from marketplace
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="font-semibold text-slate-900">Deactivate / remove</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>Hides the listing from public browse and search.</li>
            <li>Clears current featured visibility.</li>
            <li>Revokes active property share links.</li>
            <li>Keeps listing history for support and ops.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="font-semibold text-slate-900">Permanent delete / purge</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>Irreversible admin-only hard delete.</li>
            <li>Only allowed after the listing is already removed.</li>
            <li>Blocked when protected history exists.</li>
            <li>Deletes cleanup-only dependencies by cascade.</li>
          </ul>
        </div>
      </div>

      {toast ? <p className="mt-3 text-xs text-emerald-700">{toast}</p> : null}
      {summary.errors.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold text-amber-950">Dependency audit incomplete</p>
          <ul className="mt-2 space-y-1 text-xs">
            {summary.errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">Permanent delete stays blocked until dependency checks succeed.</p>
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Purge blockers
        </p>
        {protectedRows.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-700" data-testid="admin-listing-purge-blockers">
            {protectedRows.map((row) => (
              <li key={row.key}>
                {row.label}: {row.count}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-emerald-700">No protected history found.</p>
        )}
        {cleanupRows.length > 0 ? (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Cleanup-only dependencies
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {cleanupRows.map((row) => (
                <li key={row.key}>
                  {row.label}: {row.count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!isRemoved ? (
          <Button
            size="sm"
            className="bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500"
            onClick={() => {
              setMode("deactivate");
              setError(null);
            }}
            data-testid="admin-listing-deactivate-open"
          >
            Deactivate listing
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          className="border-rose-200 text-rose-700 hover:bg-rose-50"
          onClick={() => {
            setMode("purge");
            setError(null);
          }}
          data-testid="admin-listing-purge-open"
        >
          Delete permanently
        </Button>
      </div>

      {mode ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/50 px-4"
          role="dialog"
          aria-modal="true"
          data-testid={`admin-listing-${mode}-modal`}
          onClick={(event) => {
            if (event.target === event.currentTarget && !pending) {
              resetForm();
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {mode === "deactivate" ? "Remove listing from marketplace?" : "Delete listing permanently?"}
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">{listingTitle}</span>
              {mode === "deactivate"
                ? " will stop appearing in public discovery and active share links will be revoked."
                : " will be permanently deleted. This cannot be undone."}
            </p>
            {mode === "purge" ? (
              <p className="mt-2 text-sm text-rose-700">
                Purge is only safe after marketplace removal and only when protected history is absent.
              </p>
            ) : null}

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Admin reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder={
                  mode === "deactivate"
                    ? "Explain why this listing is being removed from the marketplace."
                    : "Explain why permanent deletion is required."
                }
                data-testid={`admin-listing-${mode}-reason`}
              />
            </label>

            {mode === "purge" ? (
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Type {PURGE_CONFIRMATION} to confirm
                <input
                  value={confirmationText}
                  onChange={(event) => setConfirmationText(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  placeholder={PURGE_CONFIRMATION}
                  data-testid="admin-listing-purge-confirmation"
                />
              </label>
            ) : null}

            {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={resetForm} disabled={pending}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500"
                onClick={() => void submitAction()}
                disabled={pending}
                data-testid={`admin-listing-${mode}-confirm`}
              >
                {pending ? "Saving..." : mode === "deactivate" ? "Confirm removal" : "Delete forever"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
