"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

type ClientPageOption = {
  id: string;
  client_name: string | null;
  client_slug: string;
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
};

type Props = {
  clientPages: ClientPageOption[];
};

export default function AgentNetworkDiscoveryClient({ clientPages }: Props) {
  const [city, setCity] = useState("");
  const [intent, setIntent] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [listingType, setListingType] = useState("");
  const [excludeMine, setExcludeMine] = useState(true);
  const [results, setResults] = useState<NetworkListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<NetworkListing | null>(null);
  const [selectedPageId, setSelectedPageId] = useState(clientPages[0]?.id ?? "");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (intent) params.set("intent", intent);
    if (minPrice.trim()) params.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim());
    if (beds.trim()) params.set("beds", beds.trim());
    if (listingType.trim()) params.set("type", listingType.trim());
    params.set("excludeMine", excludeMine ? "true" : "false");
    return params.toString();
  };

  const fetchListings = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/agent/network/listings?${buildQuery()}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Unable to load listings.");
        setResults([]);
        return;
      }
      setResults((data?.listings as NetworkListing[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load listings.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = (listing: NetworkListing) => {
    setSelectedListing(listing);
    setSelectedPageId(clientPages[0]?.id ?? "");
    setModalOpen(true);
  };

  const handleAdd = async () => {
    if (!selectedListing || !selectedPageId) return;
    const response = await fetch(
      `/api/agent/client-pages/${selectedPageId}/external-listings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: selectedListing.id }),
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setToast(data?.error || "Unable to add listing.");
      return;
    }
    setToast("Listing added to client page.");
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
          <Alert
            title="Update"
            description={toast}
            variant="success"
            onClose={() => setToast(null)}
            className="pointer-events-auto"
          />
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Agent Network</h1>
            <p className="mt-1 text-sm text-slate-600">
              Discover live listings shared by other agents and add them to client pages.
            </p>
          </div>
          <Button type="button" onClick={fetchListings}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" />
          <select
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Any intent</option>
            <option value="rent">Rent / Lease</option>
            <option value="buy">For Sale</option>
          </select>
          <Input
            value={listingType}
            onChange={(event) => setListingType(event.target.value)}
            placeholder="Property type"
          />
          <Input
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            placeholder="Min price"
          />
          <Input
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder="Max price"
          />
          <Input value={beds} onChange={(event) => setBeds(event.target.value)} placeholder="Beds" />
        </div>

        <label className="mt-4 flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={excludeMine}
            onChange={(event) => setExcludeMine(event.target.checked)}
          />
          Exclude my listings
        </label>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {results.map((listing) => (
          <div
            key={listing.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-900">{listing.title}</p>
            <p className="text-xs text-slate-500">
              {listing.city || "Location"}
              {listing.owner_display_name ? ` · Listed by ${listing.owner_display_name}` : ""}
            </p>
            {typeof listing.price === "number" && listing.currency && (
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {listing.currency} {listing.price.toLocaleString()}
              </p>
            )}
            <div className="mt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openAddModal(listing)}
                disabled={clientPages.length === 0}
              >
                Add to client page
              </Button>
            </div>
          </div>
        ))}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Add listing to client page</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose a client page for {selectedListing?.title ?? "this listing"}.
            </p>
            <select
              value={selectedPageId}
              onChange={(event) => setSelectedPageId(event.target.value)}
              className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {clientPages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.client_name || page.client_slug}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!selectedPageId}>
                Add listing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
