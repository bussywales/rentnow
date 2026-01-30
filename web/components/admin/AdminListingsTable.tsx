"use client";

import { useState } from "react";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  items: AdminReviewListItem[];
  onSelect: (id: string) => void;
};

function statusAccent(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "pending") return "before:bg-amber-400";
  if (normalized === "live") return "before:bg-emerald-500";
  if (normalized === "rejected") return "before:bg-red-500";
  if (normalized === "paused") return "before:bg-slate-400";
  if (normalized === "draft") return "before:bg-slate-300";
  return "before:bg-slate-200";
}

function truncateId(value?: string | null) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AdminListingsTable({ items, onSelect }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Media</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(item.id);
                  }
                }}
                data-testid="admin-listings-row"
                className={`relative cursor-pointer bg-white hover:bg-slate-50 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:content-[''] ${statusAccent(
                  item.status
                )}`}
                role="button"
                tabIndex={0}
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(item.id);
                    }}
                    className="max-w-[240px] truncate text-left font-semibold text-slate-900 hover:underline"
                    title={item.title}
                  >
                    {item.title}
                  </button>
                  <div className="mt-1 text-xs text-slate-500 break-all">
                    ID: {item.id}{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={async (event) => {
                        event.stopPropagation();
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
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-700">
                  <div className="max-w-[180px] truncate" title={`${item.city || "—"} ${item.state_region || ""}`}>
                    {item.city || "—"} {item.state_region ? `· ${item.state_region}` : ""}{" "}
                    {item.country_code ? `(${item.country_code})` : ""}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                    {item.status || "unknown"}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {item.is_active === null || item.is_active === undefined ? "—" : item.is_active ? "Yes" : "No"}
                </td>
                <td className="px-3 py-2 text-slate-600 tabular-nums">{formatDate(item.updatedAt)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  <div className="font-semibold text-slate-700">{item.hostName || "Host"}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span title={item.ownerId || ""}>{truncateId(item.ownerId)}</span>
                    {item.ownerId && (
                      <button
                        type="button"
                        className="rounded px-1 text-slate-500 underline hover:text-slate-700"
                        onClick={async (event) => {
                          event.stopPropagation();
                          try {
                            await navigator.clipboard?.writeText(item.ownerId || "");
                            setCopiedId(item.ownerId || null);
                            setTimeout(() => setCopiedId(null), 2000);
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        {copiedId === item.ownerId ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  <div className="font-semibold text-slate-700">
                    <span className="tabular-nums">{item.photoCount}</span> photos
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-500">
                    {!item.hasCover && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                        Cover missing
                      </span>
                    )}
                    {item.photoCount === 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                        0 photos
                      </span>
                    )}
                    {!item.hasVideo && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        No video
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-700 tabular-nums">
                  {item.price === null || item.price === undefined
                    ? "—"
                    : (
                        <span>
                          <span className="mr-1 text-xs text-slate-500">{item.currency || "NGN"}</span>
                          <span className="font-semibold">{item.price}</span>
                        </span>
                      )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(item.id);
                    }}
                    className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-600">
                  No listings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
