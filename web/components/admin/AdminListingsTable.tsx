"use client";

import { useEffect, useState } from "react";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import AdminDemoToggleButton from "@/components/admin/AdminDemoToggleButton";
import AdminFeaturedToggleButton from "@/components/admin/AdminFeaturedToggleButton";
import AdminListingsBulkActions from "@/components/admin/AdminListingsBulkActions";
import { resolveAdminListingQualityStatus } from "@/lib/admin/listing-quality";
import { isFeaturedListingActive } from "@/lib/properties/featured";
import { resolveAdminOwnerIdentityDisplay } from "@/lib/admin/admin-owner-identity";

type Props = {
  items: AdminReviewListItem[];
  onSelect: (id: string) => void;
};

function statusAccent(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "pending") return "bg-amber-400";
  if (normalized === "live") return "bg-emerald-500";
  if (normalized === "removed") return "bg-rose-500";
  if (normalized === "expired") return "bg-amber-500";
  if (normalized === "rejected") return "bg-red-500";
  if (normalized === "paused" || normalized === "paused_owner" || normalized === "paused_occupied") {
    return "bg-slate-400";
  }
  if (normalized === "changes_requested") return "bg-orange-400";
  if (normalized === "draft") return "bg-slate-300";
  return "bg-slate-200";
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

function formatIntent(value?: string | null) {
  if (!value) return "—";
  const normalized = value.toLowerCase();
  if (normalized === "buy") return "Buy";
  if (normalized === "rent") return "Rent";
  return value;
}

