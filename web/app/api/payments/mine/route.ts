import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { fetchMyPayments } from "@/lib/payments/featured-payments.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const routeLabel = "/api/payments/mine";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent", "landlord"],
  });
  if (!auth.ok) return auth.response;

  const client = hasServiceRoleEnv()
    ? (createServiceRoleClient() as unknown as UntypedAdminClient)
    : (auth.supabase as unknown as UntypedAdminClient);

  try {
    const rows = await fetchMyPayments({
      client,
      userId: auth.user.id,
      limit: 20,
    });

    const payments = rows.map((row) => {
      const purchase = Array.isArray((row as { featured_purchases?: unknown[] }).featured_purchases)
        ? ((row as { featured_purchases?: Array<Record<string, unknown>> }).featured_purchases?.[0] ?? null)
        : null;
      const property = purchase && typeof purchase === "object"
        ? ((purchase as { properties?: Record<string, unknown> | null }).properties ?? null)
        : null;

      return {
        id: String((row as { id?: string }).id || ""),
        created_at: String((row as { created_at?: string }).created_at || ""),
        amount_minor: Number((row as { amount_minor?: number }).amount_minor || 0),
        currency: String((row as { currency?: string }).currency || "NGN"),
        status: String((row as { status?: string }).status || "initialized"),
        reference: String((row as { reference?: string }).reference || ""),
        property_id: String((purchase as { property_id?: string } | null)?.property_id || ""),
        property_title: String((property as { title?: string } | null)?.title || "Listing"),
        featured_request_id: String((purchase as { request_id?: string } | null)?.request_id || ""),
        plan: String((purchase as { plan?: string } | null)?.plan || ""),
        receipt_email_sent_at: (row as { receipt_sent_at?: string | null }).receipt_sent_at || null,
      };
    });

    return NextResponse.json({ ok: true, payments });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load payment history." },
      { status: 400 }
    );
  }
}

export const dynamic = "force-dynamic";
