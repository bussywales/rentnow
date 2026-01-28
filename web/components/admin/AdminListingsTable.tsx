"use client";

import type { AdminReviewListItem } from "@/lib/admin/admin-review";

type Props = {
  items: AdminReviewListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AdminListingsTable({ items, selectedId, onSelect }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Media</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr
                key={item.id}
                className={selectedId === item.id ? "bg-sky-50" : "bg-white"}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="text-left font-semibold text-slate-900 hover:underline"
                  >
                    {item.title}
                  </button>
                  <div className="mt-1 text-xs text-slate-500 break-all">ID: {item.id}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    {item.status || "unknown"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {item.city || "—"} {item.country_code ? `(${item.country_code})` : ""}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 break-all">
                  {item.ownerId || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.updatedAt)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {item.photoCount} photos · {item.hasVideo ? "Video" : "No video"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {item.currency || "NGN"} {item.price ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-600">
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
