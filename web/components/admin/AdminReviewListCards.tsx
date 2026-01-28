"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  items: AdminReviewListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function AdminReviewListCards({ items, selectedId, onSelect }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={`grid gap-3 rounded-xl border p-3 md:grid-cols-[32px_minmax(0,1fr)_auto] md:items-start ${
            selectedId === item.id ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start pt-1">
            <input
              form="bulk-approvals"
              type="checkbox"
              name="ids"
              value={item.id}
              aria-label={`Select ${item.title}`}
              className="h-4 w-4 rounded border-slate-300"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="text-left text-sm font-semibold text-slate-900 hover:underline"
              >
                {item.title}
              </button>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {item.status || "pending"}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              {item.city || "Unknown city"} · Host: {item.hostName}
            </p>
            <p className="text-[11px] text-slate-500 break-all">
              ID: {item.id}{" "}
              <button
                type="button"
                className="underline"
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(item.id);
                    setCopiedId(item.id);
                    setTimeout(() => setCopiedId(null), 2000);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {copiedId === item.id ? "Copied" : "Copy"}
              </button>
            </p>
            <p className="text-xs text-slate-600">
              Photos: {item.photoCount} · Video: {item.hasVideo ? "Yes" : "No"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button size="sm" variant="secondary" onClick={() => onSelect(item.id)}>
              Review
            </Button>
          </div>
        </div>
      ))}
      {!items.length && <p className="p-3 text-sm text-slate-600">No listings found.</p>}
    </div>
  );
}
