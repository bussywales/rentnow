import { appVersion, releaseDate, releaseNotes } from "@/lib/version";
import SupportPageClient from "@/components/support/SupportPageClient";
import { getProfile, getSession } from "@/lib/auth";
import { normalizeRole } from "@/lib/roles";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const profile = hasServerSupabaseEnv() ? await getProfile() : null;
  const session = hasServerSupabaseEnv() ? await getSession() : null;
  const normalizedRole = normalizeRole(profile?.role);
  const isAdmin = normalizedRole === "admin";
  const prefillName = profile?.full_name ?? null;
  const prefillEmail = session?.user?.email ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <SupportPageClient
        prefillName={prefillName}
        prefillEmail={prefillEmail}
        isAdmin={isAdmin}
        appVersion={appVersion}
        releaseDate={releaseDate}
        releaseNotes={releaseNotes}
      />
    </div>
  );
}
