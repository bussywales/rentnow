import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getSiteUrl } from "@/lib/env";
import { getFeaturedEligibility } from "@/lib/featured/eligibility";
import { getFeaturedEligibilitySettings } from "@/lib/featured/eligibility.server";
import {
  buildFeaturedPaymentReference,
  createFeaturedPaymentRecords,
  markPaymentFailed,
} from "@/lib/payments/featured-payments.server";
import { getFeaturedProductByPlan, type FeaturedPaymentPlan } from "@/lib/payments/products";
import { hasPaystackServerEnv, initializeTransaction, getPaystackServerConfig } from "@/lib/payments/paystack.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

const routeLabel = "/api/payments/featured/initialize";

const payloadSchema = z.object({
  propertyId: z.string().uuid(),
  plan: z.enum(["featured_7d", "featured_30d"]),
  requestId: z.string().uuid(),
});

type PropertyRow = {
  id: string;
  owner_id: string;
  title: string | null;
  city: string | null;
  address: string | null;
  status: string | null;
  is_active: boolean | null;
  is_approved: boolean | null;
  expires_at: string | null;
  is_demo: boolean | null;
  is_featured: boolean | null;
  featured_until: string | null;
  description: string | null;
  property_images?: Array<{ id: string | null }> | null;
};

type FeaturedRequestRow = {
  id: string;
  property_id: string;
  requester_user_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  duration_days: number | null;
};

type InitializeFeaturedPaymentDeps = {
  hasServiceRoleEnv: () => boolean;
  hasPaystackServerEnv: () => boolean;
  requireRole: typeof requireRole;
  createServiceRoleClient: typeof createServiceRoleClient;
  hasActiveDelegation: typeof hasActiveDelegation;
  getFeaturedEligibilitySettings: typeof getFeaturedEligibilitySettings;
  getFeaturedProductByPlan: typeof getFeaturedProductByPlan;
  buildFeaturedPaymentReference: typeof buildFeaturedPaymentReference;
  createFeaturedPaymentRecords: typeof createFeaturedPaymentRecords;
  markPaymentFailed: typeof markPaymentFailed;
  initializeTransaction: typeof initializeTransaction;
  getPaystackServerConfig: typeof getPaystackServerConfig;
  getSiteUrl: typeof getSiteUrl;
};

const defaultDeps: InitializeFeaturedPaymentDeps = {
  hasServiceRoleEnv,
  hasPaystackServerEnv,
  requireRole,
  createServiceRoleClient,
  hasActiveDelegation,
  getFeaturedEligibilitySettings,
  getFeaturedProductByPlan,
  buildFeaturedPaymentReference,
  createFeaturedPaymentRecords,
  markPaymentFailed,
  initializeTransaction,
  getPaystackServerConfig,
  getSiteUrl,
};

export async function postInitializeFeaturedPaymentResponse(
  request: NextRequest,
  deps: InitializeFeaturedPaymentDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured." }, { status: 503 });
  }
  if (!deps.hasPaystackServerEnv()) {
    return NextResponse.json({ error: "Paystack is not configured." }, { status: 503 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 422 });
  }

  const { propertyId, plan, requestId } = parsed.data;
  const adminClient = deps.createServiceRoleClient() as unknown as UntypedAdminClient;

  const { data: propertyData, error: propertyError } = await adminClient
    .from("properties")
    .select(
      "id,owner_id,title,city,address,status,is_active,is_approved,expires_at,is_demo,is_featured,featured_until,description,property_images(id)"
    )
    .eq("id", propertyId)
    .maybeSingle();

  const property = (propertyData as PropertyRow | null) ?? null;
  if (propertyError || !property) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const isAdmin = auth.role === "admin";
  let hasOwnership = property.owner_id === auth.user.id;
  if (!hasOwnership && auth.role === "agent") {
    hasOwnership = await deps.hasActiveDelegation(
      auth.supabase as unknown as SupabaseClient,
      auth.user.id,
      property.owner_id
    );
  }
  if (!isAdmin && !hasOwnership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await deps.getFeaturedEligibilitySettings(adminClient as unknown as SupabaseClient);
  const eligibility = getFeaturedEligibility(
    {
      status: property.status,
      is_active: property.is_active,
      is_approved: property.is_approved,
      expires_at: property.expires_at,
      is_demo: property.is_demo,
      is_featured: property.is_featured,
      featured_until: property.featured_until,
      description: property.description,
      photo_count: Array.isArray(property.property_images) ? property.property_images.length : 0,
    },
    settings,
    { hasPendingRequest: false }
  );
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reasons[0] || "Listing is not eligible yet." }, { status: 409 });
  }

  const { data, error } = await adminClient
    .from("featured_requests")
    .select("id,property_id,requester_user_id,status,duration_days")
    .eq("id", requestId)
    .maybeSingle();
  const approvedRequest = (data as FeaturedRequestRow | null) ?? null;
  if (error || !approvedRequest) {
    return NextResponse.json({ error: "Featured request not found." }, { status: 404 });
  }
  if (approvedRequest.property_id !== property.id) {
    return NextResponse.json({ error: "Featured request does not match listing." }, { status: 409 });
  }
  if (approvedRequest.status !== "approved") {
    return NextResponse.json({ error: "Featured request must be approved before payment." }, { status: 409 });
  }
  if (approvedRequest.requester_user_id !== auth.user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const product = await deps.getFeaturedProductByPlan(plan as FeaturedPaymentPlan);
  if (!product) {
    return NextResponse.json({ error: "Unsupported featured plan." }, { status: 422 });
  }

  if (approvedRequest?.duration_days && approvedRequest.duration_days !== product.durationDays) {
    return NextResponse.json(
      { error: `Request was approved for ${approvedRequest.duration_days} days. Choose the matching plan.` },
      { status: 409 }
    );
  }

  const reference = deps.buildFeaturedPaymentReference();
  const record = await deps.createFeaturedPaymentRecords({
    client: adminClient,
    userId: auth.user.id,
    email: auth.user.email ?? null,
    amountMinor: product.amountMinor,
    currency: product.currency,
    reference,
    propertyId: property.id,
    requestId: approvedRequest?.id ?? null,
    plan: product.plan,
    durationDays: product.durationDays,
    meta: {
      purpose: "featured_activation",
      property_id: property.id,
      request_id: approvedRequest?.id ?? null,
      plan: product.plan,
    },
  });

  const paystackConfig = deps.getPaystackServerConfig();
  const siteUrl = await deps.getSiteUrl();
  const callbackUrl = `${siteUrl}/payments/featured/return?reference=${encodeURIComponent(reference)}`;

  try {
    const transaction = await deps.initializeTransaction({
      secretKey: paystackConfig.secretKey || "",
      amountMinor: product.amountMinor,
      email: auth.user.email || "",
      reference,
      callbackUrl,
      currency: product.currency,
      metadata: {
        payment_id: record.payment.id,
        property_id: property.id,
        plan: product.plan,
        request_id: approvedRequest?.id ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      authorization_url: transaction.authorizationUrl,
      reference: transaction.reference,
      payment_id: record.payment.id,
    });
  } catch (error) {
    await deps.markPaymentFailed({
      client: adminClient,
      paymentId: record.payment.id,
      errorMessage: error instanceof Error ? error.message : "paystack_initialize_failed",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to initialize payment." },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  return postInitializeFeaturedPaymentResponse(request);
}
