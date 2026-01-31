import { redirect } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { buildPropertyShareRedirect, resolvePropertyShareStatus } from "@/lib/sharing/property-share";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

type ShareRow = {
  property_id: string;
  expires_at: string | null;
  revoked_at: string | null;
};

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

  const client = createServiceRoleClient();
  const { data } = await client
    .from("property_share_links")
    .select("property_id, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  const row = data as ShareRow | null;
  const status = resolvePropertyShareStatus(row);
  if (!row || status !== "active") {
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

  redirect(buildPropertyShareRedirect(row.property_id));
}
