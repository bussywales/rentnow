import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { safeTrim } from "@/lib/agents/agent-storefront";
import { getAgentClientPagePublic } from "@/lib/agents/agent-client-pages.server";
import { buildStorefrontCredibilityChips } from "@/lib/agents/storefront-credibility";
import AgentStorefrontHero from "@/components/agents/AgentStorefrontHero";
import AgentStorefrontListingsClient from "@/components/agents/AgentStorefrontListingsClient";
import AgentContactPanel from "@/components/agents/AgentContactPanel";

export const dynamic = "force-dynamic";

type PageProps = {
  params:
    | { slug?: string; clientSlug?: string }
    | Promise<{ slug?: string; clientSlug?: string }>;
};

const DEFAULT_SITE_URL = "https://www.propatyhub.com";

const NOT_AVAILABLE_COPY = {
  GLOBAL_DISABLED: {
    title: "Client pages are currently unavailable",
    description:
      "We’ve temporarily paused public client pages. Please check back soon or browse listings instead.",
  },
  AGENT_DISABLED: {
    title: "This client page is not available",
    description: "This agent has disabled their public storefront at the moment.",
  },
  NOT_FOUND: {
    title: "This client page is not available",
    description: "We couldn’t find that client page. Double-check the link and try again.",
  },
  NOT_AGENT: {
    title: "This client page is not available",
    description: "We couldn’t find a public agent for this client page.",
  },
  MISSING_SLUG: {
    title: "This client page is not available",
    description: "We couldn’t load that client page. Double-check the link and try again.",
  },
} as const;

function resolveCoverImage(listings: { cover_image_url?: string | null; images?: { image_url?: string | null }[] | null }[]) {
  for (const listing of listings) {
    if (listing.cover_image_url) return listing.cover_image_url;
    const fallback = listing.images?.[0]?.image_url;
    if (fallback) return fallback;
  }
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = safeTrim(resolvedParams?.slug);
  const clientSlug = safeTrim(resolvedParams?.clientSlug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;

  if (!slug || !clientSlug) {
    return {
      title: "Client shortlist | PropatyHub",
      description: "Explore a tailored shortlist curated by a PropatyHub agent.",
      alternates: { canonical: `${siteUrl}/agents` },
    };
  }

  const data = await getAgentClientPagePublic({ agentSlug: slug, clientSlug });
  if (!data.ok) {
    return {
      title: "Client shortlist | PropatyHub",
      description: "Explore a tailored shortlist curated by a PropatyHub agent.",
      alternates: { canonical: `${siteUrl}/agents/${slug}/c/${clientSlug}` },
      robots: { index: false, follow: true },
    };
  }

  const canonicalSlug = data.agent.slug ?? slug;
  const canonical = `${siteUrl}/agents/${canonicalSlug}/c/${data.client.slug}`;
  const title = `${data.agent.name} • Homes for ${data.client.name}`;
  const description =
    data.client.brief?.trim() ||
    `Shortlist curated by ${data.agent.name} for ${data.client.name}.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "PropatyHub",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function AgentClientPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug ?? "";
  const clientSlug = resolvedParams?.clientSlug ?? "";
  const requestId = crypto.randomUUID();

  const data = await getAgentClientPagePublic({
    agentSlug: slug,
    clientSlug,
    requestId,
  });

  if (!data.ok) {
    if (data.redirectSlug && data.redirectSlug !== slug) {
      permanentRedirect(`/agents/${data.redirectSlug}/c/${clientSlug}`);
    }
    const reason = data.reason;
    const copy = NOT_AVAILABLE_COPY[reason] ?? NOT_AVAILABLE_COPY.NOT_FOUND;
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Client pages</p>
        <h1 className="text-3xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="text-sm text-slate-600">{copy.description}</p>
      </div>
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  const coverImageUrl = resolveCoverImage(data.listings);
  const shareUrl = `${siteUrl}/agents/${data.agent.slug ?? slug}/c/${data.client.slug}`;
  const trustChips = data.metrics
    ? buildStorefrontCredibilityChips(data.metrics)
    : [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <AgentStorefrontHero
        name={data.agent.name}
        bio={data.agent.bio}
        avatarUrl={data.agent.avatarUrl}
        coverImageUrl={coverImageUrl}
        listingsCount={data.listings.length}
        shareUrl={shareUrl}
        trustChips={trustChips}
        contactAnchor="contact-agent"
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Client shortlist
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          For {data.client.name}
        </h2>
        {data.client.title && (
          <p className="mt-2 text-sm font-semibold text-slate-700">{data.client.title}</p>
        )}
        {data.client.brief && (
          <p className="mt-2 text-sm text-slate-600">{data.client.brief}</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),360px] lg:items-start">
        <section className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Listings</h3>
            <p className="text-sm text-slate-600">
              Curated homes matched to this client’s shortlist.
            </p>
          </div>
          <AgentStorefrontListingsClient
            listings={data.listings}
            emptyState={{
              title: "No matches right now",
              body:
                "Nothing matches this shortlist at the moment. The agent can update the criteria or add new homes as they come in.",
              primaryCta: { label: "Message agent", href: "#contact-agent" },
            }}
          />
        </section>

        <div className="lg:sticky lg:top-24">
          <AgentContactPanel slug={data.agent.slug ?? slug} agentName={data.agent.name} />
        </div>
      </div>
    </div>
  );
}
