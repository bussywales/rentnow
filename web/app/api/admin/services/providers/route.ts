import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/authz";
import { moveReadyProviderUpsertSchema } from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

type ProviderAdminDeps = {
  hasServiceRoleEnv: () => boolean;
  createServiceRoleClient: typeof createServiceRoleClient;
  requireRole: typeof requireRole;
  now: () => Date;
};

const defaultDeps: ProviderAdminDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  requireRole,
  now: () => new Date(),
};

export async function postAdminMoveReadyProviderResponse(
  request: NextRequest,
  deps: ProviderAdminDeps = defaultDeps
) {
  const auth = await deps.requireRole({
    request,
    route: "/api/admin/services/providers",
    startTime: Date.now(),
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Services admin is unavailable." }, { status: 503 });
  }

  const parsed = moveReadyProviderUpsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider payload.", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const client = deps.createServiceRoleClient();
  const nowIso = deps.now().toISOString();

  const { data: provider, error: providerError } = await client
    .from("move_ready_service_providers")
    .insert(
      {
        business_name: parsed.data.businessName,
        contact_name: parsed.data.contactName,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        verification_state: parsed.data.verificationState,
        provider_status: parsed.data.providerStatus,
        notes: parsed.data.notes ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      } as never
    )
    .select("id")
    .maybeSingle<{ id: string }>();

  if (providerError || !provider?.id) {
    return NextResponse.json({ error: "Unable to create provider." }, { status: 500 });
  }

  const categories = parsed.data.categories.map((category) => ({
    provider_id: provider.id,
    category,
    created_at: nowIso,
  }));
  const areas = parsed.data.serviceAreas.map((area) => ({
    provider_id: provider.id,
    market_code: area.marketCode,
    city: area.city ?? null,
    area: area.area ?? null,
    created_at: nowIso,
  }));

  if (categories.length) {
    await client.from("move_ready_provider_categories").insert(categories as never);
  }
  if (areas.length) {
    await client.from("move_ready_provider_areas").insert(areas as never);
  }

  return NextResponse.json({ ok: true, providerId: provider.id });
}

export async function POST(request: NextRequest) {
  return postAdminMoveReadyProviderResponse(request);
}
