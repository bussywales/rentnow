"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/components/ui/cn";
import { formatRelativeTime } from "@/lib/date/relative-time";
import {
  normalizeClientPageCriteria,
  serializeClientPageCriteria,
  orderCuratedListings,
  type ClientPageCriteria,
} from "@/lib/agents/client-pages";

type CuratedListing = {
  property_id: string;
  rank?: number | null;
  pinned?: boolean | null;
};

type ClientPageRow = {
  id: string;
  client_name: string | null;
  client_slug: string;
  client_brief?: string | null;
  client_requirements?: string | null;
  title?: string | null;
  agent_about?: string | null;
  agent_company_name?: string | null;
  agent_logo_url?: string | null;
  banner_url?: string | null;
  notes_md?: string | null;
  criteria?: ClientPageCriteria | null;
  pinned_property_ids?: string[] | null;
  curated_listings?: CuratedListing[] | null;
  published: boolean;
  published_at?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
};

type LiveProperty = {
  id: string;
  title: string;
  city?: string | null;
  price?: number | null;
  currency?: string | null;
};

type AgentProfile = {
  display_name?: string | null;
  business_name?: string | null;
  avatar_url?: string | null;
  agent_bio?: string | null;
};

type Props = {
  initialPages: ClientPageRow[];
  agentSlug: string;
  siteUrl: string;
  liveProperties: LiveProperty[];
  agentProfile?: AgentProfile | null;
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
  agentProfile,
}: Props) {
  const [pages, setPages] = useState<ClientPageRow[]>(initialPages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );

  const [clientName, setClientName] = useState("");
  const [clientBrief, setClientBrief] = useState("");
  const [clientRequirements, setClientRequirements] = useState("");
  const [title, setTitle] = useState("");
  const [agentAbout, setAgentAbout] = useState("");
  const [agentCompanyName, setAgentCompanyName] = useState("");
  const [notes, setNotes] = useState("");
  const [intent, setIntent] = useState<ClientPageCriteria["intent"]>(null);
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [published, setPublished] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [curatedListings, setCuratedListings] = useState<
    { id: string; pinned: boolean; rank: number }[]
  >([]);
  const [curatedSnapshot, setCuratedSnapshot] = useState<string>("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const defaultCompanyName = agentProfile?.business_name || agentProfile?.display_name || "";
  const defaultAgentAbout = agentProfile?.agent_bio || "";

  const resetForm = () => {
    setEditingId(null);
    setClientName("");
    setClientBrief("");
    setClientRequirements("");
    setTitle("");
    setAgentAbout(defaultAgentAbout);
    setAgentCompanyName(defaultCompanyName);
    setNotes("");
    setIntent(null);
    setCity("");
    setMinPrice("");
    setMaxPrice("");
    setBedrooms("");
    setPublished(false);
    setExpiresAt("");
    setBannerUrl(null);
    setLogoUrl(null);
    setBannerFile(null);
    setLogoFile(null);
    setCuratedListings([]);
    setCuratedSnapshot("");
    setSelectedPropertyId("");
    setError(null);
  };

  useEffect(() => {
    if (!editingId) {
      setAgentAbout(defaultAgentAbout);
      setAgentCompanyName(defaultCompanyName);
    }
  }, [editingId, defaultAgentAbout, defaultCompanyName]);

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

  const clientLink = (slug: string) => `${siteUrl}/agents/${agentSlug}/c/${slug}`;

  const handleCopy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(clientLink(slug));
      setToast({ message: "Link copied to clipboard.", variant: "success" });
    } catch {
      setToast({ message: "Unable to copy link.", variant: "error" });
    }
  };

  const resolveCuratedFromPage = (page: ClientPageRow) => {
    const curated = (page.curated_listings ?? []).map((row) => ({
      id: row.property_id,
      pinned: row.pinned ?? false,
      rank: row.rank ?? 0,
    }));
    if (curated.length > 0) {
      return orderCuratedListings(curated);
    }
    const fallback = (page.pinned_property_ids ?? []).map((id, index) => ({
      id,
      pinned: true,
      rank: index,
    }));
    return fallback;
  };

  const handleEdit = (page: ClientPageRow) => {
    setEditingId(page.id);
    setClientName(page.client_name ?? "");
    setClientBrief(page.client_brief ?? "");
    setClientRequirements(page.client_requirements ?? "");
    setTitle(page.title ?? "");
    setAgentAbout(page.agent_about ?? defaultAgentAbout);
    setAgentCompanyName(page.agent_company_name ?? defaultCompanyName);
    setNotes(page.notes_md ?? "");
    const parsed = normalizeClientPageCriteria(page.criteria ?? {});
    setIntent(parsed.intent);
    setCity(parsed.city ?? "");
    setMinPrice(parsed.minPrice !== null ? String(parsed.minPrice) : "");
    setMaxPrice(parsed.maxPrice !== null ? String(parsed.maxPrice) : "");
    setBedrooms(parsed.bedrooms !== null ? String(parsed.bedrooms) : "");
    setPublished(page.published);
    setExpiresAt(page.expires_at ? new Date(page.expires_at).toISOString().slice(0, 10) : "");
    setBannerUrl(page.banner_url ?? null);
    setLogoUrl(page.agent_logo_url ?? null);
    const curated = resolveCuratedFromPage(page);
    setCuratedListings(curated.map((item, index) => ({ ...item, rank: index })));
    setCuratedSnapshot(curated.map((item) => `${item.id}:${item.pinned ? 1 : 0}`).join("|"));
    setSelectedPropertyId("");
    setError(null);
  };

  const updateCurated = (next: { id: string; pinned: boolean; rank: number }[]) => {
    setCuratedListings(next.map((item, index) => ({ ...item, rank: index })));
  };

  const handleAddCurated = () => {
    if (!selectedPropertyId) return;
    if (curatedListings.some((item) => item.id === selectedPropertyId)) return;
    const next = [...curatedListings, { id: selectedPropertyId, pinned: false, rank: curatedListings.length }];
    updateCurated(next);
    setSelectedPropertyId("");
  };

  const handleRemoveCurated = (id: string) => {
    updateCurated(curatedListings.filter((item) => item.id !== id));
  };

  const handleMoveCurated = (id: string, direction: -1 | 1) => {
    const index = curatedListings.findIndex((item) => item.id === id);
    if (index === -1) return;
    const next = [...curatedListings];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    updateCurated(next);
  };

  const handleTogglePinned = (id: string) => {
    updateCurated(
      curatedListings.map((item) =>
        item.id === id ? { ...item, pinned: !item.pinned } : item
      )
    );
  };

  const syncCuratedListings = async (pageId: string) => {
    const desired = curatedListings.map((item, index) => ({
      id: item.id,
      pinned: item.pinned,
      rank: index,
    }));
    const desiredIds = new Set(desired.map((item) => item.id));
    const previousIds = curatedSnapshot ? curatedSnapshot.split("|").map((item) => item.split(":")[0]) : [];
    const removed = previousIds.filter((id) => !desiredIds.has(id));

    await Promise.all(
      removed.map((id) =>
        fetch(`/api/agent/client-pages/${pageId}/listings/${id}`, { method: "DELETE" })
      )
    );

    await Promise.all(
      desired.map((item) =>
        fetch(`/api/agent/client-pages/${pageId}/listings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId: item.id, pinned: item.pinned, rank: item.rank }),
        })
      )
    );

    setCuratedSnapshot(desired.map((item) => `${item.id}:${item.pinned ? 1 : 0}`).join("|"));
  };

  const uploadAsset = async (pageId: string, type: "banner" | "logo", file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/agent/client-pages/${pageId}/upload?type=${type}`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Unable to upload image.");
    }
    return data?.imageUrl as string | undefined;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const expiresIso = expiresAt ? new Date(expiresAt).toISOString() : null;

    const payload = {
      client_name: clientName.trim(),
      client_brief: clientBrief.trim() || null,
      client_requirements: clientRequirements.trim() || null,
      title: title.trim() || null,
      agent_about: agentAbout.trim() || null,
      agent_company_name: agentCompanyName.trim() || null,
      notes_md: notes.trim() || null,
      criteria: criteriaPayload,
      published,
      expires_at: expiresIso,
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

      const savedPage = data?.page as ClientPageRow | undefined;
      if (!savedPage?.id) {
        setError("Unable to save client page.");
        return;
      }

      const selectedSnapshot = curatedListings
        .map((item) => `${item.id}:${item.pinned ? 1 : 0}`)
        .join("|");
      const hasCuratedChanges = selectedSnapshot !== curatedSnapshot;

      if (hasCuratedChanges || curatedListings.length > 0) {
        await syncCuratedListings(savedPage.id);
      }

      let updatedBanner = bannerUrl;
      let updatedLogo = logoUrl;

      if (bannerFile) {
        const url = await uploadAsset(savedPage.id, "banner", bannerFile);
        if (url) updatedBanner = url;
      }
      if (logoFile) {
        const url = await uploadAsset(savedPage.id, "logo", logoFile);
        if (url) updatedLogo = url;
      }

      const mergedPage = {
        ...savedPage,
        banner_url: updatedBanner ?? savedPage.banner_url ?? null,
        agent_logo_url: updatedLogo ?? savedPage.agent_logo_url ?? null,
        curated_listings: curatedListings.map((item, index) => ({
          property_id: item.id,
          pinned: item.pinned,
          rank: index,
        })),
      } as ClientPageRow;

      if (editingId) {
        setPages((prev) => prev.map((page) => (page.id === editingId ? mergedPage : page)));
        setToast({ message: "Client page updated.", variant: "success" });
      } else {
        setPages((prev) => [mergedPage, ...prev]);
        setToast({ message: "Client page created.", variant: "success" });
      }

      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save client page.");
    } finally {
      setSaving(false);
      setBannerFile(null);
      setLogoFile(null);
    }
  };

  const handleDelete = async (page: ClientPageRow) => {
    const name = page.client_name || "this client page";
    if (!confirm(`Delete ${name}?`)) return;
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
      const endpoint = value
        ? `/api/agent/client-pages/${page.id}/publish`
        : `/api/agent/client-pages/${page.id}/unpublish`;
      const response = await fetch(endpoint, { method: "POST" });
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

  const availableProperties = useMemo(() => {
    const curatedIds = new Set(curatedListings.map((item) => item.id));
    return sortedProperties.filter((property) => !curatedIds.has(property.id));
  }, [sortedProperties, curatedListings]);

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
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Client requirements
            </label>
            <Textarea
              value={clientRequirements}
              onChange={(event) => setClientRequirements(event.target.value)}
              rows={3}
              placeholder="2-bed in Lekki, budget 2M NGN, prefers furnished."
              data-testid="client-page-requirements"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Client brief (optional)
            </label>
            <Textarea
              value={clientBrief}
              onChange={(event) => setClientBrief(event.target.value)}
              rows={3}
              placeholder="Short notes about lifestyle or preferred neighbourhoods."
              data-testid="client-page-brief"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Agent intro (optional)
            </label>
            <Textarea
              value={agentAbout}
              onChange={(event) => setAgentAbout(event.target.value)}
              rows={3}
              placeholder="Short intro about your experience or team."
              data-testid="client-page-agent-about"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Company name (optional)
            </label>
            <Input
              value={agentCompanyName}
              onChange={(event) => setAgentCompanyName(event.target.value)}
              placeholder="Your agency or team name"
              data-testid="client-page-company"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Banner image
            </label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setBannerFile(event.target.files?.[0] || null)}
              data-testid="client-page-banner"
            />
            {bannerUrl && (
              <p className="text-xs text-slate-500">Banner uploaded.</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Logo image
            </label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
              data-testid="client-page-logo"
            />
            {logoUrl && <p className="text-xs text-slate-500">Logo uploaded.</p>}
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
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Expiry date (optional)
            </label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              data-testid="client-page-expires"
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Curated shortlist</p>
              <p className="text-xs text-slate-500">
                Pin live listings in a custom order. If you leave this empty, criteria-based
                matches will be used.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedPropertyId}
                onChange={(event) => setSelectedPropertyId(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                data-testid="client-page-curated-select"
              >
                <option value="">Select a listing</option>
                {availableProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.title}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddCurated}
                data-testid="client-page-curated-add"
              >
                Add
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {curatedListings.length === 0 && (
              <p className="text-sm text-slate-500">No listings pinned yet.</p>
            )}
            {curatedListings.map((item, index) => {
              const property = liveProperties.find((entry) => entry.id === item.id);
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
                  data-testid="client-page-curated-item"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {property?.title || "Listing"}
                    </p>
                    {property?.city && (
                      <p className="text-xs text-slate-500">{property.city}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.pinned}
                        onChange={() => handleTogglePinned(item.id)}
                      />
                      Pinned
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleMoveCurated(item.id, -1)}
                      disabled={index === 0}
                    >
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleMoveCurated(item.id, 1)}
                      disabled={index === curatedListings.length - 1}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleRemoveCurated(item.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Additional notes (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Add extra notes to display on the client page."
              data-testid="client-page-notes"
            />
          </div>
          <div className="flex items-end justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={published}
                onChange={(event) => setPublished(event.target.checked)}
                data-testid="client-page-published"
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
            {pages.map((page) => {
              const expiry = page.expires_at ? formatRelativeTime(page.expires_at) : null;
              const displayName = page.client_name || "Client shortlist";
              return (
                <div
                  key={page.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
                  data-testid="client-page-row"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                    <p className="text-xs text-slate-500" data-testid="client-page-slug">
                      /{page.client_slug}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", page.published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                        {page.published ? "Published" : "Draft"}
                      </span>
                      {expiry && <span>Expires {expiry}</span>}
                      {page.updated_at && (
                        <span>Updated {new Date(page.updated_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleCopy(page.client_slug)}
                      data-testid={`client-page-copy-${page.id}`}
                    >
                      Share
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
                      onClick={() => togglePublished(page, !page.published)}
                      data-testid={`client-page-publish-${page.id}`}
                    >
                      {page.published ? "Unpublish" : "Publish"}
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
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
