"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminListingsQuery } from "@/lib/admin/admin-listings-query";
import {
  DEFAULT_ADMIN_LISTINGS_QUERY,
  serializeAdminListingsQuery,
} from "@/lib/admin/admin-listings-query";

type StatusOption = {
  value: string;
  label: string;
};

type Props = {
  initialQuery: AdminListingsQuery;
  statusOptions: StatusOption[];
  pageSizeOptions?: number[];
  basePath?: string;
};

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function AdminListingsFiltersClient({
  initialQuery,
  statusOptions,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  basePath = "/admin/listings",
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<AdminListingsQuery>(initialQuery);

  useEffect(() => {
    setDraft(initialQuery);
  }, [initialQuery]);

  const toggleStatus = (value: string) => {
    setDraft((prev) => {
      const next = prev.statuses.includes(value)
        ? prev.statuses.filter((status) => status !== value)
        : [...prev.statuses, value];
      return { ...prev, statuses: next };
    });
  };

  const handleApply = () => {
    const nextQuery: AdminListingsQuery = { ...draft, page: 1 };
    const params = serializeAdminListingsQuery(nextQuery);
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  };

  const handleClear = () => {
    router.replace(basePath, { scroll: false });
  };

  const hasDraftFilters = useMemo(() => {
    return JSON.stringify({ ...draft, page: 1, pageSize: DEFAULT_ADMIN_LISTINGS_QUERY.pageSize }) !==
      JSON.stringify({ ...DEFAULT_ADMIN_LISTINGS_QUERY, page: 1, pageSize: DEFAULT_ADMIN_LISTINGS_QUERY.pageSize });
  }, [draft]);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Search</label>
          <input
            type="text"
            value={draft.q ?? ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
            placeholder="Search title or paste ID"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Search mode</label>
          <select
            value={draft.qMode}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                qMode: event.target.value as AdminListingsQuery["qMode"],
              }))
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="title">Title / location</option>
            <option value="id">Listing ID</option>
            <option value="owner">Owner ID</option>
          </select>
        </div>
        <fieldset className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <legend className="text-xs text-slate-600">Status (multi)</legend>
          <div className="flex flex-wrap gap-2 text-xs text-slate-700">
            {statusOptions.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={draft.statuses.includes(opt.value)}
                  onChange={() => toggleStatus(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Active</label>
          <select
            value={draft.active}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                active: event.target.value as AdminListingsQuery["active"],
              }))
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="all">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <div className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <label className="text-xs text-slate-600">Ops filters</label>
          <div className="flex flex-wrap gap-2 text-xs text-slate-700">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={draft.missingCover}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, missingCover: event.target.checked }))
                }
              />
              Missing cover
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={draft.missingPhotos}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, missingPhotos: event.target.checked }))
                }
              />
              Missing photos
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={draft.missingLocation}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, missingLocation: event.target.checked }))
                }
              />
              Missing location
            </label>
          </div>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Price min</label>
          <input
            type="number"
            step="1"
            value={draft.priceMin ?? ""}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                priceMin: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Price max</label>
          <input
            type="number"
            step="1"
            value={draft.priceMax ?? ""}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                priceMax: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Listing type</label>
          <input
            type="text"
            value={draft.listing_type ?? ""}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                listing_type: event.target.value === "" ? null : event.target.value,
              }))
            }
            placeholder="e.g. apartment"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Beds min</label>
          <input
            type="number"
            step="1"
            value={draft.bedroomsMin ?? ""}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                bedroomsMin: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Beds max</label>
          <input
            type="number"
            step="1"
            value={draft.bedroomsMax ?? ""}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                bedroomsMax: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Baths min</label>
          <input
            type="number"
            step="1"
            value={draft.bathroomsMin ?? ""}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                bathroomsMin: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Baths max</label>
          <input
            type="number"
            step="1"
            value={draft.bathroomsMax ?? ""}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                bathroomsMax: event.target.value === "" ? null : Number(event.target.value),
              }))
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Sort</label>
          <select
            value={draft.sort}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                sort: event.target.value as AdminListingsQuery["sort"],
              }))
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="updated_desc">Updated (newest)</option>
            <option value="updated_asc">Updated (oldest)</option>
            <option value="created_desc">Created (newest)</option>
            <option value="created_asc">Created (oldest)</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-600">Page size</label>
          <select
            value={draft.pageSize}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                pageSize: Number(event.target.value),
              }))
            }
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={handleApply}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white shadow-sm"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
            disabled={!hasDraftFilters}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
