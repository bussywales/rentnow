"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { resolveListingTransferStatusLabel } from "@/lib/properties/listing-ownership-transfer";

type TransferRow = {
  id: string;
  property_id: string;
  from_owner_id: string;
  to_owner_id: string;
  recipient_email: string;
  status: string;
  created_at: string;
  responded_at?: string | null;
  expires_at: string;
  last_failure_reason?: string | null;
  property?: {
    id?: string | null;
    title?: string | null;
    city?: string | null;
    status?: string | null;
  } | null;
  from_owner?: {
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
  } | null;
  to_owner?: {
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
  } | null;
};

type Props = {
  incoming: TransferRow[];
  outgoing: TransferRow[];
};

function describePerson(person: TransferRow["from_owner"] | TransferRow["to_owner"], fallback?: string | null) {
  return (
    person?.display_name?.trim() ||
    person?.business_name?.trim() ||
    person?.full_name?.trim() ||
    fallback ||
    "Unknown user"
  );
}

function describeListing(row: TransferRow) {
  const title = row.property?.title?.trim() || "Untitled listing";
  return row.property?.city?.trim() ? `${title} · ${row.property.city}` : title;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function ListingTransfersInbox({ incoming, outgoing }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const orderedIncoming = useMemo(() => incoming, [incoming]);
  const orderedOutgoing = useMemo(() => outgoing, [outgoing]);

  const act = (transferId: string, action: "accept" | "reject" | "cancel") => {
    setError(null);
    setInfo(null);
    setPendingActionId(transferId);
    startTransition(async () => {
      const response = await fetch(`/api/listing-transfers/${transferId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || "Unable to update transfer request.");
        setPendingActionId(null);
        return;
      }
      setInfo(
        action === "accept"
          ? "Transfer accepted. The listing now belongs to your account."
          : action === "reject"
            ? "Transfer request rejected. The listing stays with the current owner."
            : "Transfer request cancelled. The listing stays with the current owner."
      );
      setPendingActionId(null);
      router.refresh();
    });
  };

  const renderCard = (row: TransferRow, direction: "incoming" | "outgoing") => {
    const busy = isPending && pendingActionId === row.id;
    return (
      <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              {direction === "incoming" ? "Incoming" : "Outgoing"}
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">{describeListing(row)}</p>
            <p className="mt-1 text-sm text-slate-600">
              {direction === "incoming"
                ? `From ${describePerson(row.from_owner)}`
                : `To ${describePerson(row.to_owner, row.recipient_email)}`}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            {resolveListingTransferStatusLabel(row.status)}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
          <p>Created {formatDate(row.created_at) || "Unknown date"}</p>
          <p>Expires {formatDate(row.expires_at) || "Unknown date"}</p>
          <p>Listing status: {row.property?.status || "unknown"}</p>
          {row.last_failure_reason ? <p>{row.last_failure_reason}</p> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {direction === "incoming" && row.status === "pending" ? (
            <>
              <Button size="sm" onClick={() => act(row.id, "accept")} disabled={busy}>
                {busy ? "Updating..." : "Accept transfer"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => act(row.id, "reject")} disabled={busy}>
                Reject
              </Button>
            </>
          ) : null}
          {direction === "outgoing" && row.status === "pending" ? (
            <Button size="sm" variant="secondary" onClick={() => act(row.id, "cancel")} disabled={busy}>
              {busy ? "Updating..." : "Cancel transfer"}
            </Button>
          ) : null}
          <a
            href={`/host/properties/${row.property_id}/edit`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Open listing
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="listing-transfers-inbox">
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
      {info ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{info}</div> : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Incoming transfer requests</h2>
          <p className="text-sm text-slate-600">Accept only when you are ready to take over the listing and its live entitlement obligations.</p>
        </div>
        {orderedIncoming.length ? (
          <div className="space-y-3">{orderedIncoming.map((row) => renderCard(row, "incoming"))}</div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            No incoming ownership transfers for this account.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Outgoing transfer requests</h2>
          <p className="text-sm text-slate-600">The listing stays under the current owner until the recipient accepts.</p>
        </div>
        {orderedOutgoing.length ? (
          <div className="space-y-3">{orderedOutgoing.map((row) => renderCard(row, "outgoing"))}</div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            No outgoing ownership transfers yet.
          </div>
        )}
      </section>
    </div>
  );
}
