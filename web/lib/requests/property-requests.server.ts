import { redirect } from "next/navigation";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  PROPERTY_REQUEST_SELECT_COLUMNS,
  mapPropertyRequestRecord,
  type PropertyRequest,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";

type TenantRequestsAccess = {
  userId: string;
  supabase: Awaited<ReturnType<typeof resolveServerRole>>["supabase"];
};

export async function requireTenantPropertyRequestsAccess(
  redirectPath: string
): Promise<TenantRequestsAccess> {
  if (!hasServerSupabaseEnv()) {
    redirect(`/auth/required?redirect=${encodeURIComponent(redirectPath)}&reason=auth`);
  }

  const { supabase, user, role } = await resolveServerRole();

  if (!user) {
    logAuthRedirect(redirectPath);
    redirect(`/auth/login?reason=auth&redirect=${encodeURIComponent(redirectPath)}`);
  }

  if (!role) {
    redirect("/onboarding");
  }

  if (role !== "tenant") {
    redirect("/forbidden");
  }

  return { userId: user.id, supabase };
}

export async function listOwnedPropertyRequests(input: TenantRequestsAccess): Promise<PropertyRequest[]> {
  const { data } = await input.supabase
    .from("property_requests")
    .select(PROPERTY_REQUEST_SELECT_COLUMNS)
    .eq("owner_user_id", input.userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as PropertyRequestRecord[]).map(mapPropertyRequestRecord);
}

export async function loadOwnedPropertyRequest(input: {
  supabase: TenantRequestsAccess["supabase"];
  userId: string;
  requestId: string;
}): Promise<PropertyRequest | null> {
  const { data } = await input.supabase
    .from("property_requests")
    .select(PROPERTY_REQUEST_SELECT_COLUMNS)
    .eq("id", input.requestId)
    .eq("owner_user_id", input.userId)
    .maybeSingle();

  if (!data) return null;
  return mapPropertyRequestRecord(data as unknown as PropertyRequestRecord);
}
