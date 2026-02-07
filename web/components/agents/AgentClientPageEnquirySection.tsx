"use client";

import { useMemo, useState } from "react";
import type { Property } from "@/lib/types";
import AgentClientPageListingsClient from "@/components/agents/AgentClientPageListingsClient";
import ClientPageEnquiryPanel from "@/components/agents/ClientPageEnquiryPanel";

type Props = {
  listings: Property[];
  clientPageId?: string | null;
  agentSlug: string;
  clientSlug: string;
};

export default function AgentClientPageEnquirySection({
  listings,
  clientPageId,
  agentSlug,
  clientSlug,
}: Props) {
  const [selectedListingId, setSelectedListingId] = useState("");

  const enquiryAnchor = "client-page-enquiry";

  const handleEnquire = (listingId: string) => {
    setSelectedListingId(listingId);
    const target = document.getElementById(enquiryAnchor);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const listingsCountLabel = useMemo(() => {
    if (listings.length === 1) return "1 curated listing";
    return `${listings.length} curated listings`;
  }, [listings.length]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),360px] lg:items-start">
      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Listings</h3>
          <p className="text-sm text-slate-600">
            Curated homes matched to this client’s shortlist.
          </p>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {listingsCountLabel}
          </p>
        </div>
        <AgentClientPageListingsClient
          listings={listings}
          contactHref={`#${enquiryAnchor}`}
          clientPageId={clientPageId}
          selectedListingId={selectedListingId}
          onEnquire={handleEnquire}
        />
      </section>

      <div className="lg:sticky lg:top-24">
        <ClientPageEnquiryPanel
          agentSlug={agentSlug}
          clientSlug={clientSlug}
          clientPageId={clientPageId}
          listings={listings}
          selectedListingId={selectedListingId}
          onSelectListing={setSelectedListingId}
          anchorId={enquiryAnchor}
        />
      </div>
    </div>
  );
}
