import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { logProductAnalyticsEvent } from "@/lib/analytics/product-events.server";
import { moveReadySupplierApplicationCreateSchema } from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type SupplierApplicationDeps = {
  hasServiceRoleEnv: () => boolean;
  createServiceRoleClient: typeof createServiceRoleClient;
  logProductAnalyticsEvent: typeof logProductAnalyticsEvent;
  now: () => Date;
};

const defaultDeps: SupplierApplicationDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  logProductAnalyticsEvent,
  now: () => new Date(),
};

async function hasExistingActiveOrPendingApplication(client: ServiceClient, email: string) {
  const { data } = await client
    .from("move_ready_service_providers")
    .select("id,verification_state,provider_status")
    .ilike("email", email)
    .limit(1)
    .maybeSingle<{ id: string; verification_state: string; provider_status: string }>();

  if (!data) return false;
  return data.verification_state !== "rejected";
}

export async function postMoveReadySupplierApplicationResponse(
  request: NextRequest,
  deps: SupplierApplicationDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Property Prep supplier intake is unavailable." }, { status: 503 });
  }

  const parsed = moveReadySupplierApplicationCreateSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid supplier application.", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const client = deps.createServiceRoleClient();
  if (await hasExistingActiveOrPendingApplication(client, parsed.data.email)) {
    return NextResponse.json(
      { error: "A Property Prep supplier application for this email is already under review." },
      { status: 409 }
    );
  }

  const nowIso = deps.now().toISOString();
  const { data: provider, error } = await client
    .from("move_ready_service_providers")
    .insert(
      {
        business_name: parsed.data.businessName,
        contact_name: parsed.data.contactName,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        verification_state: "pending",
        provider_status: "paused",
        verification_reference: parsed.data.verificationReference ?? null,
        notes: parsed.data.notes ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      } as never
    )
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !provider?.id) {
    return NextResponse.json({ error: "Unable to submit supplier application." }, { status: 500 });
  }

  const categories = parsed.data.categories.map((category) => ({
    provider_id: provider.id,
    category,
    created_at: nowIso,
  }));
  const serviceAreas = parsed.data.serviceAreas.map((area) => ({
    provider_id: provider.id,
    market_code: area.marketCode,
    city: area.city ?? null,
    area: area.area ?? null,
    created_at: nowIso,
  }));

  if (categories.length) {
    await client.from("move_ready_provider_categories").insert(categories as never);
  }
  if (serviceAreas.length) {
    await client.from("move_ready_provider_areas").insert(serviceAreas as never);
  }

  await deps.logProductAnalyticsEvent({
    eventName: "property_prep_supplier_application_submitted",
    request,
    supabase: client,
    userId: null,
    userRole: "supplier",
    properties: {
      role: "supplier",
      market: parsed.data.serviceAreas[0]?.marketCode,
      city: parsed.data.serviceAreas[0]?.city ?? undefined,
      area: parsed.data.serviceAreas[0]?.area ?? undefined,
      category: parsed.data.categories[0],
      filterCount: parsed.data.categories.length + parsed.data.serviceAreas.length,
      pagePath: "/services/providers/apply",
    },
  });

  return NextResponse.json({ ok: true, providerId: provider.id });
}

export async function POST(request: NextRequest) {
  return postMoveReadySupplierApplicationResponse(request);
}
