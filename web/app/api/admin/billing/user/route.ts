import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { buildBillingSnapshot } from "@/lib/billing/snapshot";
import { maskIdentifier } from "@/lib/billing/mask";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const routeLabel = "/api/admin/billing/user";

export async function GET(request: Request) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Service role key missing; billing snapshot unavailable." },
      { status: 503 }
    );
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email query is required." }, { status: 400 });
  }

  const adminClient = createServiceRoleClient();
  const { data: users, error: userError } = await adminClient.auth.admin.listUsers({ perPage: 200 });
  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  const user = (users?.users || []).find((candidate) => candidate.email?.toLowerCase() === email) || null;
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: plan } = await adminClient
    .from("profile_plans")
    .select(
      "profile_id, plan_tier, billing_source, valid_until, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_current_period_end, stripe_status, updated_at, upgraded_at, updated_by, upgraded_by"
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: notes } = await adminClient
    .from("profile_billing_notes")
    .select("billing_notes, updated_at, updated_by")
    .eq("profile_id", user.id)
    .maybeSingle();

  const { data: requests } = await adminClient
    .from("plan_upgrade_requests")
    .select("id, status, requested_plan_tier, created_at, notes")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        order: (column: string, options?: { ascending?: boolean }) => {
          limit: (count: number) => {
            eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
          };
        };
      };
    };
  };

  let events: Array<Record<string, string | null>> = [];
  try {
    const eventsQuery = adminDb
      .from("stripe_webhook_events")
      .select(
        "event_id, event_type, created_at, status, reason, mode, plan_tier, profile_id, stripe_customer_id, stripe_subscription_id"
      )
      .order("created_at", { ascending: false })
      .limit(20);

    const stripeCustomerId = (plan as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
    const stripeSubscriptionId = (plan as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;

    const { data: eventRows, error: eventError } = stripeCustomerId
      ? await eventsQuery.eq("stripe_customer_id", stripeCustomerId)
      : stripeSubscriptionId
        ? await eventsQuery.eq("stripe_subscription_id", stripeSubscriptionId)
        : await eventsQuery.eq("profile_id", user.id);
    if (!eventError && eventRows) {
      events = (eventRows as Array<Record<string, string | null>>).map((row) => ({
        event_id: maskIdentifier(row.event_id),
        event_type: row.event_type ?? null,
        created_at: row.created_at ?? null,
        status: row.status ?? null,
        reason: row.reason ?? null,
        mode: row.mode ?? null,
        plan_tier: row.plan_tier ?? null,
        profile_id: maskIdentifier(row.profile_id),
        stripe_customer_id: maskIdentifier(row.stripe_customer_id),
        stripe_subscription_id: maskIdentifier(row.stripe_subscription_id),
      }));
    }
  } catch {
    events = [];
  }

  const snapshot = buildBillingSnapshot({
    profileId: user.id,
    email: user.email ?? null,
    role: (profile as { role?: string | null } | null)?.role ?? null,
    fullName: (profile as { full_name?: string | null } | null)?.full_name ?? null,
    plan: (plan as Record<string, string | null> | null) ?? null,
    notes: (notes as { billing_notes?: string | null; updated_at?: string | null; updated_by?: string | null } | null) ?? null,
  });

  const safeSnapshot = { ...snapshot, profileId: maskIdentifier(snapshot.profileId) };
  const safeRequests = ((requests as Array<{
    status: string | null;
    requested_plan_tier: string | null;
    created_at: string | null;
    notes: string | null;
  }> | null) ?? []).map((row) => ({
    status: row.status,
    requested_plan_tier: row.requested_plan_tier,
    created_at: row.created_at,
    notes: row.notes,
  }));

  return NextResponse.json({
    ok: true,
    snapshot: safeSnapshot,
    upgradeRequests: safeRequests,
    events,
  });
}
