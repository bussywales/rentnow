"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/components/ui/cn";
import {
  normalizeClientPageCriteria,
  serializeClientPageCriteria,
  type ClientPageCriteria,
} from "@/lib/agents/client-pages";

type ClientPageRow = {
  id: string;
  client_name: string;
  client_slug: string;
  client_brief?: string | null;
  title?: string | null;
  criteria?: ClientPageCriteria | null;
  pinned_property_ids?: string[] | null;
  published: boolean;
  updated_at?: string | null;
};

type LiveProperty = {
  id: string;
  title: string;
  city?: string | null;
  price?: number | null;
  currency?: string | null;
};

type Props = {
  initialPages: ClientPageRow[];
  agentSlug: string;
  siteUrl: string;
  liveProperties: LiveProperty[];
};

const INTENT_OPTIONS = [
  { value: "", label: "Any intent" },
  { value: "rent", label: "Rent / Lease" },
  { value: "buy", label: "For Sale" },
] as const;

export default function AgentClientPagesClient({
  initialPages,
  agentSlug,
  siteUrl,
  liveProperties,
}: Props) {
  const [pages, setPages] = useState<ClientPageRow[]>(initialPages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );

  const [clientName, setClientName] = useState("");
  const [clientBrief, setClientBrief] = useState("");
  const [title, setTitle] = useState("");
  const [intent, setIntent] = useState<ClientPageCriteria["intent"]>(null);
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [pinnedMode, setPinnedMode] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const resetForm = () => {
    setEditingId(null);
    setClientName("");
    setClientBrief("");
    setTitle("");
    setIntent(null);
    setCity("");
    setMinPrice("");
    setMaxPrice("");
    setBedrooms("");
    setPinnedMode(false);
    setPinnedIds([]);
    setPublished(true);
    setError(null);
  };

  const criteriaPayload = useMemo(() => {
    const parsed = normalizeClientPageCriteria({
      intent: intent ?? null,
      city,
      minPrice,
      maxPrice,
      bedrooms,
    });
    return serializeClientPageCriteria(parsed);
  }, [intent, city, minPrice, maxPrice, bedrooms]);

  const clientLink = (slug: string) =>
    `${siteUrl}/agents/${agentSlug}/c/${slug}`;

  const handleCopy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(clientLink(slug));
      setToast({ message: "Link copied to clipboard.", variant: "success" });
    } catch {
      setToast({ message: "Unable to copy link.", variant: "error" });
    }
  };

  const handleEdit = (page: ClientPageRow) => {
    setEditingId(page.id);
    setClientName(page.client_name);
    setClientBrief(page.client_brief ?? "");
    setTitle(page.title ?? "");
    const parsed = normalizeClientPageCriteria(page.criteria ?? {});
    setIntent(parsed.intent);
    setCity(parsed.city ?? "");
    setMinPrice(parsed.minPrice !== null ? String(parsed.minPrice) : "");
    setMaxPrice(parsed.maxPrice !== null ? String(parsed.maxPrice) : "");
    setBedrooms(parsed.bedrooms !== null ? String(parsed.bedrooms) : "");
    const nextPinned = page.pinned_property_ids ?? [];
    setPinnedIds(nextPinned);
    setPinnedMode(nextPinned.length > 0);
    setPublished(page.published);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const payload = {
      client_name: clientName.trim(),
      client_brief: clientBrief.trim() || null,
      title: title.trim() || null,
      criteria: criteriaPayload,
      pinned_property_ids: pinnedMode ? pinnedIds : [],
      published,
    };

    try {
      const response = await fetch(
        editingId ? `/api/agent/client-pages/${editingId}` : "/api/agent/client-pages",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Unable to save client page.");
        return;
      }

      if (editingId) {
        setPages((prev) =>
          prev.map((page) =>
            page.id === editingId
              ? { ...page, ...data.page }
              : page
          )
        );
        setToast({ message: "Client page updated.", variant: "success" });
      } else {
        setPages((prev) => [data.page, ...prev]);
        setToast({ message: "Client page created.", variant: "success" });
      }

      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save client page.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (page: ClientPageRow) => {
    if (!confirm(`Delete ${page.client_name}?`)) return;
    try {
      const response = await fetch(`/api/agent/client-pages/${page.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to delete client page.");
      }
      setPages((prev) => prev.filter((item) => item.id !== page.id));
      setToast({ message: "Client page deleted.", variant: "success" });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Unable to delete client page.",
        variant: "error",
      });
    }
  };

  const togglePublished = async (page: ClientPageRow, value: boolean) => {
    try {
      const response = await fetch(`/api/agent/client-pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: value }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to update status.");
      }
      setPages((prev) =>
        prev.map((row) => (row.id === page.id ? { ...row, published: value } : row))
      );
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Unable to update status.",
        variant: "error",
      });
    }
  };

  const sortedProperties = useMemo(() => {
    return [...liveProperties].sort((a, b) => a.title.localeCompare(b.title));
  }, [liveProperties]);

  return (
    <div className="space-y-8">
      {toast && (
        <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
          <Alert
            title={toast.variant === "success" ? "Done" : "Heads up"}
            description={toast.message}
            variant={toast.variant}
            onClose={() => setToast(null)}
            className="pointer-events-auto"
          />
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Client pages
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Create a client shortlist
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Share tailored listings with each client using a private link.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={resetForm}>
              Reset
            </Button>
          </div>
        </div>

        {!agentSlug && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Add your agent storefront slug in Profile before creating client pages.
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Client name
            </label>
            <Input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder="e.g. The Johnson family"
              data-testid="client-page-name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Headline (optional)
            </label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Homes picked for your next move"
              data-testid="client-page-title"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Client brief (optional)
            </label>
            <Textarea
              value={clientBrief}
              onChange={(event) => setClientBrief(event.target.value)}
              rows={3}
              placeholder="Short notes about budget, lifestyle, or preferred neighbourhoods."
              data-testid="client-page-brief"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Intent
            </label>
            <select
              value={intent ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setIntent(value === "rent" || value === "buy" ? value : null);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              data-testid="client-page-intent"
            >
              {INTENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              City
            </label>
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Any"
              data-testid="client-page-city"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Min price
            </label>
            <Input
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="0"
              data-testid="client-page-min-price"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Max price
            </label>
            <Input
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="Any"
              data-testid="client-page-max-price"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Bedrooms (min)
            </label>
            <Input
              value={bedrooms}
              onChange={(event) => setBedrooms(event.target.value)}
              placeholder="Any"
              data-testid="client-page-bedrooms"
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={pinnedMode}
              onChange={(event) => setPinnedMode(event.target.checked)}
            />
            Use pinned shortlist instead of filters
          </label>
          {pinnedMode && (
            <div className="mt-4 space-y-2">
              {sortedProperties.length === 0 && (
                <p className="text-sm text-slate-500">No live listings available to pin.</p>
              )}
              {sortedProperties.map((property) => (
                <label
                  key={property.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700",
                    pinnedIds.includes(property.id) && "border-sky-500 bg-sky-50"
                  )}
                >
                  <span>
                    {property.title}
                    {property.city ? ` · ${property.city}` : ""}
                  </span>
                  <input
                    type="checkbox"
                    checked={pinnedIds.includes(property.id)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setPinnedIds((prev) => [...prev, property.id]);
                      } else {
                        setPinnedIds((prev) => prev.filter((id) => id !== property.id));
                      }
                    }}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
            />
            Published
          </label>
          <div className="flex items-center gap-2">
            {editingId && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel edit
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSave}
              disabled={!agentSlug || saving || clientName.trim().length < 2}
              data-testid="client-page-save"
            >
              {saving ? "Saving..." : editingId ? "Save changes" : "Create client page"}
            </Button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Your client pages</h3>
        {pages.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            You don’t have any client pages yet. Create one to share a shortlist.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {pages.map((page) => (
              <div
                key={page.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                data-testid="client-page-row"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{page.client_name}</p>
                  <p className="text-xs text-slate-500" data-testid="client-page-slug">
                    /{page.client_slug}
                  </p>
                  {page.updated_at && (
                    <p className="text-xs text-slate-400">
                      Updated {new Date(page.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={page.published}
                      onChange={(event) => togglePublished(page, event.target.checked)}
                    />
                    Published
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleCopy(page.client_slug)}
                    data-testid={`client-page-copy-${page.id}`}
                  >
                    Copy link
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleEdit(page)}
                    data-testid={`client-page-edit-${page.id}`}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleDelete(page)}
                    data-testid={`client-page-delete-${page.id}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
