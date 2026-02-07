import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { safeTrim } from "@/lib/agents/agent-storefront";
import { getAgentClientPagePublic } from "@/lib/agents/agent-client-pages.server";
import { buildStorefrontCredibilityChips } from "@/lib/agents/storefront-credibility";
import AgentStorefrontHero from "@/components/agents/AgentStorefrontHero";
import AgentClientPageEnquirySection from "@/components/agents/AgentClientPageEnquirySection";

export const dynamic = "force-dynamic";

type PageProps = {
  params:
    | { slug?: string; clientSlug?: string }
    | Promise<{ slug?: string; clientSlug?: string }>;
};

const DEFAULT_SITE_URL = "https://www.propatyhub.com";

function resolveCoverImage(
  listings: { cover_image_url?: string | null; images?: { image_url?: string | null }[] | null }[]
) {
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
  const clientName = data.client.name || "Client";
  const title = `${data.agent.name} • Homes for ${clientName}`;
  const description =
    data.client.requirements?.trim() ||
    data.client.brief?.trim() ||
    `Shortlist curated by ${data.agent.name} for ${clientName}.`;
  const banner = data.agent.bannerUrl || data.agent.logoUrl || resolveCoverImage(data.listings);

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
      images: banner ? [{ url: banner }] : undefined,
    },
    twitter: {
      card: banner ? "summary_large_image" : "summary",
      title,
      description,
      images: banner ? [banner] : undefined,
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
    if (data.reason === "GLOBAL_DISABLED") {
      return (
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-12">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Client pages</p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Storefronts are temporarily unavailable
          </h1>
          <p className="text-sm text-slate-600">
            We’ve paused public client pages for now. Please check back soon.
          </p>
        </div>
      );
    }
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  const coverImageUrl = data.agent.bannerUrl || resolveCoverImage(data.listings);
  const shareUrl = `${siteUrl}/agents/${data.agent.slug ?? slug}/c/${data.client.slug}`;
  const trustChips = data.metrics ? buildStorefrontCredibilityChips(data.metrics) : [];
  const clientName = data.client.name || "Client";
  const requirements = data.client.requirements?.trim() || data.client.brief?.trim() || null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <AgentStorefrontHero
        name={data.agent.name}
        bio={data.agent.about || data.agent.bio}
        avatarUrl={data.agent.avatarUrl}
        coverImageUrl={coverImageUrl}
        listingsCount={data.listings.length}
        shareUrl={shareUrl}
        trustChips={trustChips}
        contactAnchor="client-page-enquiry"
        companyName={data.agent.companyName}
        logoUrl={data.agent.logoUrl}
        eyebrow="Client shortlist"
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Client context
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Homes shortlisted for {clientName}
        </h2>
        {requirements && (
          <p className="mt-2 text-sm text-slate-600" data-testid="client-page-requirements">
            {requirements}
          </p>
        )}
        {data.client.title && (
          <p className="mt-2 text-sm font-semibold text-slate-700">{data.client.title}</p>
        )}
        {data.client.notes && (
          <p className="mt-3 text-sm text-slate-600">{data.client.notes}</p>
        )}
        <p className="mt-3 text-xs text-slate-400">Curated by {data.agent.name}</p>
      </section>

      <AgentClientPageEnquirySection
        listings={data.listings}
        clientPageId={data.client.id}
        agentSlug={data.agent.slug ?? slug}
        clientSlug={data.client.slug}
      />
    </div>
  );
}
