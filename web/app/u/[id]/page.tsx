import { permanentRedirect, notFound } from "next/navigation";
import { PublicAdvertiserProfilePage } from "@/components/advertisers/PublicAdvertiserProfilePage";
import { getOrCreatePublicSlug, type SlugLookupClient } from "@/lib/advertisers/slug";
import { isPublicAdvertiserRole } from "@/lib/advertisers/public-profile";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id?: string }>;
};

type SlugLookupRow = {
  id?: string | null;
  role?: string | null;
  public_slug?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  business_name?: string | null;
};

export default async function PublicAdvertiserProfileIdPage({ params }: PageProps) {
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

  const resolvedParams = await params;
  const advertiserId = decodeURIComponent(resolvedParams.id ?? "").trim();
  if (!advertiserId) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("id, role, public_slug, display_name, full_name, business_name")
    .eq("id", advertiserId)
    .maybeSingle();
  const profile = (profileRaw as SlugLookupRow | null) ?? null;
  if (!profile?.id || !isPublicAdvertiserRole(profile.role ?? null)) {
    notFound();
  }

  const slug = await getOrCreatePublicSlug({
    profile: {
      id: profile.id,
      role: profile.role,
      public_slug: profile.public_slug,
      display_name: profile.display_name,
      full_name: profile.full_name,
      business_name: profile.business_name,
    },
    lookupClient: supabase as unknown as SlugLookupClient,
    canPersist: true,
  });
  if (slug) {
    permanentRedirect(`/agents/${slug}`);
  }

  return (
    <PublicAdvertiserProfilePage
      advertiserId={advertiserId}
      loginRedirectPath={`/u/${advertiserId}`}
    />
  );
}
