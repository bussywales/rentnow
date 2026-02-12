import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { buildPropertyShareRedirect, resolvePropertyShareStatus } from "@/lib/sharing/property-share";
import { logPropertyEvent } from "@/lib/analytics/property-events.server";
import { getSessionKeyFromCookies } from "@/lib/analytics/session.server";
import { getCanonicalBaseUrl } from "@/lib/env";
import { BRAND_OG_IMAGE } from "@/lib/brand";
import { formatPriceValue } from "@/lib/property-discovery";
import {
  MARKET_COOKIE_NAME,
  readCookieValueFromHeader,
  resolveMarketFromRequest,
} from "@/lib/market/market";
import { getMarketSettings } from "@/lib/market/market.server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

type ShareRow = {
  property_id: string;
  expires_at: string | null;
  revoked_at: string | null;
};

type PropertyShareMetadataRow = {
  id: string;
  title: string;
  description: string | null;
  city: string;
  neighbourhood: string | null;
  cover_image_url: string | null;
  price: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  rental_type: string | null;
  is_demo: boolean | null;
  property_images?: Array<{ image_url: string; created_at?: string | null }> | null;
};

async function getSharePropertyMetadata(
  token: string
): Promise<{ share: ShareRow; property: PropertyShareMetadataRow } | null> {
  if (!hasServiceRoleEnv()) return null;
  const service = createServiceRoleClient();
  const { data: share } = await service
    .from("property_share_links")
    .select("property_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle<ShareRow>();

  const status = resolvePropertyShareStatus(share ?? null);
  if (!share || status !== "active") return null;

  const { data: property } = await service
    .from("properties")
    .select(
      "id,title,description,city,neighbourhood,cover_image_url,price,currency,bedrooms,bathrooms,rental_type,is_demo,property_images(image_url,created_at)"
    )
    .eq("id", share.property_id)
    .order("created_at", { foreignTable: "property_images", ascending: true })
    .maybeSingle<PropertyShareMetadataRow>();

  if (!property) return null;
  return { share, property };
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { token } = await params;
  const baseUrl = await getCanonicalBaseUrl();
  const headerList = await headers();
  const market = resolveMarketFromRequest({
    headers: headerList,
    cookieValue: readCookieValueFromHeader(headerList.get("cookie"), MARKET_COOKIE_NAME),
    appSettings: await getMarketSettings(),
  });
  const fallbackPath = `/share/property/${encodeURIComponent(token || "")}`;
  const fallbackCanonical = baseUrl ? `${baseUrl}${fallbackPath}` : fallbackPath;

  const generic: Metadata = {
    title: "Property link · PropatyHub",
    description: "Open this shared property on PropatyHub.",
    alternates: { canonical: fallbackCanonical },
    openGraph: {
      title: "Property link · PropatyHub",
      description: "Open this shared property on PropatyHub.",
      url: fallbackCanonical,
      type: "website",
      siteName: "PropatyHub",
      images: [{ url: BRAND_OG_IMAGE, alt: "PropatyHub" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Property link · PropatyHub",
      description: "Open this shared property on PropatyHub.",
      images: [BRAND_OG_IMAGE],
    },
  };

  if (!token || !hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return generic;
  }

  try {
    const result = await getSharePropertyMetadata(token);
    if (!result) return generic;

    const { property } = result;
    const title = `${property.title} | ${property.city}${property.neighbourhood ? ` - ${property.neighbourhood}` : ""}`;
    const description =
      property.description ||
      `Discover ${property.title} in ${property.city}. ${property.bedrooms} bed, ${property.bathrooms} bath ${property.rental_type === "short_let" ? "short-let" : "rental"} for ${formatPriceValue(property.currency, property.price, { marketCurrency: market.currency })}.`;
    const imageUrl = property.cover_image_url || property.property_images?.[0]?.image_url || BRAND_OG_IMAGE;
    const canonicalPath = `/properties/${property.id}`;
    const canonicalUrl = baseUrl ? `${baseUrl}${canonicalPath}` : canonicalPath;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: "article",
        siteName: "PropatyHub",
        images: [{ url: imageUrl, alt: property.title }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
      ...(property.is_demo
        ? {
            robots: {
              index: false,
              follow: false,
            },
          }
        : {}),
    };
  } catch {
    return generic;
  }
}

export default async function SharePropertyPage({ params }: Props) {
  const { token } = await params;

  if (!hasServerSupabaseEnv()) {
    return (
      <ErrorState
        title="Share link unavailable"
        description="Sharing is unavailable right now."
        retryHref="/support"
        retryLabel="Contact support"
      />
    );
  }

  if (!hasServiceRoleEnv()) {
    return (
      <ErrorState
        title="Share link unavailable"
        description="Sharing is unavailable right now."
        retryHref="/support"
        retryLabel="Contact support"
      />
    );
  }

  const match = await getSharePropertyMetadata(token);
  const row = match?.share ?? null;
  const status = resolvePropertyShareStatus(row);
  if (!match || !row || status !== "active") {
    let title = "Share link unavailable";
    let description = "This share link is invalid or you no longer have access.";
    if (status === "expired" && row?.expires_at) {
      title = "Share link expired";
      description = `This link has expired. Expired ${new Date(row.expires_at).toLocaleString()}.`;
    }
    if (status === "revoked" && row?.revoked_at) {
      title = "Share link revoked";
      description = `This link was revoked on ${new Date(row.revoked_at).toLocaleString()}.`;
    }
    return (
      <ErrorState
        title={title}
        description={description}
        retryHref="/support"
        retryLabel="Contact support"
      />
    );
  }

  try {
    await logPropertyEvent({
      supabase: createServiceRoleClient(),
      propertyId: row.property_id,
      eventType: "share_open",
      actorUserId: null,
      actorRole: "anon",
      sessionKey: await getSessionKeyFromCookies(),
      meta: { source: "share_link" },
    });
  } catch (err) {
    console.warn("[share-property] event log failed", err);
  }

  redirect(buildPropertyShareRedirect(row.property_id));
}
