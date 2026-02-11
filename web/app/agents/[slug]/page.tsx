import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicAdvertiserProfilePage } from "@/components/advertisers/PublicAdvertiserProfilePage";
import { getAgentStorefrontData, getAgentStorefrontViewModel } from "@/lib/agents/agent-storefront.server";
import { safeTrim } from "@/lib/agents/agent-storefront";
import { buildStorefrontCredibilityChips } from "@/lib/agents/storefront-credibility";
import {
  derivePublicAdvertiserName,
  isPublicAdvertiserRole,
  normalizePublicSlug,
} from "@/lib/advertisers/public-profile";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import AgentStorefrontListingsClient from "@/components/agents/AgentStorefrontListingsClient";
import AgentStorefrontHero from "@/components/agents/AgentStorefrontHero";
import AgentContactPanel from "@/components/agents/AgentContactPanel";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { slug?: string } | Promise<{ slug?: string }>;
};

const DEFAULT_SITE_URL = "https://www.propatyhub.com";

type PublicAdvertiserSlugRow = {
  id?: string | null;
  role?: string | null;
  public_slug?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  business_name?: string | null;
  city?: string | null;
  country?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  agent_storefront_enabled?: boolean | null;
};

type ProfileSlugHistoryRow = {
  profile_id?: string | null;
  old_slug?: string | null;
  new_slug?: string | null;
  changed_at?: string | null;
};

type PublicAdvertiserLookupResult =
  | { status: "not_found" }
  | { status: "non_public_role" }
  | { status: "profile_unavailable" }
  | {
      status: "found";
      advertiser: {
        id: string;
        role: "agent" | "landlord";
        publicSlug: string;
        name: string;
        agentStorefrontEnabled: boolean | null;
      };
    };

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

async function getPublicAdvertiserBySlug(slug: string): Promise<
  PublicAdvertiserLookupResult
> {
  if (!hasServerSupabaseEnv()) return { status: "not_found" };
  const normalizedSlug = normalizePublicSlug(slug);
  if (!normalizedSlug) return { status: "not_found" };
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, role, public_slug, display_name, full_name, business_name, agent_storefront_enabled"
    )
    .ilike("public_slug", normalizedSlug)
    .limit(1);
  const row = ((data as PublicAdvertiserSlugRow[] | null) ?? [])[0] ?? null;
  if (!row?.id) return { status: "not_found" };
  const role = row?.role ?? null;
  if (!isPublicAdvertiserRole(role)) return { status: "non_public_role" };
  const canonicalSlug = normalizePublicSlug(row.public_slug);
  if (!canonicalSlug) return { status: "not_found" };
  return {
    status: "found",
    advertiser: {
      id: row.id,
      role,
      publicSlug: canonicalSlug,
      name: derivePublicAdvertiserName(row),
      agentStorefrontEnabled: row.agent_storefront_enabled ?? null,
    },
  };
}

async function getPublicAdvertiserFromSlugHistory(slug: string): Promise<PublicAdvertiserLookupResult> {
  if (!hasServerSupabaseEnv()) return { status: "not_found" };
  const normalizedSlug = normalizePublicSlug(slug);
  if (!normalizedSlug) return { status: "not_found" };
  const supabase = await createServerSupabaseClient();
  const { data: historyData } = await supabase
    .from("profile_slug_history")
    .select("profile_id, old_slug, new_slug, changed_at")
    .ilike("old_slug", normalizedSlug)
    .order("changed_at", { ascending: false })
    .limit(1);
  const historyRow = ((historyData as ProfileSlugHistoryRow[] | null) ?? [])[0] ?? null;
  const profileId = historyRow?.profile_id ?? null;
  if (!profileId) return { status: "not_found" };

  const { data } = await supabase
    .from("profiles")
    .select(
      "id, role, public_slug, display_name, full_name, business_name, agent_storefront_enabled"
    )
    .eq("id", profileId)
    .maybeSingle();
  const profileRow = (data as PublicAdvertiserSlugRow | null) ?? null;
  if (!profileRow?.id) return { status: "not_found" };
  const role = profileRow.role ?? null;
  if (!isPublicAdvertiserRole(role)) return { status: "non_public_role" };
  const canonicalSlug = normalizePublicSlug(profileRow.public_slug);
  if (!canonicalSlug) return { status: "profile_unavailable" };
  if (role === "agent" && profileRow.agent_storefront_enabled === false) {
    return { status: "profile_unavailable" };
  }

  return {
    status: "found",
    advertiser: {
      id: profileRow.id,
      role,
      publicSlug: canonicalSlug,
      name: derivePublicAdvertiserName(profileRow),
      agentStorefrontEnabled: profileRow.agent_storefront_enabled ?? null,
    },
  };
}

