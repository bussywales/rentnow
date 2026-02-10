import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { fetchUserRole } from "@/lib/auth/role";
import { normalizeRole } from "@/lib/roles";
import { getReferralCampaignDetail } from "@/lib/referrals/share-tracking.server";
import ReferralCampaignDetailClient from "@/components/referrals/ReferralCampaignDetailClient";

export const dynamic = "force-dynamic";

export default async function ReferralCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/login?reason=auth");

  const role = normalizeRole(await fetchUserRole(supabase, user.id));
  if (role === "tenant") redirect("/tenant/home");
  if (role === "admin") redirect("/admin");
  if (role !== "agent" && role !== "landlord") redirect("/forbidden?reason=role");

  const { id } = await params;
  const detail = await getReferralCampaignDetail({
    client: supabase as unknown as SupabaseClient,
    ownerId: user.id,
    campaignId: id,
  });

  if (!detail) {
    redirect("/dashboard/referrals/campaigns");
  }

  return <ReferralCampaignDetailClient campaignId={id} initialDetail={detail} />;
}
