import Link from "next/link";
import type { ReactNode } from "react";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { normalizeRole } from "@/lib/roles";
import { ensureDefaultCollection, listCollectionsForOwner } from "@/lib/saved-collections.server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { SavedCollectionsClient } from "@/components/saved/SavedCollectionsClient";

type Props = {
  unauthedFallback?: ReactNode;
  supabaseUnavailableFallback?: ReactNode;
};

function defaultUnavailableFallback() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Saved collections</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured; add env vars to enable saved collections.
        </p>
      </div>
      <Link href="/properties" className="font-semibold text-sky-700">
        Browse properties
      </Link>
    </div>
  );
}

function defaultUnauthedFallback() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Saved collections</h1>
        <p className="text-sm text-slate-600">
          Log in to create and share your collections.
        </p>
      </div>
      <Link href="/auth/login?reason=auth" className="font-semibold text-sky-700">
        Log in
      </Link>
    </div>
  );
}

export async function SavedCollectionsPageServer({
  unauthedFallback,
  supabaseUnavailableFallback,
}: Props) {
  if (!hasServerSupabaseEnv()) {
    return supabaseUnavailableFallback ?? defaultUnavailableFallback();
  }

  const { supabase, user } = await getServerAuthUser();

  if (!user) {
    return unauthedFallback ?? defaultUnauthedFallback();
  }

  let collections = await listCollectionsForOwner({
    supabase,
    ownerUserId: user.id,
  });
  if (!collections.length) {
    await ensureDefaultCollection({
      supabase,
      userId: user.id,
    });
    collections = await listCollectionsForOwner({
      supabase,
      ownerUserId: user.id,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = normalizeRole(profile?.role);
  const savedSearchesHref =
    role === "tenant"
      ? "/tenant/saved-searches"
      : role === "agent" || role === "landlord"
        ? "/dashboard/saved-searches"
        : "/saved-searches";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4">
      <SavedCollectionsClient
        initialCollections={collections}
        savedSearchesHref={savedSearchesHref}
      />
    </div>
  );
}
