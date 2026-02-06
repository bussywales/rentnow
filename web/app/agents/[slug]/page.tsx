import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getAgentStorefrontData } from "@/lib/agents/agent-storefront.server";
import { safeTrim } from "@/lib/agents/agent-storefront";
import AgentStorefrontListingsClient from "@/components/agents/AgentStorefrontListingsClient";
import AgentStorefrontHero from "@/components/agents/AgentStorefrontHero";
import AgentContactPanel from "@/components/agents/AgentContactPanel";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { slug?: string } | Promise<{ slug?: string }>;
};

const DEFAULT_SITE_URL = "https://www.propatyhub.com";

const NOT_AVAILABLE_COPY = {
  GLOBAL_DISABLED: {
    title: "Agent storefronts are currently unavailable",
    description:
      "We’ve temporarily paused public agent pages. Please check back soon or browse listings instead.",
  },
  AGENT_DISABLED: {
    title: "This storefront is not available",
    description:
      "This agent has chosen to hide their public storefront right now.",
  },
  NOT_FOUND: {
    title: "This storefront is not available",
    description:
      "We couldn’t find that agent storefront. Double-check the link and try again.",
  },
  NOT_AGENT: {
    title: "This storefront is not available",
    description:
      "We couldn’t find a public agent storefront at this link.",
  },
  MISSING_SLUG: {
    title: "This storefront is not available",
    description:
      "We couldn’t load that agent storefront. Double-check the link and try again.",
  },
} as const;

function resolveCoverImage(listings: Property[]) {
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;

  if (!slug) {
    return {
      title: "Agent storefront | PropatyHub",
      description: "Discover verified agents and their latest listings on PropatyHub.",
      alternates: { canonical: `${siteUrl}/agents` },
    };
  }

  const data = await getAgentStorefrontData(slug);
  if (!data.ok || !data.storefront) {
    return {
      title: "Agent storefront | PropatyHub",
      description: "Discover verified agents and their latest listings on PropatyHub.",
      alternates: { canonical: `${siteUrl}/agents/${slug}` },
      robots: { index: false, follow: true },
    };
  }

  const agent = data.storefront.agent;
  const listings = data.storefront.listings;
  const coverImage = resolveCoverImage(listings);
  const canonicalSlug = safeTrim(agent.slug) || slug;
  const canonical = `${siteUrl}/agents/${canonicalSlug}`;
  const description =
    agent.bio?.trim() ||
    `Browse live listings and connect with ${agent.name} on PropatyHub.`;

  return {
    title: `${agent.name} | PropatyHub`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${agent.name} | PropatyHub`,
      description,
      url: canonical,
      siteName: "PropatyHub",
      type: "profile",
      images: coverImage ? [{ url: coverImage }] : undefined,
    },
    twitter: {
      card: coverImage ? "summary_large_image" : "summary",
      title: `${agent.name} | PropatyHub`,
      description,
      images: coverImage ? [coverImage] : undefined,
    },
  };
}

export default async function AgentStorefrontPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug ?? "";
  const requestId = crypto.randomUUID();
  const data = await getAgentStorefrontData(slug, { requestId });
  if (!data.ok && data.redirectSlug && data.redirectSlug !== slug) {
    permanentRedirect(`/agents/${data.redirectSlug}`);
  }

  if (!data.ok || !data.storefront) {
    const reason = data.ok ? "NOT_FOUND" : data.reason;
    const copy = NOT_AVAILABLE_COPY[reason] ?? NOT_AVAILABLE_COPY.NOT_FOUND;
    return (
      <div
        className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-12"
        data-testid="agent-storefront-unavailable"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agents</p>
        <h1 className="text-3xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="text-sm text-slate-600">{copy.description}</p>
      </div>
    );
  }

  const { agent, listings } = data.storefront;
  const coverImageUrl = resolveCoverImage(listings);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  const shareUrl = `${siteUrl}/agents/${agent.slug ?? slug}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <AgentStorefrontHero
        name={agent.name}
        bio={agent.bio}
        avatarUrl={agent.avatarUrl}
        coverImageUrl={coverImageUrl}
        listingsCount={listings.length}
        shareUrl={shareUrl}
        contactAnchor="contact-agent"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),360px] lg:items-start">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Listings</h2>
              <p className="text-sm text-slate-600">
                Live homes currently represented by this agent.
              </p>
            </div>
          </div>
          <AgentStorefrontListingsClient listings={listings} />
        </section>

        <div className="lg:sticky lg:top-24">
          <AgentContactPanel slug={agent.slug ?? slug} agentName={agent.name} />
        </div>
      </div>
    </div>
  );
}
