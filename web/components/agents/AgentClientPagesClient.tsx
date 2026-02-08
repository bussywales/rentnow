"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type ExternalListingMeta = {
  listing_id: string;
  owner_name: string | null;
  title?: string | null;
  city?: string | null;
  price?: number | null;
  currency?: string | null;
  status?: string | null;
};

type CuratedListingState = {
  id: string;
  pinned: boolean;
  rank: number;
  external?: boolean;
  ownerName?: string | null;
  meta?: ExternalListingMeta | null;
};

type NetworkListing = {
  id: string;
  title: string;
  city?: string | null;
  price?: number | null;
  currency?: string | null;
  bedrooms?: number | null;
  listing_intent?: string | null;
  listing_type?: string | null;
  owner_display_name?: string | null;
  cover_image_url?: string | null;
  images?: { image_url: string }[] | null;
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
  external_listings?: ExternalListingMeta[] | null;
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
  agentNetworkEnabled: boolean;
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
  agentNetworkEnabled,
  agentProfile,
}: Props) {
  const router = useRouter();
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
  const [curatedListings, setCuratedListings] = useState<CuratedListingState[]>([]);
  const [curatedSnapshot, setCuratedSnapshot] = useState<string>("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [networkListings, setNetworkListings] = useState<NetworkListing[]>([]);
  const [networkCity, setNetworkCity] = useState("");
  const [networkIntent, setNetworkIntent] = useState<ClientPageCriteria["intent"]>(null);
  const [networkMinPrice, setNetworkMinPrice] = useState("");
  const [networkMaxPrice, setNetworkMaxPrice] = useState("");
  const [networkBeds, setNetworkBeds] = useState("");
  const [networkType, setNetworkType] = useState("");
  const [excludeMine, setExcludeMine] = useState(true);

  const handleViewInbox = (pageId: string) => {
    router.push(`/profile/clients/${pageId}/inbox`);
  };

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
    setNetworkOpen(false);
    setNetworkListings([]);
    setNetworkError(null);
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
    const externalMap = new Map(
      (page.external_listings ?? []).map((row) => [row.listing_id, row])
    );
    const curated = (page.curated_listings ?? []).map((row) => {
      const externalMeta = externalMap.get(row.property_id) ?? null;
      return {
        id: row.property_id,
        pinned: row.pinned ?? false,
        rank: row.rank ?? 0,
        external: !!externalMeta,
        ownerName: externalMeta?.owner_name ?? null,
        meta: externalMeta,
      };
    });
    if (curated.length > 0) {
      return orderCuratedListings(curated);
    }
    const fallback = (page.pinned_property_ids ?? []).map((id, index) => ({
      id,
      pinned: true,
      rank: index,
      external: false,
    }));
    return fallback;
  };

  const buildCuratedSnapshot = (items: CuratedListingState[]) =>
    JSON.stringify(
      items.map((item) => ({
        id: item.id,
        external: !!item.external,
      }))
    );

  const parseCuratedSnapshot = (snapshot: string) => {
    try {
      const parsed = JSON.parse(snapshot) as { id?: string; external?: boolean }[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => typeof item.id === "string") as {
        id: string;
        external: boolean;
      }[];
    } catch {
      return [];
    }
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
    const withRanks = curated.map((item, index) => ({ ...item, rank: index }));
    setCuratedListings(withRanks);
    setCuratedSnapshot(buildCuratedSnapshot(withRanks));
    setSelectedPropertyId("");
    setError(null);
  };

  const updateCurated = (next: CuratedListingState[]) => {
    setCuratedListings(next.map((item, index) => ({ ...item, rank: index })));
  };

  const handleAddCurated = () => {
    if (!selectedPropertyId) return;
    if (curatedListings.some((item) => item.id === selectedPropertyId)) return;
    const next = [
      ...curatedListings,
      { id: selectedPropertyId, pinned: false, rank: curatedListings.length, external: false },
    ];
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
      external: !!item.external,
    }));
    const desiredIds = new Set(desired.map((item) => item.id));
    const previousEntries = curatedSnapshot ? parseCuratedSnapshot(curatedSnapshot) : [];
    const removed = previousEntries.filter((entry) => !desiredIds.has(entry.id));

    await Promise.all(
      removed.map((entry) => {
        const endpoint = entry.external
          ? `/api/agent/client-pages/${pageId}/external-listings/${entry.id}`
          : `/api/agent/client-pages/${pageId}/listings/${entry.id}`;
        return fetch(endpoint, { method: "DELETE" });
      })
    );

    await Promise.all(
      desired.map((item) => {
        const endpoint = item.external
          ? `/api/agent/client-pages/${pageId}/external-listings`
          : `/api/agent/client-pages/${pageId}/listings`;
        return fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: item.id,
            propertyId: item.id,
            pinned: item.pinned,
            rank: item.rank,
          }),
        });
      })
    );

    setCuratedSnapshot(buildCuratedSnapshot(curatedListings));
  };

  const buildNetworkQuery = () => {
    const params = new URLSearchParams();
    if (networkCity.trim()) params.set("city", networkCity.trim());
    if (networkIntent) params.set("intent", networkIntent);
    if (networkMinPrice.trim()) params.set("minPrice", networkMinPrice.trim());
    if (networkMaxPrice.trim()) params.set("maxPrice", networkMaxPrice.trim());
    if (networkBeds.trim()) params.set("beds", networkBeds.trim());
    if (networkType.trim()) params.set("type", networkType.trim());
    params.set("excludeMine", excludeMine ? "true" : "false");
    return params.toString();
  };

  const fetchNetworkListings = async () => {
    setNetworkError(null);
    setNetworkLoading(true);
    try {
      const query = buildNetworkQuery();
      const response = await fetch(`/api/agent/network/listings?${query}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setNetworkError(data?.error || "Unable to fetch network listings.");
        setNetworkListings([]);
        return;
      }
      setNetworkListings((data?.listings as NetworkListing[]) || []);
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : "Unable to fetch network listings.");
    } finally {
      setNetworkLoading(false);
    }
  };

  const handleAddExternalListing = (listing: NetworkListing) => {
    if (!editingId) {
      setToast({ message: "Save the client page before adding external listings.", variant: "error" });
      return;
    }
    if (curatedListings.some((item) => item.id === listing.id)) {
      setToast({ message: "Listing already added to this page.", variant: "error" });
      return;
    }
    const next: CuratedListingState[] = [
      ...curatedListings,
      {
        id: listing.id,
        pinned: false,
        rank: curatedListings.length,
        external: true,
        ownerName: listing.owner_display_name ?? null,
        meta: {
          listing_id: listing.id,
          owner_name: listing.owner_display_name ?? null,
          title: listing.title,
          city: listing.city ?? null,
          price: listing.price ?? null,
          currency: listing.currency ?? null,
          status: "live",
        },
      },
    ];
    updateCurated(next);
    setToast({ message: "External listing added. Save to publish.", variant: "success" });
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

      const selectedSnapshot = buildCuratedSnapshot(curatedListings);
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
        external_listings: curatedListings
          .filter((item) => item.external)
          .map((item) => ({
            listing_id: item.id,
            owner_name: item.ownerName ?? item.meta?.owner_name ?? null,
            title: item.meta?.title ?? null,
            city: item.meta?.city ?? null,
            price: item.meta?.price ?? null,
            currency: item.meta?.currency ?? null,
            status: item.meta?.status ?? null,
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
            const externalMeta = item.meta;
            const listingTitle = property?.title || externalMeta?.title || "Listing";
            const listingCity = property?.city || externalMeta?.city || null;
            const listingStatus = property ? "live" : externalMeta?.status || null;
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
                data-testid="client-page-curated-item"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {listingTitle}
                  </p>
                  {listingCity && <p className="text-xs text-slate-500">{listingCity}</p>}
                  {item.external && (
                    <p className="text-xs font-semibold text-slate-500">
                      External · Listed by {item.ownerName || "another agent"}
                    </p>
                  )}
                  {listingStatus && listingStatus !== "live" && (
                    <p className="text-xs text-amber-600">
                      No longer available. Remove or replace this listing.
                    </p>
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

      {agentNetworkEnabled && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Add external listings</p>
              <p className="text-xs text-slate-500">
                Browse live listings from other agents and add them to this client page.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const next = !networkOpen;
                setNetworkOpen(next);
                if (next) {
                  fetchNetworkListings();
                }
              }}
            >
              {networkOpen ? "Hide search" : "Search network"}
            </Button>
          </div>

          {!editingId && (
            <p className="mt-3 text-xs text-slate-500">
              Save this client page before adding external listings.
            </p>
          )}

          {networkOpen && editingId && (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  value={networkCity}
                  onChange={(event) => setNetworkCity(event.target.value)}
                  placeholder="City"
                />
                <select
                  value={networkIntent ?? ""}
                  onChange={(event) =>
                    setNetworkIntent(
                      event.target.value === "rent" || event.target.value === "buy"
                        ? event.target.value
                        : null
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {INTENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={networkType}
                  onChange={(event) => setNetworkType(event.target.value)}
                  placeholder="Property type"
                />
                <Input
                  value={networkMinPrice}
                  onChange={(event) => setNetworkMinPrice(event.target.value)}
                  placeholder="Min price"
                />
                <Input
                  value={networkMaxPrice}
                  onChange={(event) => setNetworkMaxPrice(event.target.value)}
                  placeholder="Max price"
                />
                <Input
                  value={networkBeds}
                  onChange={(event) => setNetworkBeds(event.target.value)}
                  placeholder="Beds (min)"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={excludeMine}
                  onChange={(event) => setExcludeMine(event.target.checked)}
                />
                Exclude my listings
              </label>

              <div className="flex items-center gap-2">
                <Button type="button" variant="primary" onClick={fetchNetworkListings}>
                  {networkLoading ? "Searching..." : "Search"}
                </Button>
                {networkError && <span className="text-xs text-rose-600">{networkError}</span>}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {networkListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">{listing.title}</p>
                    <p className="text-xs text-slate-500">
                      {(listing.city || "Location") +
                        (listing.owner_display_name
                          ? ` · Listed by ${listing.owner_display_name}`
                          : "")}
                    </p>
                    {typeof listing.price === "number" && listing.currency && (
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {listing.currency} {listing.price.toLocaleString()}
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => handleAddExternalListing(listing)}
                    >
                      Add to this page
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                      onClick={() => handleViewInbox(page.id)}
                      data-testid={`client-page-inbox-${page.id}`}
                    >
                      View enquiries
                    </Button>
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
