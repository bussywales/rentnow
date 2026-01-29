"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SavedView = {
  id: string;
  name: string;
  route: string;
  query_json: Record<string, unknown>;
};

type Props = {
  route: string;
};

const buildQueryObject = (params: URLSearchParams) => {
  const obj: Record<string, string | string[]> = {};
  for (const [key, value] of params.entries()) {
    const existing = obj[key];
    if (existing === undefined) {
      obj[key] = value;
    } else if (Array.isArray(existing)) {
      obj[key] = [...existing, value];
    } else {
      obj[key] = [existing, value];
    }
  }
  return obj;
};

const buildQueryString = (query: Record<string, unknown>) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === null || item === undefined || item === "") return;
        params.append(key, String(item));
      });
      return;
    }
    const asString = String(value);
    if (!asString) return;
    params.set(key, asString);
  });
  return params.toString();
};

export default function AdminSavedViews({ route }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [views, setViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuery = useMemo(
    () => buildQueryObject(searchParams ?? new URLSearchParams()),
    [searchParams]
  );

  const fetchViews = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/saved-views?route=${encodeURIComponent(route)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to load saved views");
      }
      const json = await res.json();
      setViews(Array.isArray(json?.views) ? json.views : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load saved views");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViews().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  const applyView = (view: SavedView) => {
    const qs = buildQueryString(view.query_json || {});
    const target = qs ? `${route}?${qs}` : route;
    router.push(target, { scroll: false });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("View name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          route,
          query: currentQuery,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to save view");
      }
      const json = await res.json();
      setViews((prev) => [json.view, ...prev]);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save view");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedViewId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/saved-views/${selectedViewId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to delete view");
      }
      setViews((prev) => prev.filter((view) => view.id !== selectedViewId));
      setSelectedViewId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete view");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Saved views</label>
        <select
          value={selectedViewId}
          onChange={(event) => {
            const nextId = event.target.value;
            setSelectedViewId(nextId);
            const view = views.find((item) => item.id === nextId);
            if (view) applyView(view);
          }}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs shadow-sm"
        >
          <option value="">Select saved view</option>
          {views.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => router.push(pathname || route, { scroll: false })}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs shadow-sm"
        >
          Reset
        </button>
        {selectedViewId && (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded border border-rose-300 bg-white px-2.5 py-1 text-xs text-rose-700 shadow-sm"
          >
            Delete
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Save current view as…"
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs shadow-sm"
        />
        <button
          type="button"
          onClick={handleSave}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs shadow-sm"
        >
          Save view
        </button>
        {loading && <span className="text-xs text-slate-500">Saving…</span>}
      </div>
      {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}
    </div>
  );
}
