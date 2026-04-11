import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { hasServiceRoleEnv } from "@/lib/supabase/admin";
import { logFailure } from "@/lib/observability";
import {
  publishSubscriptionPriceDraft,
  upsertSubscriptionPriceDraft,
} from "@/lib/billing/subscription-price-control-plane.server";

const routeLabel = "/api/admin/billing/prices";

const payloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("upsert_draft"),
    marketCountry: z.string().length(2),
    role: z.enum(["tenant", "landlord", "agent"]),
    cadence: z.enum(["monthly", "yearly"]),
    currency: z.string().length(3),
    amountMinor: z.number().int().nonnegative(),
    providerPriceRef: z.string().trim().min(1).nullable().optional(),
    operatorNotes: z.string().max(500).nullable().optional(),
  }),
  z.object({
    action: z.literal("publish"),
    draftId: z.string().uuid(),
  }),
]);

export type AdminSubscriptionPricingRouteDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  requireRole: typeof requireRole;
  upsertSubscriptionPriceDraft: typeof upsertSubscriptionPriceDraft;
  publishSubscriptionPriceDraft: typeof publishSubscriptionPriceDraft;
};

const defaultDeps: AdminSubscriptionPricingRouteDeps = {
  hasServiceRoleEnv,
  requireRole,
  upsertSubscriptionPriceDraft,
  publishSubscriptionPriceDraft,
};

export async function postAdminSubscriptionPricingResponse(
  request: Request,
  deps: AdminSubscriptionPricingRouteDeps = defaultDeps
) {
  const startTime = Date.now();

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; pricing control plane unavailable." },
      { status: 503 }
    );
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pricing payload." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "upsert_draft") {
      const draft = await deps.upsertSubscriptionPriceDraft(
        {
          marketCountry: parsed.data.marketCountry,
          role: parsed.data.role,
          cadence: parsed.data.cadence,
          currency: parsed.data.currency,
          amountMinor: parsed.data.amountMinor,
          providerPriceRef: parsed.data.providerPriceRef?.trim() || null,
          operatorNotes: parsed.data.operatorNotes?.trim() || null,
        },
        auth.user.id
      );
      return NextResponse.json({ ok: true, draftId: draft.id });
    }

    const published = await deps.publishSubscriptionPriceDraft(parsed.data.draftId, auth.user.id);
    return NextResponse.json({ ok: true, priceBookId: published.id });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 400,
      startTime,
      level: "warn",
      error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update pricing." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  return postAdminSubscriptionPricingResponse(request);
}
