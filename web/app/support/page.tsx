import { appVersion, releaseDate, releaseNotes } from "@/lib/version";
import SupportPageClient from "@/components/support/SupportPageClient";
import { getProfile, getSession } from "@/lib/auth";
import { normalizeRole } from "@/lib/roles";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { SupportCategory } from "@/lib/support/support-content";

export const dynamic = "force-dynamic";

function readSingleParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseSupportCategory(value: string | null): SupportCategory {
  if (
    value === "general" ||
    value === "account" ||
    value === "listing" ||
    value === "safety" ||
    value === "billing"
  ) {
    return value;
  }
  return "general";
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const profile = hasServerSupabaseEnv() ? await getProfile() : null;
  const session = hasServerSupabaseEnv() ? await getSession() : null;
  const normalizedRole = normalizeRole(profile?.role);
  const isAdmin = normalizedRole === "admin";
  const prefillName = profile?.full_name ?? null;
  const prefillEmail = session?.user?.email ?? null;
  const initialCategory = parseSupportCategory(
    readSingleParam(resolvedSearchParams, "category")
  );
  const initialMessage = readSingleParam(resolvedSearchParams, "message");
  const initialSource = readSingleParam(resolvedSearchParams, "source");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <SupportPageClient
        prefillName={prefillName}
        prefillEmail={prefillEmail}
        initialCategory={initialCategory}
        initialMessage={initialMessage}
        initialSource={initialSource}
        isAdmin={isAdmin}
        appVersion={appVersion}
        releaseDate={releaseDate}
        releaseNotes={releaseNotes}
      />
    </div>
  );
}
