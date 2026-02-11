import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SavedCollectionDetailClient } from "@/components/saved/SavedCollectionDetailClient";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { getCollectionWithListingsForOwner } from "@/lib/saved-collections.server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
import { getListingPopularitySignals } from "@/lib/properties/popularity.server";
import type { TrustMarkerState } from "@/lib/trust-markers";
import type { ListingSocialProof } from "@/lib/properties/listing-trust-badges";

export const dynamic = "force-dynamic";

export default async function SavedCollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Saved collection</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured, so collections are unavailable.
        </p>
        <Link href="/properties" className="font-semibold text-sky-700">
          Browse properties
        </Link>
      </div>
    );
  }

  const { collectionId } = await params;
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect(`/auth/login?reason=auth&redirect=${encodeURIComponent(`/saved/${collectionId}`)}`);
  }

  const data = await getCollectionWithListingsForOwner({
    supabase,
    ownerUserId: user.id,
    collectionId,
  });
  if (!data) notFound();
  const listingIds = data.properties.map((property) => property.id).filter(Boolean);
  const ownerIds = Array.from(
    new Set(data.properties.map((property) => property.owner_id).filter(Boolean))
  );
  const [trustSnapshotsByOwner, socialProofByListing] = await Promise.all([
    ownerIds.length
      ? fetchTrustPublicSnapshots(supabase, ownerIds)
      : Promise.resolve({} as Record<string, TrustMarkerState>),
    listingIds.length
      ? getListingPopularitySignals({ client: supabase, listingIds })
      : Promise.resolve({} as Record<string, ListingSocialProof>),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4">
      <SavedCollectionDetailClient
        collection={data.collection}
        initialProperties={data.properties}
        trustSnapshotsByOwner={trustSnapshotsByOwner}
        socialProofByListing={socialProofByListing}
      />
    </div>
  );
}
