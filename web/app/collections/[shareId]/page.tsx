import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import {
  getPublicCollectionByShareId,
  getPublicCollectionShareMetaByShareId,
} from "@/lib/saved-collections.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
import { getListingPopularitySignals } from "@/lib/properties/popularity.server";
import type { TrustMarkerState } from "@/lib/trust-markers";
import type { ListingSocialProof } from "@/lib/properties/listing-trust-badges";
import { BRAND_OG_IMAGE } from "@/lib/brand";
import { getCanonicalBaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

export function buildCollectionShareMetadata(input: {
  shareId: string;
  baseUrl: string | null;
  title?: string | null;
  city?: string | null;
  imageUrl?: string | null;
}): Metadata {
  const canonicalPath = `/collections/${encodeURIComponent(input.shareId || "")}`;
  const canonicalUrl = input.baseUrl ? `${input.baseUrl}${canonicalPath}` : canonicalPath;
  const hasCollectionTitle = typeof input.title === "string" && input.title.trim().length > 0;
  const title = hasCollectionTitle
    ? `${input.title} · PropatyHub`
    : "Shared shortlist · PropatyHub";
  const description = input.city
    ? `Shared shortlist of homes in ${input.city} on PropatyHub.`
    : "Shared shortlist of homes on PropatyHub.";
  const imageUrl = input.imageUrl || BRAND_OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: "PropatyHub",
      images: [{ url: imageUrl, alt: hasCollectionTitle ? input.title! : "PropatyHub" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const baseUrl = await getCanonicalBaseUrl();
  const generic = buildCollectionShareMetadata({
    shareId,
    baseUrl,
  });

  if (!shareId || !isUuid(shareId) || !hasServiceRoleEnv()) {
    return generic;
  }

  try {
    const service = createServiceRoleClient();
    const collectionMeta = await getPublicCollectionShareMetaByShareId({
      supabase: service,
      shareId,
    });
    if (!collectionMeta) return generic;
    return buildCollectionShareMetadata({
      shareId,
      baseUrl,
      title: collectionMeta.title,
      city: collectionMeta.city,
      imageUrl: collectionMeta.imageUrl,
    });
  } catch {
    return generic;
  }
}

export default async function PublicCollectionPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  if (!shareId || !isUuid(shareId)) {
    notFound();
  }

  if (!hasServiceRoleEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Shared collection</h1>
        <p className="text-sm text-slate-600">
          Shared collections are temporarily unavailable.
        </p>
        <Link href="/properties" className="inline-flex">
          <Button variant="secondary">Browse listings</Button>
        </Link>
      </div>
    );
  }

  const service = createServiceRoleClient();
  const collection = await getPublicCollectionByShareId({
    supabase: service,
    shareId,
  });
  if (!collection) {
    notFound();
  }
  const listingIds = collection.properties.map((property) => property.id).filter(Boolean);
  const ownerIds = Array.from(
    new Set(collection.properties.map((property) => property.owner_id).filter(Boolean))
  );
  const [trustSnapshotsByOwner, socialProofByListing] = await Promise.all([
    ownerIds.length
      ? fetchTrustPublicSnapshots(
          service as unknown as Parameters<typeof fetchTrustPublicSnapshots>[0],
          ownerIds
        )
      : Promise.resolve({} as Record<string, TrustMarkerState>),
    listingIds.length
      ? getListingPopularitySignals({ client: service, listingIds })
      : Promise.resolve({} as Record<string, ListingSocialProof>),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Shared collection</p>
        <h1 className="text-2xl font-semibold text-slate-900">{collection.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Read-only view. Sign in to save homes into your own collections.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/properties">
            <Button variant="secondary" size="sm">
              Browse
            </Button>
          </Link>
          <Link href="/auth/login?reason=auth">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      {collection.properties.length ? (
        <section className="grid gap-4 md:grid-cols-2">
          {collection.properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              href={`/properties/${property.id}`}
              trustMarkers={trustSnapshotsByOwner[property.owner_id]}
              socialProof={socialProofByListing[property.id] ?? null}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No listings in this collection yet</h2>
          <p className="mt-1 text-sm text-slate-600">Ask the owner to add listings and share again.</p>
        </section>
      )}
    </div>
  );
}