function qualityTone(status: "Strong" | "Fair" | "Needs work") {
  if (status === "Strong") return "bg-emerald-50 text-emerald-700";
  if (status === "Fair") return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

export function AdminListingsTable({ items, onSelect }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminReviewListItem[]>(items);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setRows(items);
  }, [items]);

  useEffect(() => {
    const nextIds = new Set(items.map((item) => item.id));
    setSelectedIds((prev) => prev.filter((id) => nextIds.has(id)));
  }, [items]);

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const selectedItems = rows.filter((row) => selectedIds.includes(row.id));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <AdminListingsBulkActions
        selectedItems={selectedItems}
        onClearSelection={() => setSelectedIds([])}
        onActionApplied={({ action, affectedIds }) => {
          if (action === "deactivate") {
            setRows((prev) =>
              prev.map((row) =>
                affectedIds.includes(row.id)
                  ? {
                      ...row,
                      status: "removed",
                      is_active: false,
                      is_approved: false,
                      is_featured: false,
                      featured_until: null,
                      featured_rank: null,
                    }
                  : row
              )
            );
          } else {
            setRows((prev) => prev.filter((row) => !affectedIds.includes(row.id)));
          }
          setSelectedIds((prev) => prev.filter((id) => !affectedIds.includes(id)));
        }}
        onToast={(message) => {
          setToast(message);
          setTimeout(() => setToast(null), 2500);
        }}
      />
      {toast ? (
        <div className="border-b border-slate-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {toast}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1600px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[44px]" />
            <col className="w-2" />
            <col className="w-[230px]" />
            <col className="w-[160px]" />
            <col className="w-[90px]" />
            <col className="w-[70px]" />
            <col className="w-[60px]" />
            <col className="w-[90px]" />
            <col className="w-[90px]" />
            <col className="w-[90px]" />
            <col className="w-[140px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[220px]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  aria-label="Select all visible listings"
                  data-testid="admin-listings-select-all"
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedIds(rows.map((row) => row.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              </th>
              <th
                aria-hidden="true"
                data-testid="admin-listings-header-spacer"
                className="px-0"
              />
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Intent</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Featured</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Media</th>
              <th className="px-3 py-2">Quality</th>
              <th className="w-[120px] px-3 py-2 text-right">Price</th>
              <th className="w-[220px] px-3 py-2 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((item) => {
              const featuredActive = isFeaturedListingActive({
                is_featured: item.is_featured,
                featured_until: item.featured_until,
              });
              const ownerIdentity = resolveAdminOwnerIdentityDisplay({
                ownerName: item.ownerName,
                ownerEmail: item.ownerEmail,
                ownerId: item.ownerId,
                hostName: item.hostName,
              });
              const qualityScore = item.listingQuality?.score ?? null;
              const qualityStatus =
                item.listingQualityStatus ??
                (typeof qualityScore === "number"
                  ? resolveAdminListingQualityStatus(qualityScore)
                  : null);
              return (
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
                className="relative cursor-pointer bg-white hover:bg-slate-50"
                role="button"
                tabIndex={0}
              >
                <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    aria-label={`Select listing ${item.title}`}
                    data-testid={`admin-listings-select-${item.id}`}
                    onChange={(event) => {
                      setSelectedIds((prev) =>
                        event.target.checked
                          ? Array.from(new Set([...prev, item.id]))
                          : prev.filter((id) => id !== item.id)
                      );
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                </td>
                <td
                  className="px-0"
                  data-testid="admin-listings-row-spacer"
                  aria-hidden="true"
                >
                  <span
                    className={`block h-full w-1 ${statusAccent(item.status)}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(item.id);
                    }}
                    className="max-w-[230px] truncate text-left font-semibold text-slate-900 hover:underline"
                    title={item.title}
                  >
                    {item.title}
                  </button>
                  <div className="mt-1 text-xs text-slate-500 break-all">
                    Listing ID: {item.id}{" "}
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
                  {item.is_demo ? (
                    <div className="mt-1">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        Demo
                      </span>
                    </div>
                  ) : null}
                  {featuredActive ? (
                    <div className="mt-1">
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        Featured
                      </span>
                    </div>
                  ) : null}
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
                <td className="px-3 py-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                    {formatIntent(item.listing_intent)}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {item.is_active === null || item.is_active === undefined ? "—" : item.is_active ? "Yes" : "No"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {featuredActive ? (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      Off
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 tabular-nums">{formatDate(item.updatedAt)}</td>
                <td className="px-3 py-2 text-slate-600 tabular-nums">{formatDate(item.expiresAt ?? null)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  <div className="font-semibold text-slate-700 break-all">{ownerIdentity.primaryLabel}</div>
                  {ownerIdentity.secondaryLabel ? (
                    <div className="mt-0.5 text-[11px] text-slate-500 break-all">
                      {ownerIdentity.secondaryLabel}
                    </div>
                  ) : null}
                  {ownerIdentity.primaryKind === "ownerId" && item.ownerId ? (
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                      <span title={item.ownerId}>{truncateId(item.ownerId)}</span>
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
                    </div>
                  ) : null}
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
                <td
                  className="px-3 py-2 text-slate-600"
                  data-testid="admin-listings-row-quality"
                >
                  {typeof qualityScore === "number" ? (
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-semibold text-slate-800 tabular-nums">
                        {qualityScore}%
                      </div>
                      {qualityStatus ? (
                        <span
                          className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${qualityTone(
                            qualityStatus
                          )}`}
                        >
                          {qualityStatus}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td
                  className="w-[120px] px-3 py-2 text-right text-slate-700 tabular-nums overflow-hidden"
                  data-testid="admin-listings-row-price"
                >
                  {item.price === null || item.price === undefined ? (
                    "—"
                  ) : (
                    <span className="inline-flex w-full min-w-0 items-center justify-end gap-1 whitespace-nowrap">
                      <span
                        className="max-w-[44px] truncate text-xs text-slate-500"
                        title={item.currency || "NGN"}
                      >
                        {item.currency || "NGN"}
                      </span>
                      <span className="min-w-0 truncate font-semibold">{item.price}</span>
                    </span>
                  )}
                </td>
                <td
                  className="w-[220px] px-3 py-2 text-right whitespace-nowrap"
                  data-testid="admin-listings-row-actions"
                >
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(item.id);
                      }}
                      className="shrink-0 rounded border border-slate-400 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 lg:text-xs"
                    >
                      View
                    </button>
                    <AdminFeaturedToggleButton
                      propertyId={item.id}
                      isFeatured={!!item.is_featured}
                      isDemo={!!item.is_demo}
                      listingStatus={item.status}
                      featuredUntil={item.featured_until ?? null}
                      dataTestId={`admin-featured-toggle-${item.id}`}
                      buttonClassName="shrink-0 rounded border border-slate-300 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-50 lg:text-xs"
                      onUpdated={(next) => {
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === item.id
                              ? {
                                  ...row,
                                  is_featured: next.is_featured,
                                  featured_until: next.featured_until,
                                }
                              : row
                          )
                        );
                      }}
                      onToast={(message) => {
                        setToast(message);
                        setTimeout(() => setToast(null), 2000);
                      }}
                    />
                    <AdminDemoToggleButton
                      propertyId={item.id}
                      isDemo={!!item.is_demo}
                      dataTestId={`admin-demo-toggle-${item.id}`}
                      buttonClassName="shrink-0 rounded border border-slate-300 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-50 lg:text-xs"
                      onOptimisticUpdate={(next) => {
                        setRows((prev) =>
                          prev.map((row) => (row.id === item.id ? { ...row, is_demo: next } : row))
                        );
                      }}
                      onUpdated={(next) => {
                        setRows((prev) =>
                          prev.map((row) => (row.id === item.id ? { ...row, is_demo: next } : row))
                        );
                      }}
                      onToast={(message) => {
                        setToast(message);
                        setTimeout(() => setToast(null), 2000);
                      }}
                    />
                    {item.is_demo ? (
                      <span
                        className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                        data-testid={`admin-listings-row-demo-pill-${item.id}`}
                      >
                        Demo
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={15} className="px-3 py-6 text-center text-sm text-slate-600">
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
