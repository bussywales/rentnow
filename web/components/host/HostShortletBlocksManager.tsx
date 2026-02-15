"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

type HostShortletBlockProperty = {
  id: string;
  title: string | null;
};

type HostShortletBlockRow = {
  id: string;
  property_id: string;
  date_from: string;
  date_to: string;
  reason: string | null;
  property_title: string | null;
};

export function HostShortletBlocksManager(props: {
  initialRows: HostShortletBlockRow[];
  properties: HostShortletBlockProperty[];
}) {
  const [rows, setRows] = useState<HostShortletBlockRow[]>(props.initialRows);
  const [propertyId, setPropertyId] = useState(props.properties[0]?.id || "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const propertyTitleById = useMemo(
    () => new Map(props.properties.map((row) => [row.id, row.title || null])),
    [props.properties]
  );

  async function addBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    if (!propertyId || !dateFrom || !dateTo) {
      setError("Select listing and dates.");
      return;
    }
    if (dateTo <= dateFrom) {
      setError("End date must be after start date.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/shortlet/blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          date_from: dateFrom,
          date_to: dateTo,
          reason: reason.trim() || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            block?: {
              id: string;
              property_id: string;
              date_from: string;
              date_to: string;
              reason: string | null;
            };
            error?: string;
          }
        | null;
      if (!response.ok || !payload?.block) {
        throw new Error(payload?.error || "Unable to add block");
      }

      const nextRow: HostShortletBlockRow = {
        ...payload.block,
        property_title: propertyTitleById.get(payload.block.property_id) || null,
      };
      setRows((prev) => [...prev, nextRow].sort((a, b) => a.date_from.localeCompare(b.date_from)));
      setDateFrom("");
      setDateTo("");
      setReason("");
      setNotice("Date block added.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to add block");
    } finally {
      setBusy(false);
    }
  }

  async function removeBlock(blockId: string) {
    if (!blockId || removingId) return;
    setRemovingId(blockId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/shortlet/blocks/${blockId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to remove block");
      }
      setRows((prev) => prev.filter((row) => row.id !== blockId));
      setNotice("Date block removed.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove block");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Add blocked dates</h2>
        <p className="mt-1 text-xs text-slate-600">Blocks prevent new bookings for the selected range.</p>

        <form onSubmit={addBlock} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-slate-600 lg:col-span-2">
            Listing
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              required
            >
              {props.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title || property.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            From
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              required
            />
          </label>
          <label className="text-xs text-slate-600">
            To
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              required
            />
          </label>
          <label className="text-xs text-slate-600">
            Reason
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button size="sm" type="submit" disabled={busy || !props.properties.length}>
              {busy ? "Saving..." : "Block dates"}
            </Button>
          </div>
        </form>

        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        {notice ? <p className="mt-2 text-xs text-emerald-700">{notice}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Existing blocks</h2>
        {rows.length ? (
          <div className="mt-3 space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="flex min-w-0 flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{row.property_title || row.property_id}</p>
                  <p className="text-xs text-slate-600">
                    {row.date_from} to {row.date_to}
                  </p>
                  <p className="text-xs text-slate-500">{row.reason || "No reason"}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void removeBlock(row.id)}
                  disabled={removingId === row.id}
                >
                  {removingId === row.id ? "Removing..." : "Unblock"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No calendar blocks yet.</p>
        )}
      </section>
    </div>
  );
}
