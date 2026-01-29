"use client";

import { useState } from "react";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  items: AdminReviewListItem[];
  onSelect: (id: string) => void;
};

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
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Media</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3 text-right">Actions</th>
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
                className="cursor-pointer bg-white hover:bg-slate-50"
                role="button"
                tabIndex={0}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(item.id);
                    }}
                    className="text-left font-semibold text-slate-900 hover:underline"
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
                <td className="px-4 py-3 text-slate-700">
                  {item.city || "—"} {item.state_region ? `· ${item.state_region}` : ""}{" "}
                  {item.country_code ? `(${item.country_code})` : ""}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {item.status || "unknown"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {item.is_active === null || item.is_active === undefined ? "—" : item.is_active ? "Yes" : "No"}
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt)}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <div className="font-semibold text-slate-700">{item.hostName || "Host"}</div>
                  <div className="break-all">{item.ownerId || "—"}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {item.photoCount} photos · {item.hasVideo ? "Video" : "No video"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {item.price === null || item.price === undefined
                    ? "—"
                    : `${item.currency || "NGN"} ${item.price}`}
                </td>
                <td className="px-4 py-3 text-right">
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
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-600">
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
