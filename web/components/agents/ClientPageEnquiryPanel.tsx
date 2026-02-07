"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/components/ui/cn";

type Props = {
  agentSlug: string;
  clientSlug: string;
  clientPageId?: string | null;
  listings: Property[];
  selectedListingId: string;
  onSelectListing: (listingId: string) => void;
  anchorId?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ClientPageEnquiryPanel({
  agentSlug,
  clientSlug,
  clientPageId,
  listings,
  selectedListingId,
  onSelectListing,
  anchorId = "client-page-enquiry",
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const listingOptions = useMemo(
    () =>
      listings.map((listing) => ({
        id: listing.id,
        label: `${listing.title} • ${listing.city || "Listing"}`,
      })),
    [listings]
  );

  const selectedListing = listingOptions.find((option) => option.id === selectedListingId);
  const validClientPageId =
    typeof clientPageId === "string" && uuidPattern.test(clientPageId) ? clientPageId : null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedListingId) {
      setError("Select a home from this shortlist to enquire.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Please include a short message (10+ characters).");
      return;
    }
    if (!consent) {
      setError("Please confirm you’ll keep communication in-app.");
      return;
    }

    // Honeypot: if filled, silently accept.
    if (company.trim()) {
      setSuccess("Thanks! Your enquiry is on its way.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/agents/${agentSlug}/c/${clientSlug}/enquire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedListingId,
          message: message.trim(),
          consent,
          source: "client_page",
          clientPageId: validClientPageId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        const redirect = encodeURIComponent(
          `${window.location.pathname}${window.location.search}#${anchorId}`
        );
        window.location.href = `/auth/login?reason=auth&redirect=${redirect}`;
        return;
      }
      if (!res.ok) {
        setError(data?.error || "Unable to send enquiry.");
        return;
      }

      const threadId = data?.thread_id as string | undefined;
      if (threadId) {
        router.push(`/dashboard/messages?thread=${threadId}`);
        return;
      }
      setSuccess("Enquiry sent. Check your messages for updates.");
      setMessage("");
      setConsent(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send enquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id={anchorId}
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      data-testid="client-page-enquiry-panel"
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
          Client enquiry
        </p>
        <h2 className="text-xl font-semibold text-slate-900">Enquire about this home</h2>
        <p className="text-sm text-slate-600">
          Pick a shortlisted home and send a verified enquiry to the agent.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500">Selected home</label>
          <select
            value={selectedListingId}
            onChange={(event) => onSelectListing(event.target.value)}
            className={cn(
              "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700",
              !selectedListingId && "text-slate-400"
            )}
            data-testid="client-page-enquiry-select"
          >
            <option value="">Select a home</option>
            {listingOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {selectedListing && (
            <p className="text-xs text-slate-500">Enquiring about: {selectedListing.label}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500">Message</label>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell the agent what you need..."
            rows={4}
            data-testid="client-page-enquiry-message"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            data-testid="client-page-enquiry-consent"
          />
          Keep communication in PropatyHub.
        </label>

        <div className="hidden" aria-hidden="true">
          <label htmlFor="client-page-enquiry-company">Company</label>
          <input
            id="client-page-enquiry-company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}

        <Button type="submit" disabled={submitting || listings.length === 0} className="w-full">
          {submitting ? "Sending..." : "Send enquiry"}
        </Button>
      </form>
    </section>
  );
}
