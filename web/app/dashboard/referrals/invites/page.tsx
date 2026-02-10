import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { fetchUserRole } from "@/lib/auth/role";
import { normalizeRole } from "@/lib/roles";
import ReferralInvitesManager from "@/components/referrals/ReferralInvitesManager";

export const dynamic = "force-dynamic";

export default async function ReferralInvitesPage() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/login?reason=auth");

  const role = normalizeRole(await fetchUserRole(supabase, user.id));
  if (role === "tenant") redirect("/tenant/home");
  if (role === "admin") redirect("/admin");
  if (role !== "agent" && role !== "landlord") redirect("/forbidden?reason=role");

  const [invitesResult, campaignsResult] = await Promise.all([
    supabase
      .from("referral_invites")
      .select(
        "id, owner_id, campaign_id, invitee_name, invitee_contact, status, reminder_at, notes, created_at"
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("referral_share_campaigns")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <ReferralInvitesManager
      initialInvites={(invitesResult.data as never[]) ?? []}
      campaigns={(campaignsResult.data as never[]) ?? []}
    />
  );
}
