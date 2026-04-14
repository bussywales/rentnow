"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  resolveListingTransferStatusLabel,
  resolveListingTransferRequiresEntitlement,
} from "@/lib/properties/listing-ownership-transfer";

type TransferRow = {
  id: string;
  recipient_email: string;
  status: string;
  expires_at: string;
  created_at: string;
  responded_at?: string | null;
  last_failure_reason?: string | null;
  to_owner?: {
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
    role?: string | null;
  } | null;
};

type Props = {
  propertyId: string;
  propertyTitle: string;
  propertyStatus?: string | null;
  transfers: TransferRow[];
};

function formatPersonName(input: TransferRow["to_owner"]) {
  return (
    input?.display_name?.trim() ||
    input?.business_name?.trim() ||
    input?.full_name?.trim() ||
    null
  );
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function ListingOwnershipTransferPanel({
  propertyId,
  propertyTitle,
  propertyStatus,
  transfers,
}: Props) {
  const router = useRouter();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pendingTransfer = transfers.find((row) => row.status === "pending") ?? null;
  const history = transfers.slice(0, 4);
  const needsEntitlement = resolveListingTransferRequiresEntitlement(propertyStatus);

  const submit = () => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const response = await fetch(`/api/properties/${propertyId}/transfer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientEmail }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || "Unable to create transfer request.");
        return;
      }
      setRecipientEmail("");
      setInfo("Transfer request sent. Ownership stays with you until the recipient accepts.");
      router.refresh();
    });
  };

  const cancel = (transferId: string) => {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const response = await fetch(`/api/listing-transfers/${transferId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || "Unable to cancel transfer request.");
        return;
      }
      setInfo("Transfer request cancelled. The listing remains under your ownership.");
      router.refresh();
    });
  };

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="listing-ownership-transfer-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Listing ownership</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Transfer ownership</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Move this listing to a landlord or agent account with recipient acceptance. The listing ID stays the same and the transfer is logged.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">Listing:</span> {propertyTitle}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Send a transfer request</p>
          <p className="mt-1 text-xs text-slate-600">
            Enter the recipient email for the landlord or agent account that should own this listing next.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {needsEntitlement
              ? "If the listing is live, pending, paused, or expired, the recipient must have valid listing entitlement before acceptance."
              : "Draft and review-stage listings can transfer without fresh listing entitlement at acceptance."}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              placeholder="recipient@example.com"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              disabled={pending || Boolean(pendingTransfer)}
            />
            <Button
              size="sm"
              onClick={submit}
              disabled={pending || !recipientEmail.trim() || Boolean(pendingTransfer)}
            >
              {pending ? "Sending..." : "Send transfer request"}
            </Button>
          </div>
          {pendingTransfer ? (
            <p className="mt-2 text-xs text-amber-700">
              Cancel the current pending transfer before sending another request.
            </p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
          {info ? <p className="mt-2 text-xs text-emerald-700">{info}</p> : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Current transfer state</p>
          {pendingTransfer ? (
            <div className="mt-3 space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                  Pending transfer
                </span>
                <span className="text-xs text-slate-500">Expires {formatDate(pendingTransfer.expires_at) || "soon"}</span>
              </div>
              <p className="text-sm text-slate-700">
                Sent to <span className="font-semibold text-slate-900">{formatPersonName(pendingTransfer.to_owner) || pendingTransfer.recipient_email}</span>
              </p>
              <p className="text-xs text-slate-500">
                Ownership stays with you until the recipient accepts. You can cancel this request anytime before then.
              </p>
              <Button size="sm" variant="secondary" onClick={() => cancel(pendingTransfer.id)} disabled={pending}>
                {pending ? "Updating..." : "Cancel transfer"}
              </Button>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
              No active ownership transfer for this listing.
            </div>
          )}
        </div>
      </div>

      {history.length ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Recent transfer history</p>
          <div className="mt-3 space-y-2">
            {history.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {formatPersonName(row.to_owner) || row.recipient_email}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(row.created_at) || "Unknown date"}
                    {row.last_failure_reason ? ` · ${row.last_failure_reason}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  {resolveListingTransferStatusLabel(row.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
