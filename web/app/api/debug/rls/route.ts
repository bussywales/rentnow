import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const routeLabel = "/api/debug/rls";

const requiredPolicies: Record<string, string[]> = {
  profiles: ["profiles insert self", "profiles select self", "profiles update self"],
  properties: [
    "properties owner/admin delete",
    "properties owner/admin insert",
    "properties owner/admin read",
    "properties owner/admin update",
    "properties public read",
  ],
  property_images: [
    "images owner/admin delete",
    "images owner/admin insert",
    "images owner/admin read",
    "images public read approved",
  ],
  saved_properties: ["saved self delete", "saved self insert", "saved self select"],
  saved_searches: [
    "saved searches delete self",
    "saved searches insert self",
    "saved searches select self",
    "saved searches update self",
  ],
  saved_search_alerts: [
    "saved search alerts admin read",
    "saved search alerts select self",
  ],
  messages: ["messages participant/owner read", "messages sender insert"],
  viewing_requests: ["viewings tenant insert", "viewings tenant/owner read", "viewings tenant/owner update"],
  agent_delegations: [
    "agent delegations delete",
    "agent delegations insert",
    "agent delegations select",
    "agent delegations update",
  ],
  profile_plans: ["profile plans insert self", "profile plans select self"],
  profile_billing_notes: ["billing notes admin read", "billing notes admin write"],
  plan_upgrade_requests: [
    "upgrade requests delete admin",
    "upgrade requests insert self",
    "upgrade requests select self",
    "upgrade requests update admin",
  ],
  provider_settings: ["provider settings admin read", "provider settings admin write"],
  provider_payment_events: [
    "provider events select self",
    "provider events admin read",
    "provider events insert self",
    "provider events update self",
    "provider events admin update",
  ],
};

