import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { ListingTrustBadges } from "@/components/properties/ListingTrustBadges";
import { Button } from "@/components/ui/Button";
import { PublicAdvertiserShareButton } from "@/components/advertisers/PublicAdvertiserShareButton";
import { resolveServerRole } from "@/lib/auth/role";
import {
  toPublicAdvertiserProfile,
  type PublicAdvertiserProfileRow,
} from "@/lib/advertisers/public-profile";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";
import { isListingPubliclyVisible } from "@/lib/properties/expiry";
import { orderImagesWithCover } from "@/lib/properties/images";
import { getListingPopularitySignals } from "@/lib/properties/popularity.server";
import type { ListingSocialProof } from "@/lib/properties/listing-trust-badges";
import { fetchSavedPropertyIds } from "@/lib/saved-properties.server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
import type { Property } from "@/lib/types";

type ListingRow = Property & {
  property_images?: Array<{
    id: string;
    image_url: string;
    position?: number | null;
    created_at?: string | null;
    width?: number | null;
    height?: number | null;
    bytes?: number | null;
    format?: string | null;
  }>;
};

type Props = {
  advertiserId: string;
  loginRedirectPath: string;
};

function formatJoinDate(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
}

function initialsFromName(name: string) {
  const words = name
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (!words.length) return "PH";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export async function PublicAdvertiserProfilePage({
  advertiserId,
  loginRedirectPath,
}: Props) {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Profile unavailable</h1>
        <p className="text-sm text-slate-600">
          Advertiser profiles are unavailable right now.
        </p>
      </div>
    );
  }

  const { supabase, user, role: viewerRole } = await resolveServerRole();
  const { data: advertiserRaw } = await supabase
    .from("profiles")
    .select(
      "id, role, display_name, full_name, business_name, public_slug, avatar_url, city, country, created_at, agent_storefront_enabled"
    )
    .eq("id", advertiserId)
    .maybeSingle();

  const advertiserRow = advertiserRaw as
    | (PublicAdvertiserProfileRow & { agent_storefront_enabled?: boolean | null })
    | null;
  const advertiser = toPublicAdvertiserProfile(advertiserRow);
  if (!advertiser) notFound();

  const profileDisabled =
    advertiser.role === "agent" && advertiserRow?.agent_storefront_enabled === false;
  if (profileDisabled) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Profile unavailable</h1>
        <p className="text-sm text-slate-600">
          This advertiser has hidden their public profile.
        </p>
      </div>
    );
  }

  const includeDemoListings = includeDemoListingsForViewer({ viewerRole });
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("properties")
    .select(
      "*, property_images(id, image_url, position, created_at, width, height, bytes, format)"
    )
    .eq("owner_id", advertiserId)
    .eq("is_approved", true)
    .eq("is_active", true)
    .eq("status", "live")
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(24);
  if (!includeDemoListings) {
    query = query.eq("is_demo", false);
  }

  const { data: listingRows } = await query;
  const listings = (((listingRows as ListingRow[] | null) ?? [])
    .map((row) => ({
      ...row,
      images: orderImagesWithCover(
        row.cover_image_url,
        row.property_images?.map((img) => ({
          id: img.id || img.image_url,
          image_url: img.image_url,
          position: img.position,
          created_at: img.created_at ?? undefined,
          width: img.width ?? null,
          height: img.height ?? null,
          bytes: img.bytes ?? null,
          format: img.format ?? null,
        }))
      ),
    }))
    .filter((listing) => isListingPubliclyVisible(listing))) as Property[];

  const listingIds = listings.map((listing) => listing.id).filter(Boolean);
  const [trustSnapshots, socialProofByListing, savedIds] = await Promise.all([
    fetchTrustPublicSnapshots(supabase, [advertiserId]),
    listingIds.length
      ? getListingPopularitySignals({
          client: supabase,
          listingIds,
        })
      : Promise.resolve({} as Record<string, ListingSocialProof>),
    user
      ? fetchSavedPropertyIds({
          supabase,
          userId: user.id,
          propertyIds: listingIds,
        })
      : Promise.resolve(new Set<string>()),
  ]);

  const advertiserTrust = trustSnapshots[advertiserId] ?? null;
  const activeListingCount = listings.length;
  const popularListingCount = listings.filter(
    (listing) => socialProofByListing[listing.id]?.popular
  ).length;
  const roleLabel = advertiser.role === "agent" ? "Agent" : "Landlord";
  const joinedDate = formatJoinDate(advertiser.createdAt);
  const locationLabel = [advertiser.city, advertiser.country].filter(Boolean).join(", ");
  const messageHref = user
    ? "/dashboard/messages"
    : `/auth/login?reason=auth&redirect=${encodeURIComponent(loginRedirectPath)}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            {advertiser.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={advertiser.avatarUrl}
                alt={advertiser.name}
                className="h-16 w-16 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-700">
                {initialsFromName(advertiser.name)}
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Advertiser</p>
              <h1 className="text-2xl font-semibold text-slate-900">{advertiser.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-semibold text-slate-700">
                  {roleLabel}
                </span>
                {locationLabel ? <span>{locationLabel}</span> : null}
                {joinedDate ? <span>Joined {joinedDate}</span> : null}
              </div>
              <ListingTrustBadges
                trustMarkers={advertiserTrust}
                createdAt={null}
                socialProof={null}
                maxBadges={2}
                className="pt-1"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {advertiser.publicSlug ? (
              <PublicAdvertiserShareButton
                advertiserId={advertiser.id}
                slug={advertiser.publicSlug}
                displayName={advertiser.name}
              />
            ) : null}
            <Link href={messageHref}>
              <Button>Message</Button>
            </Link>
            <Link href="/properties">
              <Button variant="secondary">Browse listings</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Active listings</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{activeListingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Popular listings</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{popularListingCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Trust guide</p>
          <Link href="/help/trust" className="mt-1 inline-flex text-sm font-semibold text-sky-700">
            What does Verified mean?
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Stay safe: never pay before viewing.</p>
        <Link href="/support" className="mt-1 inline-flex font-semibold underline">
          Read safety guidance
        </Link>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Live listings</h2>
          <p className="text-sm text-slate-600">
            Public active listings by this {advertiser.role}.
          </p>
        </div>
        {listings.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <PropertyCard
                key={listing.id}
                property={listing}
                href={`/properties/${listing.id}`}
                trustMarkers={advertiserTrust}
                socialProof={socialProofByListing[listing.id] ?? null}
                showSave
                initialSaved={savedIds.has(listing.id)}
                showCta={false}
                viewerRole={viewerRole}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            No public listings are available from this advertiser right now.
          </div>
        )}
      </section>
    </div>
  );
}
