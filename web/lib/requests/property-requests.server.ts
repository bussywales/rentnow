import { redirect } from "next/navigation";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import {
  PROPERTY_REQUEST_SELECT_COLUMNS,
  canRoleBrowsePropertyRequests,
  canViewPropertyRequest,
  mapPropertyRequestRecord,
  matchesPropertyRequestDiscoverFilters,
  parsePropertyRequestDiscoverFilters,
  shouldShowPropertyRequestBedrooms,
  type PropertyRequest,
  type PropertyRequestDiscoverFilters,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";

type ViewerAccess = {
  userId: string;
  role: UserRole;
  supabase: Awaited<ReturnType<typeof resolveServerRole>>["supabase"];
};

export async function requirePropertyRequestsViewerAccess(
  redirectPath: string,
  input?: { allowRoles?: UserRole[] }
): Promise<ViewerAccess> {
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

  if (input?.allowRoles && !input.allowRoles.includes(role)) {
    redirect("/forbidden");
  }

  return { userId: user.id, role, supabase };
}

export async function requireTenantPropertyRequestsAccess(
  redirectPath: string
): Promise<ViewerAccess> {
  return requirePropertyRequestsViewerAccess(redirectPath, { allowRoles: ["tenant"] });
}

export async function listOwnedPropertyRequests(input: {
  userId: string;
  supabase: ViewerAccess["supabase"];
}): Promise<PropertyRequest[]> {
  const { data } = await input.supabase
    .from("property_requests")
    .select(PROPERTY_REQUEST_SELECT_COLUMNS)
    .eq("owner_user_id", input.userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as PropertyRequestRecord[]).map(mapPropertyRequestRecord);
}

export async function loadOwnedPropertyRequest(input: {
  supabase: ViewerAccess["supabase"];
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

export async function listDiscoverablePropertyRequests(input: {
  supabase: ViewerAccess["supabase"];
  role: UserRole;
  userId: string;
  filters: PropertyRequestDiscoverFilters;
  now?: Date;
}): Promise<PropertyRequest[]> {
  if (!canRoleBrowsePropertyRequests(input.role)) {
    return [];
  }

  let query = input.supabase
    .from("property_requests")
    .select(PROPERTY_REQUEST_SELECT_COLUMNS)
    .order("published_at", { ascending: false })
    .order("updated_at", { ascending: false });

  if (input.role === "landlord" || input.role === "agent") {
    query = query.eq("status", "open").not("published_at", "is", null);
  } else if (input.role === "admin" && input.filters.status) {
    query = query.eq("status", input.filters.status);
  }

  if (input.filters.intent) {
    query = query.eq("intent", input.filters.intent);
  }
  if (input.filters.marketCode) {
    query = query.eq("market_code", input.filters.marketCode);
  }
  if (input.filters.propertyType) {
    query = query.eq("property_type", input.filters.propertyType);
  }
  if (
    typeof input.filters.bedrooms === "number" &&
    shouldShowPropertyRequestBedrooms(input.filters.propertyType)
  ) {
    query = query.eq("bedrooms", input.filters.bedrooms);
  }
  if (input.filters.moveTimeline) {
    query = query.eq("move_timeline", input.filters.moveTimeline);
  }

  const { data } = await query;
  const items = ((data ?? []) as unknown as PropertyRequestRecord[]).map(mapPropertyRequestRecord);
  const now = input.now ?? new Date();

  return items.filter((request) => {
    if (
      !canViewPropertyRequest({
        role: input.role,
        viewerUserId: input.userId,
        request,
        now,
      })
    ) {
      return false;
    }

    return matchesPropertyRequestDiscoverFilters(request, input.filters);
  });
}

export async function loadVisiblePropertyRequest(input: {
  supabase: ViewerAccess["supabase"];
  role: UserRole;
  userId: string;
  requestId: string;
  now?: Date;
}): Promise<PropertyRequest | null> {
  const { data } = await input.supabase
    .from("property_requests")
    .select(PROPERTY_REQUEST_SELECT_COLUMNS)
    .eq("id", input.requestId)
    .maybeSingle();

  if (!data) return null;
  const request = mapPropertyRequestRecord(data as unknown as PropertyRequestRecord);
  if (
    !canViewPropertyRequest({
      role: input.role,
      viewerUserId: input.userId,
      request,
      now: input.now,
    })
  ) {
    return null;
  }
  return request;
}

export function resolvePropertyRequestsDiscoverFilters(
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined>
): PropertyRequestDiscoverFilters {
  return parsePropertyRequestDiscoverFilters(searchParams ?? {});
}