function renderProfileUnavailable() {
  return (
    <div
      className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-12"
      data-testid="agent-storefront-unavailable"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agents</p>
      <h1 className="text-3xl font-semibold text-slate-900">Profile unavailable</h1>
      <p className="text-sm text-slate-600">
        This advertiser has hidden their public profile.
      </p>
    </div>
  );
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

  const advertiserLookup = await getPublicAdvertiserBySlug(slug);
  if (advertiserLookup?.status === "found") {
    const advertiser = advertiserLookup.advertiser;
    const canonical = `${siteUrl}/agents/${advertiser.publicSlug}`;
    const description = `Browse live listings and connect with ${advertiser.name} on PropatyHub.`;
    return {
      title: `${advertiser.name} | PropatyHub`,
      description,
      alternates: { canonical },
      openGraph: {
        title: `${advertiser.name} | PropatyHub`,
        description,
        url: canonical,
        siteName: "PropatyHub",
        type: "profile",
      },
      twitter: {
        card: "summary",
        title: `${advertiser.name} | PropatyHub`,
        description,
      },
      robots:
        advertiser.role === "agent" && advertiser.agentStorefrontEnabled === false
          ? { index: false, follow: true }
          : undefined,
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
  const slug = safeTrim(resolvedParams?.slug);
  const advertiserLookup = await getPublicAdvertiserBySlug(slug);
  if (advertiserLookup?.status === "non_public_role") {
    notFound();
  }
  if (advertiserLookup?.status === "found") {
    const advertiser = advertiserLookup.advertiser;
    if (advertiser.publicSlug !== slug) {
      permanentRedirect(`/agents/${advertiser.publicSlug}`);
    }
    if (advertiser.role === "agent" && advertiser.agentStorefrontEnabled === false) {
      return renderProfileUnavailable();
    }
    return (
      <PublicAdvertiserProfilePage
        advertiserId={advertiser.id}
        loginRedirectPath={`/agents/${advertiser.publicSlug}`}
      />
    );
  }
  const historyLookup = await getPublicAdvertiserFromSlugHistory(slug);
  if (historyLookup.status === "non_public_role") {
    notFound();
  }
  if (historyLookup.status === "profile_unavailable") {
    return renderProfileUnavailable();
  }
  if (historyLookup.status === "found") {
    permanentRedirect(`/agents/${historyLookup.advertiser.publicSlug}`);
  }

  const storefrontSlug = resolvedParams?.slug ?? "";
  const requestId = crypto.randomUUID();
  const data = await getAgentStorefrontViewModel(storefrontSlug, { requestId });
  if (!data.ok && data.redirectSlug && data.redirectSlug !== storefrontSlug) {
    permanentRedirect(`/agents/${data.redirectSlug}`);
  }

  if (!data.ok) {
    const reason = data.reason;
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
  const shareUrl = `${siteUrl}/agents/${agent.slug ?? storefrontSlug}`;
  const trustChips = data.metrics
    ? buildStorefrontCredibilityChips(data.metrics)
    : [];

  let isOwnerOrAdmin = false;
  if (hasServerSupabaseEnv()) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        isOwnerOrAdmin = user.id === agent.id || profile?.role === "admin";
      }
    } catch {
      isOwnerOrAdmin = false;
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <AgentStorefrontHero
        name={agent.name}
        bio={agent.bio}
        avatarUrl={agent.avatarUrl}
        coverImageUrl={coverImageUrl}
        listingsCount={listings.length}
        shareUrl={shareUrl}
        trustChips={trustChips}
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
          <AgentStorefrontListingsClient
            listings={listings}
            contactHref="#contact-agent"
            isOwner={isOwnerOrAdmin}
          />
        </section>

        <div className="lg:sticky lg:top-24">
          <AgentContactPanel slug={agent.slug ?? storefrontSlug} agentName={agent.name} />
        </div>
      </div>
    </div>
  );
}
