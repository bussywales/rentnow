import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatLocationLabel, formatPriceValue } from "@/lib/property-discovery";
import type { PropertyRequestResponse } from "@/lib/requests/property-requests";

type Props = {
  responses: PropertyRequestResponse[];
  viewer: "owner" | "responder" | "admin";
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80";

function responseLabel(viewer: Props["viewer"], responderRole: string) {
  if (viewer === "responder") return "Your sent match";
  if (responderRole === "agent") return "Agent match";
  return "Host match";
}

export function PropertyRequestResponsesSection({ responses, viewer }: Props) {
  const emptyCopy =
    viewer === "responder"
      ? "You have not sent any listings to this request yet."
      : "No matching listings have been sent for this request yet.";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="property-request-responses-section">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Responses</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">
        {viewer === "owner" ? "Received matches" : viewer === "responder" ? "Your sent matches" : "Request responses"}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {viewer === "owner"
          ? "These matches were sent through PropatyHub. Contact details stay private in this phase."
          : viewer === "responder"
            ? "Only your own responses are visible here. Other responders stay private."
            : "Admins can inspect responses privately without exposing seeker contact details."}
      </p>

      {responses.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          {emptyCopy}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {responses.map((response) => (
            <article key={response.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    {responseLabel(viewer, response.responderRole)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    Sent {new Date(response.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {response.listings.length} listing{response.listings.length === 1 ? "" : "s"}
                </p>
              </div>

              {response.message ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Note</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{response.message}</p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {response.listings.map((listing) => (
                  <div key={`${response.id}-${listing.id}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <SafeImage
                        src={listing.coverImageUrl || FALLBACK_IMAGE}
                        alt={listing.title}
                        fill
                        sizes="96px"
                        className="object-cover"
                        usage="noncritical"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{listing.title}</p>
                      <p className="text-xs text-slate-500">
                        {formatLocationLabel(listing.city, listing.neighbourhood)}
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {formatPriceValue(listing.currency, listing.price)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {typeof listing.bedrooms === "number" ? `${listing.bedrooms} bed` : "Bedrooms flexible"}
                        {typeof listing.bathrooms === "number" ? ` • ${listing.bathrooms} bath` : ""}
                      </p>
                      <Link href={`/properties/${listing.id}`} className="inline-flex text-sm font-medium text-sky-700 hover:text-sky-800">
                        View listing
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
