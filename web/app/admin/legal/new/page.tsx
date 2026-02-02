import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { AdminLegalEditor } from "@/components/admin/AdminLegalEditor";
import { isLegalAudience, type LegalAudience } from "@/lib/legal/constants";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/legal/new&reason=auth");
  }
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/legal/new&reason=auth");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }
}

export default async function AdminLegalNewPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin();

  const audienceParam = Array.isArray(searchParams?.audience)
    ? searchParams?.audience[0]
    : searchParams?.audience;
  const defaultAudience: LegalAudience | undefined = isLegalAudience(audienceParam)
    ? audienceParam
    : undefined;

  return <AdminLegalEditor mode="create" defaultAudience={defaultAudience} />;
}
