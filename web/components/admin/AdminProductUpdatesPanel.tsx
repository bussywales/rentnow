"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  PRODUCT_UPDATE_AUDIENCE_LABELS,
  PRODUCT_UPDATE_AUDIENCES,
  type ProductUpdateAudience,
} from "@/lib/product-updates/constants";

export type AdminProductUpdateRow = {
  id: string;
  title: string;
  summary: string;
  image_url?: string | null;
  body?: string | null;
  audience: ProductUpdateAudience;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
};

type Props = {
  initialUpdates: AdminProductUpdateRow[];
  initialStatus?: string | null;
  initialAudience?: ProductUpdateAudience | "all" | null;
};

type EditorMode = "create" | "edit";

type EditorState = {
  mode: EditorMode;
  target?: AdminProductUpdateRow | null;
};

const statusOptions = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "published", label: "Published" },
] as const;

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function statusBadge(published_at?: string | null) {
  if (published_at) return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-700";
}

function statusLabel(published_at?: string | null) {
  return published_at ? "Published" : "Draft";
}

function normalizeSummary(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 240) return trimmed;
  return `${trimmed.slice(0, 240)}…`;
}

function AdminProductUpdateEditor({
  state,
  onCancel,
  onSaved,
}: {
  state: EditorState;
  onCancel: () => void;
  onSaved: (update: AdminProductUpdateRow) => void;
}) {
  const [title, setTitle] = useState(state.target?.title ?? "");
  const [summary, setSummary] = useState(state.target?.summary ?? "");
  const [audience, setAudience] = useState<ProductUpdateAudience>(
    state.target?.audience ?? "all"
  );
  const [imageUrl, setImageUrl] = useState(state.target?.image_url ?? "");
  const [body, setBody] = useState(state.target?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = state.mode === "edit";

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    const payload = new FormData();
    payload.append("file", file);

    try {
      const res = await fetch("/api/admin/product-updates/upload", {
        method: "POST",
        body: payload,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to upload image");
        return;
      }
      if (data?.imageUrl) {
        setImageUrl(data.imageUrl as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      title,
      summary,
      audience,
      image_url: imageUrl || null,
      body: body || null,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/admin/product-updates/${state.target?.id}` : "/api/admin/product-updates",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to save update");
        return;
      }
      onSaved(data.update as AdminProductUpdateRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {isEdit ? "Edit update" : "New update"}
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? "Update details" : "Create a product update"}
          </h2>
          <p className="text-sm text-slate-600">
            Keep this short: what changed + where to find it.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Close
        </Button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="update-title">
            Title
          </label>
          <Input
            id="update-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="New booking calendar view"
            data-testid="admin-update-title"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="update-audience">
            Audience
          </label>
          <Select
            id="update-audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value as ProductUpdateAudience)}
            data-testid="admin-update-audience"
          >
            {PRODUCT_UPDATE_AUDIENCES.map((value) => (
              <option key={value} value={value}>
                {PRODUCT_UPDATE_AUDIENCE_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:col-span-2 space-y-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="update-summary">
            Summary
          </label>
          <Textarea
            id="update-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="We improved the booking calendar so you can track viewings faster."
            data-testid="admin-update-summary"
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="update-image">
            Screenshot (optional)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="update-image"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://..."
            />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm"
              data-testid="admin-update-image-input"
            />
          </div>
          {uploading && (
            <p className="text-xs text-slate-500">Uploading screenshot…</p>
          )}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Update preview"
              className="mt-2 h-32 rounded-xl border border-slate-200 object-cover"
              data-testid="admin-update-image-preview"
            />
          )}
        </div>
        <div className="md:col-span-2 space-y-2">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="update-body">
            Body (optional)
          </label>
          <Textarea
            id="update-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="More details for internal use."
          />
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          data-testid={isEdit ? "admin-update-save" : "admin-update-create"}
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create draft"}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function AdminProductUpdatesPanel({
  initialUpdates,
  initialStatus,
  initialAudience,
}: Props) {
  const [updates, setUpdates] = useState<AdminProductUpdateRow[]>(initialUpdates);
  const [statusFilter, setStatusFilter] = useState(initialStatus ?? "all");
  const [audienceFilter, setAudienceFilter] = useState<ProductUpdateAudience | "all">
    (initialAudience ?? "all");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(
    () => ({
      total: updates.length,
      draft: updates.filter((update) => !update.published_at).length,
      published: updates.filter((update) => update.published_at).length,
    }),
    [updates]
  );

  const fetchUpdates = async (status = statusFilter, audience = audienceFilter) => {
    setError(null);
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (audience && audience !== "all") params.set("audience", audience);
    const res = await fetch(`/api/admin/product-updates?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Unable to refresh updates");
      return;
    }
    setUpdates((data?.updates || []) as AdminProductUpdateRow[]);
  };

  const publishUpdate = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/product-updates/${id}/publish`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to publish update");
        return;
      }
      setUpdates((prev) => prev.map((row) => (row.id === id ? data.update : row)));
    });
  };

  const unpublishUpdate = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/product-updates/${id}/unpublish`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to unpublish update");
        return;
      }
      setUpdates((prev) => prev.map((row) => (row.id === id ? data.update : row)));
    });
  };

  const deleteUpdate = (id: string) => {
    if (!confirm("Delete this update? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/product-updates/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to delete update");
        return;
      }
      setUpdates((prev) => prev.filter((row) => row.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Product updates</h1>
          <p className="text-sm text-slate-600">
            Publish quick, human updates for tenants, hosts, and admins.
          </p>
        </div>
        <Button onClick={() => setEditor({ mode: "create" })}>New update</Button>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total</p>
          <p className="text-lg font-semibold text-slate-900">{counts.total}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Drafts</p>
          <p className="text-lg font-semibold text-slate-900">{counts.draft}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Published</p>
          <p className="text-lg font-semibold text-slate-900">{counts.published}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Filters</p>
            <p className="text-sm text-slate-600">Narrow down the update feed.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchUpdates()}
            disabled={pending}
          >
            {pending ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="update-status">
              Status
            </label>
            <Select
              id="update-status"
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value;
                setStatusFilter(value);
                void fetchUpdates(value, audienceFilter);
              }}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-slate-400" htmlFor="update-audience-filter">
              Audience
            </label>
            <Select
              id="update-audience-filter"
              value={audienceFilter}
              onChange={(event) => {
                const value = event.target.value as ProductUpdateAudience | "all";
                setAudienceFilter(value);
                void fetchUpdates(statusFilter, value);
              }}
            >
              <option value="all">All audiences</option>
              {PRODUCT_UPDATE_AUDIENCES.map((value) => (
                <option key={value} value={value}>
                  {PRODUCT_UPDATE_AUDIENCE_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {editor && (
        <AdminProductUpdateEditor
          state={editor}
          onCancel={() => setEditor(null)}
          onSaved={(update) => {
            setEditor(null);
            setUpdates((prev) => {
              const existing = prev.findIndex((row) => row.id === update.id);
              if (existing >= 0) {
                const next = [...prev];
                next[existing] = update;
                return next;
              }
              return [update, ...prev];
            });
          }}
        />
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {updates.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                  No product updates yet.
                </td>
              </tr>
            )}
            {updates.map((update) => (
              <tr key={update.id} className="border-t border-slate-100" data-testid="admin-update-row">
                <td className="px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{update.title}</div>
                  <div className="text-xs text-slate-500">{normalizeSummary(update.summary)}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {PRODUCT_UPDATE_AUDIENCE_LABELS[update.audience]}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(update.published_at)}`}>
                    {statusLabel(update.published_at)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(update.updated_at)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(update.published_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-sky-700 hover:underline"
                      onClick={() => setEditor({ mode: "edit", target: update })}
                    >
                      Edit
                    </button>
                    {!update.published_at && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => publishUpdate(update.id)}
                        disabled={pending}
                        data-testid="admin-update-publish"
                      >
                        Publish
                      </Button>
                    )}
                    {update.published_at && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => unpublishUpdate(update.id)}
                        disabled={pending}
                      >
                        Unpublish
                      </Button>
                    )}
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-600 hover:underline"
                      onClick={() => deleteUpdate(update.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
