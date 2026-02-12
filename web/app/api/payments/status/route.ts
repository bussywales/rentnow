import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getPaymentWithPurchaseByReference } from "@/lib/payments/featured-payments.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

const routeLabel = "/api/payments/status";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["tenant", "agent", "landlord", "admin"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured." }, { status: 503 });
  }

  const reference = String(request.nextUrl.searchParams.get("reference") || "").trim();
  if (!reference) {
    return NextResponse.json({ error: "Reference is required." }, { status: 422 });
  }

  const client = createServiceRoleClient();
  let paymentBundle: Awaited<ReturnType<typeof getPaymentWithPurchaseByReference>> | null = null;
  try {
    paymentBundle = await getPaymentWithPurchaseByReference({
      client: client as unknown as UntypedAdminClient,
      reference,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load payment." },
      { status: 400 }
    );
  }

  if (!paymentBundle) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  const isAdmin = auth.role === "admin";
  if (!isAdmin && paymentBundle.payment.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    payment: {
      id: paymentBundle.payment.id,
      reference: paymentBundle.payment.reference,
      status: paymentBundle.payment.status,
      currency: paymentBundle.payment.currency,
      amount_minor: paymentBundle.payment.amount_minor,
      paid_at: paymentBundle.payment.paid_at,
    },
    featured_purchase: paymentBundle.purchase
      ? {
          id: paymentBundle.purchase.id,
          status: paymentBundle.purchase.status,
          property_id: paymentBundle.purchase.property_id,
          plan: paymentBundle.purchase.plan,
          duration_days: paymentBundle.purchase.duration_days,
          featured_until: paymentBundle.purchase.featured_until,
          activated_at: paymentBundle.purchase.activated_at,
        }
      : null,
  });
}