export async function GET(request: Request) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
    accessToken: bearerToken,
  });
  if (!auth.ok) return auth.response;

  const supabase = auth.supabase;
  const results: Record<string, unknown> = {};
  const issues: string[] = [];

  const { data: metadata, error: metaError } = await supabase.rpc("debug_rls_status");
  if (metaError) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: metaError,
    });
    issues.push("debug_rls_status rpc failed");
    results.metadata_error = metaError.message;
  } else {
    results.metadata = metadata;

    const rls = metadata?.rls;
    const policies = metadata?.policies;
    const columns = metadata?.columns;

    const rlsTables = [
      "profiles",
      "properties",
      "property_images",
      "saved_properties",
      "saved_searches",
      "saved_search_alerts",
      "messages",
      "viewing_requests",
      "agent_delegations",
      "profile_plans",
      "profile_billing_notes",
      "plan_upgrade_requests",
      "provider_settings",
      "provider_payment_events",
    ];
    rlsTables.forEach((table) => {
      if (!rls?.[table]?.enabled) {
        issues.push(`rls disabled: ${table}`);
      }
    });

    Object.entries(requiredPolicies).forEach(([table, required]) => {
      const existing = (policies?.[table] as string[]) || [];
      required.forEach((policy) => {
        if (!existing.includes(policy)) {
          issues.push(`missing policy: ${table}.${policy}`);
        }
      });
    });

    if (!columns?.profiles?.id) issues.push("missing column: profiles.id");
    if (!columns?.properties?.owner_id) issues.push("missing column: properties.owner_id");
    if (!columns?.properties?.is_approved) issues.push("missing column: properties.is_approved");
    if (!columns?.properties?.is_active) issues.push("missing column: properties.is_active");
    if (!columns?.properties?.status) issues.push("missing column: properties.status");
    if (!columns?.properties?.rejection_reason) issues.push("missing column: properties.rejection_reason");
    if (!columns?.property_images?.position) issues.push("missing column: property_images.position");
    if (!columns?.saved_properties?.user_id) issues.push("missing column: saved_properties.user_id");
    if (!columns?.saved_properties?.property_id) issues.push("missing column: saved_properties.property_id");
    if (!columns?.saved_searches?.user_id) issues.push("missing column: saved_searches.user_id");
    if (!columns?.saved_searches?.query_params) issues.push("missing column: saved_searches.query_params");
    if (!columns?.saved_search_alerts?.user_id) issues.push("missing column: saved_search_alerts.user_id");
    if (!columns?.saved_search_alerts?.saved_search_id) {
      issues.push("missing column: saved_search_alerts.saved_search_id");
    }
    if (!columns?.saved_search_alerts?.property_id) {
      issues.push("missing column: saved_search_alerts.property_id");
    }
    if (!columns?.saved_search_alerts?.status) {
      issues.push("missing column: saved_search_alerts.status");
    }
    if (!columns?.messages?.sender_id) issues.push("missing column: messages.sender_id");
    if (!columns?.messages?.recipient_id) issues.push("missing column: messages.recipient_id");
    if (!columns?.viewing_requests?.tenant_id) issues.push("missing column: viewing_requests.tenant_id");
    if (!columns?.viewing_requests?.property_id) issues.push("missing column: viewing_requests.property_id");
    if (!columns?.agent_delegations?.agent_id) issues.push("missing column: agent_delegations.agent_id");
    if (!columns?.agent_delegations?.landlord_id) issues.push("missing column: agent_delegations.landlord_id");
    if (!columns?.agent_delegations?.status) issues.push("missing column: agent_delegations.status");
    if (!columns?.profile_plans?.profile_id) issues.push("missing column: profile_plans.profile_id");
    if (!columns?.profile_plans?.plan_tier) issues.push("missing column: profile_plans.plan_tier");
    if (!columns?.profile_plans?.max_listings_override) {
      issues.push("missing column: profile_plans.max_listings_override");
    }
    if (!columns?.profile_plans?.billing_source) {
      issues.push("missing column: profile_plans.billing_source");
    }
    if (!columns?.profile_plans?.valid_until) {
      issues.push("missing column: profile_plans.valid_until");
    }
    if (!columns?.profile_plans?.stripe_customer_id) {
      issues.push("missing column: profile_plans.stripe_customer_id");
    }
    if (!columns?.profile_plans?.stripe_subscription_id) {
      issues.push("missing column: profile_plans.stripe_subscription_id");
    }
    if (!columns?.profile_plans?.stripe_price_id) {
      issues.push("missing column: profile_plans.stripe_price_id");
    }
    if (!columns?.profile_plans?.stripe_current_period_end) {
      issues.push("missing column: profile_plans.stripe_current_period_end");
    }
    if (!columns?.profile_plans?.stripe_status) {
      issues.push("missing column: profile_plans.stripe_status");
    }
    if (!columns?.profile_billing_notes?.profile_id) {
      issues.push("missing column: profile_billing_notes.profile_id");
    }
    if (!columns?.profile_billing_notes?.billing_notes) {
      issues.push("missing column: profile_billing_notes.billing_notes");
    }
    if (!columns?.plan_upgrade_requests?.profile_id) {
      issues.push("missing column: plan_upgrade_requests.profile_id");
    }
    if (!columns?.plan_upgrade_requests?.requester_id) {
      issues.push("missing column: plan_upgrade_requests.requester_id");
    }
    if (!columns?.plan_upgrade_requests?.status) {
      issues.push("missing column: plan_upgrade_requests.status");
    }
    if (!columns?.provider_settings?.stripe_mode) {
      issues.push("missing column: provider_settings.stripe_mode");
    }
    if (!columns?.provider_settings?.paystack_mode) {
      issues.push("missing column: provider_settings.paystack_mode");
    }
    if (!columns?.provider_settings?.flutterwave_mode) {
      issues.push("missing column: provider_settings.flutterwave_mode");
    }
    if (!columns?.provider_settings?.paystack_test_secret_key) {
      issues.push("missing column: provider_settings.paystack_test_secret_key");
    }
    if (!columns?.provider_settings?.paystack_live_secret_key) {
      issues.push("missing column: provider_settings.paystack_live_secret_key");
    }
    if (!columns?.provider_settings?.paystack_test_public_key) {
      issues.push("missing column: provider_settings.paystack_test_public_key");
    }
    if (!columns?.provider_settings?.paystack_live_public_key) {
      issues.push("missing column: provider_settings.paystack_live_public_key");
    }
    if (!columns?.provider_settings?.flutterwave_test_secret_key) {
      issues.push("missing column: provider_settings.flutterwave_test_secret_key");
    }
    if (!columns?.provider_settings?.flutterwave_live_secret_key) {
      issues.push("missing column: provider_settings.flutterwave_live_secret_key");
    }
    if (!columns?.provider_settings?.flutterwave_test_public_key) {
      issues.push("missing column: provider_settings.flutterwave_test_public_key");
    }
    if (!columns?.provider_settings?.flutterwave_live_public_key) {
      issues.push("missing column: provider_settings.flutterwave_live_public_key");
    }
    if (!columns?.provider_payment_events?.provider) {
      issues.push("missing column: provider_payment_events.provider");
    }
    if (!columns?.provider_payment_events?.mode) {
      issues.push("missing column: provider_payment_events.mode");
    }
    if (!columns?.provider_payment_events?.reference) {
      issues.push("missing column: provider_payment_events.reference");
    }
    if (!columns?.provider_payment_events?.status) {
      issues.push("missing column: provider_payment_events.status");
    }
    if (!columns?.provider_payment_events?.plan_tier) {
      issues.push("missing column: provider_payment_events.plan_tier");
    }
    if (!columns?.provider_payment_events?.profile_id) {
      issues.push("missing column: provider_payment_events.profile_id");
    }
    if (!columns?.provider_payment_events?.cadence) {
      issues.push("missing column: provider_payment_events.cadence");
    }
    if (!columns?.provider_payment_events?.amount) {
      issues.push("missing column: provider_payment_events.amount");
    }
    if (!columns?.provider_payment_events?.currency) {
      issues.push("missing column: provider_payment_events.currency");
    }
    if (!columns?.provider_payment_events?.transaction_id) {
      issues.push("missing column: provider_payment_events.transaction_id");
    }
    if (!columns?.provider_payment_events?.processed_at) {
      issues.push("missing column: provider_payment_events.processed_at");
    }
  }

  const publicProps = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("is_approved", true)
    .eq("is_active", true);
  results.public_properties = {
    count: publicProps.count ?? 0,
    error: publicProps.error?.message ?? null,
  };

  const ownerProps = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", auth.user.id);
  results.owner_properties = {
    count: ownerProps.count ?? 0,
    error: ownerProps.error?.message ?? null,
  };

  const saved = await supabase
    .from("saved_properties")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  results.saved_properties = {
    count: saved.count ?? 0,
    error: saved.error?.message ?? null,
  };

  const searches = await supabase
    .from("saved_searches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  results.saved_searches = {
    count: searches.count ?? 0,
    error: searches.error?.message ?? null,
  };

  const alerts = await supabase
    .from("saved_search_alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  results.saved_search_alerts = {
    count: alerts.count ?? 0,
    error: alerts.error?.message ?? null,
  };

  return NextResponse.json({ ok: issues.length === 0, issues, results });
}
