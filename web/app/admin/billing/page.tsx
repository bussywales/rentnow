import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ErrorState } from "@/components/ui/ErrorState";
import { UpgradeRequestsQueue } from "@/components/admin/UpgradeRequestsQueue";
import { BillingOpsActions } from "@/components/admin/BillingOpsActions";
import { PaymentModeBadge } from "@/components/billing/PaymentModeBadge";
import {
  buildAdminBillingLookupHref,
  normalizeAdminBillingLookupParams,
  resolveAdminBillingLookupIdentity,
} from "@/lib/billing/admin-billing-lookup";
import {
  buildBillingOpsDiagnostics,
  isReplayEligibleStripeEvent,
  type BillingSubscriptionRow,
} from "@/lib/billing/admin-billing-diagnostics";
import { buildBillingSnapshot, type BillingSnapshot } from "@/lib/billing/snapshot";
import { SupportSnapshotCopy } from "@/components/admin/SupportSnapshotCopy";
import { buildSupportSnapshot } from "@/lib/billing/support-snapshot";
import { maskEmail, maskIdentifier } from "@/lib/billing/mask";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { logProviderEventsViewed, logStripeEventsViewed } from "@/lib/observability";
import { formatRoleLabel } from "@/lib/roles";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type SearchParamsInput = SearchParams | Promise<SearchParams>;

type UpgradeRequest = {
  id: string;
  profile_id: string;
  requester_id: string;
  requested_plan_tier: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type AdminUser = {
  id: string;
  full_name: string | null;
};

type PlanRow = {
  profile_id: string;
  plan_tier: string | null;
  billing_source: string | null;
  valid_until: string | null;
  stripe_status: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

type StripeEventRow = {
  event_id: string;
  event_type: string;
  created_at: string;
  status?: string | null;
  reason?: string | null;
  mode?: string | null;
  plan_tier?: string | null;
  profile_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  processed_at?: string | null;
  replay_count?: number | null;
  last_replay_at?: string | null;
  last_replay_status?: string | null;
  last_replay_reason?: string | null;
};

type ProviderEventRow = {
  provider: string;
  reference: string;
  event_type: string;
  status: string;
  reason?: string | null;
  mode: string;
  plan_tier: string;
  profile_id: string;
  transaction_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  created_at: string;
  processed_at?: string | null;
};

type SupportAccount = {
  profile_id: string;
  role: string | null;
  plan_tier: string | null;
  billing_source: string | null;
  valid_until: string | null;
  stripe_status: string | null;
  pending_requests: number;
  last_event_status: string | null;
  last_event_at: string | null;
  email: string | null;
};

const STATUS_OPTIONS = ["all", "ok", "ignored", "failed"] as const;
const RANGE_OPTIONS = ["24h", "7d", "30d", "all"] as const;
const PLAN_OPTIONS = ["all", "free", "starter", "pro", "tenant_pro"] as const;
const TRIAGE_OPTIONS = ["pending", "manual", "stripe", "expired", "attention"] as const;
const MODE_OPTIONS = ["all", "test", "live"] as const;
const PAGE_SIZE = 50;
const PROVIDER_OPTIONS = ["all", "paystack", "flutterwave"] as const;
const PROVIDER_STATUS_OPTIONS = ["all", "initialized", "verified", "failed", "skipped"] as const;
const PROVIDER_RANGE_OPTIONS = ["24h", "7d", "30d", "all"] as const;

function parseParam(params: SearchParams, key: string) {
  const value = params[key];
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function resolveStartDate(range: string) {
  const now = Date.now();
  if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}

function severityClasses(level: "info" | "warn" | "error") {
  if (level === "error") return "border-rose-200 bg-rose-50 text-rose-800";
  if (level === "warn") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-cyan-200 bg-cyan-50 text-cyan-800";
}

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/billing&reason=auth");
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/billing&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");
}

async function loadBillingSnapshot({
  email,
  profileId,
}: {
  email?: string;
  profileId?: string;
}): Promise<{ snapshot: BillingSnapshot | null; plan?: PlanRow | null; error?: string }> {
  if (!hasServiceRoleEnv()) {
    return { snapshot: null, error: "Service role key missing; billing snapshot unavailable." };
  }

  const adminClient = createServiceRoleClient();
  let userId: string | null = null;
  let userEmail: string | null = null;
  let userFullName: string | null = null;
  let userRole: string | null = null;

  const identity = await resolveAdminBillingLookupIdentity({
    adminClient,
    email,
    profileId,
  });
  if (!identity.ok) {
    return { snapshot: null, error: identity.error };
  }
  userId = identity.profileId;
  userEmail = identity.email;

  if (!isValidUuid(userId)) {
    return { snapshot: null, error: "Profile ID must be a valid UUID." };
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .maybeSingle();
  userFullName = (profile as { full_name?: string | null } | null)?.full_name ?? null;
  userRole = (profile as { role?: string | null } | null)?.role ?? null;

  const { data: plan } = await adminClient
    .from("profile_plans")
    .select(
      "profile_id, plan_tier, billing_source, valid_until, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_current_period_end, stripe_status, updated_at, upgraded_at, updated_by, upgraded_by"
    )
    .eq("profile_id", userId)
    .maybeSingle();

  const { data: notes } = await adminClient
    .from("profile_billing_notes")
    .select("billing_notes, updated_at, updated_by")
    .eq("profile_id", userId)
    .maybeSingle();

  return {
    snapshot: buildBillingSnapshot({
      profileId: userId,
      email: userEmail,
      role: userRole,
      fullName: userFullName,
      plan: (plan as Record<string, string | null> | null) ?? null,
      notes: (notes as { billing_notes?: string | null; updated_at?: string | null; updated_by?: string | null } | null) ?? null,
    }),
    plan: (plan as PlanRow | null) ?? null,
  };
}

async function loadUpgradeRequests(): Promise<{ requests: UpgradeRequest[]; users: AdminUser[] }> {
  if (!hasServiceRoleEnv()) return { requests: [], users: [] };

  const adminClient = createServiceRoleClient();
  const { data: requests } = await adminClient
    .from("plan_upgrade_requests")
    .select("id, profile_id, requester_id, requested_plan_tier, status, notes, created_at")
    .order("created_at", { ascending: false });

  const requestRows = (requests as UpgradeRequest[]) || [];
  const ids = Array.from(
    new Set(requestRows.flatMap((request) => [request.profile_id, request.requester_id]).filter(Boolean))
  );
  const { data: users } = await adminClient
    .from("profiles")
    .select("id, full_name")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  return {
    requests: requestRows,
    users: (users as AdminUser[]) || [],
  };
}

async function loadUserEvents({
  profileId,
  plan,
}: {
  profileId: string;
  plan?: PlanRow | null;
}): Promise<{ events: StripeEventRow[]; error?: string }> {
  if (!hasServiceRoleEnv()) {
    return { events: [], error: "Service role key missing; user events unavailable." };
  }

  const adminClient = createServiceRoleClient();
  const adminDb = adminClient as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        order: (column: string, options?: { ascending?: boolean }) => {
          limit: (count: number) => {
            or: (filters: string) => Promise<{ data: unknown[] | null; error: { message?: string } | null }>;
          };
        };
      };
    };
  };

  const filters = [`profile_id.eq.${profileId}`];
  if (plan?.stripe_customer_id) filters.push(`stripe_customer_id.eq.${plan.stripe_customer_id}`);
  if (plan?.stripe_subscription_id) filters.push(`stripe_subscription_id.eq.${plan.stripe_subscription_id}`);

  const { data, error } = await adminDb
    .from("stripe_webhook_events")
    .select(
      "event_id, event_type, created_at, status, reason, mode, plan_tier, profile_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, processed_at, replay_count, last_replay_at, last_replay_status, last_replay_reason"
    )
    .order("created_at", { ascending: false })
    .limit(10)
    .or(filters.join(","));

  if (error) {
    return { events: [], error: error.message || "Unable to load user events." };
  }

  return { events: (data as StripeEventRow[]) || [] };
}

async function loadUserSubscriptions(profileId: string): Promise<{ rows: BillingSubscriptionRow[]; error?: string }> {
  if (!hasServiceRoleEnv()) {
    return { rows: [], error: "Service role key missing; provider subscription state unavailable." };
  }

  const adminClient = createServiceRoleClient();
  const { data, error } = await adminClient
    .from("subscriptions")
    .select(
      "provider, provider_subscription_id, status, plan_tier, role, current_period_start, current_period_end, canceled_at, created_at, updated_at"
    )
    .eq("user_id", profileId)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(5);

  if (error) {
    return { rows: [], error: error.message || "Unable to load provider subscriptions." };
  }

  return { rows: (data as BillingSubscriptionRow[]) || [] };
}

async function loadSupportQueue(filter: string): Promise<{ accounts: SupportAccount[]; error?: string }> {
  if (!hasServiceRoleEnv()) {
    return { accounts: [], error: "Service role key missing; support queue unavailable." };
  }

  const adminClient = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  const pendingMap = new Map<string, number>();
  let profileIds: string[] = [];
  let planRows: PlanRow[] = [];
  const eventStatusMap = new Map<string, { status: string | null; created_at: string | null }>();

  if (filter === "pending") {
    const { data: pending } = await adminClient
      .from("plan_upgrade_requests")
      .select("profile_id")
      .eq("status", "pending");
    (pending || []).forEach((row) => {
      const profileId = (row as { profile_id?: string | null }).profile_id;
      if (!profileId) return;
      pendingMap.set(profileId, (pendingMap.get(profileId) || 0) + 1);
    });
    profileIds = Array.from(pendingMap.keys()).slice(0, 50);
  }

  if (filter === "manual" || filter === "stripe") {
    const { data: plans } = await adminClient
      .from("profile_plans")
      .select("profile_id, plan_tier, billing_source, valid_until, stripe_status")
      .eq("billing_source", filter)
      .order("updated_at", { ascending: false })
      .limit(50);
    planRows = (plans as PlanRow[]) || [];
    profileIds = planRows.map((row) => row.profile_id);
  }

  if (filter === "expired") {
    const { data: plans } = await adminClient
      .from("profile_plans")
      .select("profile_id, plan_tier, billing_source, valid_until, stripe_status")
      .lt("valid_until", nowIso)
      .order("valid_until", { ascending: true })
      .limit(50);
    planRows = (plans as PlanRow[]) || [];
    profileIds = planRows.map((row) => row.profile_id);
  }

  if (filter === "attention") {
    const { data: plans } = await adminClient
      .from("profile_plans")
      .select("profile_id, plan_tier, billing_source, valid_until, stripe_status")
      .or(`valid_until.lt.${nowIso},stripe_status.in.(past_due,unpaid,canceled)`)
      .order("updated_at", { ascending: false })
      .limit(50);
    planRows = (plans as PlanRow[]) || [];

    const { data: eventRows } = await adminClient
      .from("stripe_webhook_events")
      .select("profile_id, status, created_at")
      .in("status", ["failed", "error"])
      .order("created_at", { ascending: false })
      .limit(50);
    (eventRows || []).forEach((row) => {
      const profileId = (row as { profile_id?: string | null }).profile_id;
      if (!profileId || eventStatusMap.has(profileId)) return;
      eventStatusMap.set(profileId, {
        status: (row as { status?: string | null }).status ?? null,
        created_at: (row as { created_at?: string | null }).created_at ?? null,
      });
    });

    profileIds = Array.from(
      new Set([...planRows.map((row) => row.profile_id), ...eventStatusMap.keys()])
    ).slice(0, 50);
  }

  if (!profileIds.length) return { accounts: [] };

  if (!planRows.length) {
    const { data: plans } = await adminClient
      .from("profile_plans")
      .select("profile_id, plan_tier, billing_source, valid_until, stripe_status")
      .in("profile_id", profileIds)
      .limit(50);
    planRows = (plans as PlanRow[]) || [];
  }

  const { data: roles } = await adminClient
    .from("profiles")
    .select("id, role")
    .in("id", profileIds);
  const roleMap = new Map(
    (roles || []).map((row) => [(row as { id: string }).id, (row as { role?: string | null }).role ?? null])
  );

  const { data: pendingRows } = await adminClient
    .from("plan_upgrade_requests")
    .select("profile_id, status")
    .eq("status", "pending")
    .in("profile_id", profileIds);
  (pendingRows || []).forEach((row) => {
    const profileId = (row as { profile_id?: string | null }).profile_id;
    if (!profileId) return;
    pendingMap.set(profileId, (pendingMap.get(profileId) || 0) + 1);
  });

  const { data: users } = await adminClient.auth.admin.listUsers({ perPage: 200 });
  const emailMap = new Map(
    (users?.users || []).map((user) => [user.id, user.email ?? null])
  );

  const accounts = planRows.map((row) => ({
    profile_id: row.profile_id,
    role: roleMap.get(row.profile_id) ?? null,
    plan_tier: row.plan_tier ?? null,
    billing_source: row.billing_source ?? null,
    valid_until: row.valid_until ?? null,
    stripe_status: row.stripe_status ?? null,
    pending_requests: pendingMap.get(row.profile_id) ?? 0,
    last_event_status: eventStatusMap.get(row.profile_id)?.status ?? null,
    last_event_at: eventStatusMap.get(row.profile_id)?.created_at ?? null,
    email: emailMap.get(row.profile_id) ?? null,
  }));

  return { accounts };
}

async function loadEvents(params: SearchParams): Promise<{ events: StripeEventRow[]; error?: string }> {
  if (!hasServiceRoleEnv()) {
    return { events: [], error: "Service role key missing for billing events." };
  }

  const statusFilter = parseParam(params, "status") || "all";
  const planFilter = parseParam(params, "plan") || "all";
  const modeFilter = parseParam(params, "mode") || "all";
  const rangeFilter = parseParam(params, "range") || "7d";
  const query = parseParam(params, "q").trim();
  const pageParam = Number.parseInt(parseParam(params, "page") || "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const adminClient = createServiceRoleClient();
  const adminDb = adminClient as unknown as UntypedAdminClient;
  let eventsQuery = adminDb
    .from<StripeEventRow>("stripe_webhook_events")
    .select(
      "event_id, event_type, created_at, status, reason, mode, plan_tier, profile_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, processed_at"
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter !== "all") {
    if (statusFilter === "ok") {
      eventsQuery = eventsQuery.in("status", ["processed", "ok"]);
    } else if (statusFilter === "failed") {
      eventsQuery = eventsQuery.in("status", ["failed", "error"]);
    } else {
      eventsQuery = eventsQuery.eq("status", statusFilter);
    }
  }
  if (planFilter !== "all") {
    eventsQuery = eventsQuery.eq("plan_tier", planFilter);
  }
  if (modeFilter !== "all") {
    eventsQuery = eventsQuery.eq("mode", modeFilter);
  }
  const startDate = resolveStartDate(rangeFilter);
  if (startDate) {
    eventsQuery = eventsQuery.gte("created_at", startDate.toISOString());
  }

  const { data, error } = await eventsQuery;
  if (error) {
    const message = error.message?.includes("stripe_webhook_events")
      ? "Stripe events table missing. Apply migration 015_stripe_webhook_events.sql (and 018_stripe_webhook_event_metadata.sql if available)."
      : error.message || "Unable to load billing events.";
    return { events: [], error: message };
  }

  let events = (data as StripeEventRow[]) || [];
  if (query) {
    const lower = query.toLowerCase();
    events = events.filter(
      (event) =>
        event.event_id?.toLowerCase().includes(lower) ||
        event.event_type?.toLowerCase().includes(lower) ||
        event.stripe_customer_id?.toLowerCase().includes(lower) ||
        event.stripe_subscription_id?.toLowerCase().includes(lower) ||
        event.stripe_price_id?.toLowerCase().includes(lower) ||
        event.profile_id?.toLowerCase().includes(lower)
    );
  }

  logStripeEventsViewed({
    route: "/admin/billing",
    mode: modeFilter,
    status: statusFilter,
    plan: planFilter,
    range: rangeFilter,
    query: query || null,
    page,
  });

  return { events, error: undefined };
}

async function loadProviderEvents(
  params: SearchParams
): Promise<{ events: ProviderEventRow[]; error?: string }> {
  if (!hasServiceRoleEnv()) {
    return { events: [], error: "Service role key missing for provider events." };
  }

  const providerFilter = parseParam(params, "provider") || "all";
  const statusFilter = parseParam(params, "provider_status") || "all";
  const modeFilter = parseParam(params, "provider_mode") || "all";
  const rangeFilter = parseParam(params, "provider_range") || "7d";
  const query = parseParam(params, "provider_q").trim();
  const pageParam = Number.parseInt(parseParam(params, "provider_page") || "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const adminClient = createServiceRoleClient();
  let eventsQuery = adminClient
    .from("provider_payment_events")
    .select(
      "provider, reference, event_type, status, reason, mode, plan_tier, profile_id, transaction_id, amount, currency, created_at, processed_at"
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (providerFilter !== "all") {
    eventsQuery = eventsQuery.eq("provider", providerFilter);
  }
  if (statusFilter !== "all") {
    eventsQuery = eventsQuery.eq("status", statusFilter);
  }
  if (modeFilter !== "all") {
    eventsQuery = eventsQuery.eq("mode", modeFilter);
  }
  const startDate = resolveStartDate(rangeFilter);
  if (startDate) {
    eventsQuery = eventsQuery.gte("created_at", startDate.toISOString());
  }

  const { data, error } = await eventsQuery;
  if (error) {
    const message = error.message?.includes("provider_payment_events")
      ? "Provider payment events table missing. Apply migration 022_provider_payment_events.sql."
      : error.message || "Unable to load provider events.";
    return { events: [], error: message };
  }

  let events = (data as ProviderEventRow[]) || [];
  if (query) {
    const lower = query.toLowerCase();
    events = events.filter(
      (event) =>
        event.reference?.toLowerCase().includes(lower) ||
        event.transaction_id?.toLowerCase().includes(lower) ||
        event.profile_id?.toLowerCase().includes(lower) ||
        event.plan_tier?.toLowerCase().includes(lower)
    );
  }

  logProviderEventsViewed({
    route: "/admin/billing",
    provider: providerFilter,
    mode: modeFilter,
    status: statusFilter,
    range: rangeFilter,
    query: query || null,
    page,
  });

  return { events, error: undefined };
}

async function switchStripeToTest() {
  "use server";
  if (!hasServerSupabaseEnv()) return;
  const { supabase, user } = await getServerAuthUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return;

  await supabase.from("provider_settings").upsert(
    {
      id: "default",
      stripe_mode: "test",
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "id" }
  );

  revalidatePath("/admin/billing");
  revalidatePath("/admin/settings/billing");
}

export default async function AdminBillingPage({ searchParams }: { searchParams?: SearchParamsInput }) {
  await requireAdmin();

  const resolvedSearchParams = searchParams ? await searchParams : {};

  const providerModes = await getProviderModes();
  const stripeMode = providerModes.stripeMode;
  const stripeLiveSecretReady = Boolean(process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY);
  const stripeLiveWebhookReady = Boolean(
    process.env.STRIPE_BILLING_WEBHOOK_SECRET_LIVE ||
      process.env.STRIPE_BILLING_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET_LIVE ||
      process.env.STRIPE_WEBHOOK_SECRET
  );
  const stripeLiveReady = stripeLiveSecretReady && stripeLiveWebhookReady;
  const rawEmail = parseParam(resolvedSearchParams, "email");
  const rawProfileId = parseParam(resolvedSearchParams, "profileId");
  const lookupInput = normalizeAdminBillingLookupParams({
    email: rawEmail,
    profileId: rawProfileId,
  });
  const email = lookupInput.email;
  const profileIdParam = lookupInput.profileId;
  const triageParam = parseParam(resolvedSearchParams, "triage");
  const triage = TRIAGE_OPTIONS.includes(triageParam as (typeof TRIAGE_OPTIONS)[number])
    ? triageParam
    : "pending";
  const rawStatusFilter = parseParam(resolvedSearchParams, "status") || "all";
  const statusFilter = rawStatusFilter === "processed" ? "ok" : rawStatusFilter;
  const planFilter = parseParam(resolvedSearchParams, "plan") || "all";
  const modeFilter = parseParam(resolvedSearchParams, "mode") || stripeMode;
  const rangeFilter = parseParam(resolvedSearchParams, "range") || "7d";
  const query = parseParam(resolvedSearchParams, "q");
  const pageParam = Number.parseInt(parseParam(resolvedSearchParams, "page") || "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const providerNameParam = parseParam(resolvedSearchParams, "provider");
  const providerStatusParam = parseParam(resolvedSearchParams, "provider_status");
  const providerModeParam = parseParam(resolvedSearchParams, "provider_mode");
  const providerRangeParam = parseParam(resolvedSearchParams, "provider_range");
  const providerQuery = parseParam(resolvedSearchParams, "provider_q");
  const providerPageParam = Number.parseInt(parseParam(resolvedSearchParams, "provider_page") || "1", 10);
  const providerPage = Number.isFinite(providerPageParam) && providerPageParam > 0 ? providerPageParam : 1;

  const providerFilter = PROVIDER_OPTIONS.includes(providerNameParam as (typeof PROVIDER_OPTIONS)[number])
    ? providerNameParam
    : "all";
  const providerStatusFilter = PROVIDER_STATUS_OPTIONS.includes(
    providerStatusParam as (typeof PROVIDER_STATUS_OPTIONS)[number]
  )
    ? providerStatusParam
    : "all";
  const providerModeFilter = MODE_OPTIONS.includes(providerModeParam as (typeof MODE_OPTIONS)[number])
    ? providerModeParam
    : "all";
  const providerRangeFilter = PROVIDER_RANGE_OPTIONS.includes(
    providerRangeParam as (typeof PROVIDER_RANGE_OPTIONS)[number]
  )
    ? providerRangeParam
    : "7d";

  const snapshotResult =
    lookupInput.hasLookupInput
      ? await loadBillingSnapshot({
          email: email || undefined,
          profileId: profileIdParam || undefined,
        })
      : { snapshot: null };
  const lookupError =
    lookupInput.hasLookupInput && !snapshotResult.snapshot
      ? snapshotResult.error || "No billing snapshot was loaded for the supplied lookup."
      : null;
  const { requests, users } = await loadUpgradeRequests();
  const { events, error } = await loadEvents({
    ...resolvedSearchParams,
    mode: modeFilter,
    page: String(page),
  });
  const { events: providerEvents, error: providerEventsError } = await loadProviderEvents({
    ...resolvedSearchParams,
    provider: providerFilter,
    provider_status: providerStatusFilter,
    provider_mode: providerModeFilter,
    provider_range: providerRangeFilter,
    provider_q: providerQuery,
    provider_page: String(providerPage),
  });
  const { accounts: supportAccounts, error: supportError } = await loadSupportQueue(triage);
  const userEventsResult = snapshotResult.snapshot
    ? await loadUserEvents({ profileId: snapshotResult.snapshot.profileId, plan: snapshotResult.plan ?? null })
    : { events: [] };
  const userSubscriptionsResult = snapshotResult.snapshot
    ? await loadUserSubscriptions(snapshotResult.snapshot.profileId)
    : { rows: [] };
  const billingDiagnostics = snapshotResult.snapshot
    ? buildBillingOpsDiagnostics({
        snapshot: snapshotResult.snapshot,
        plan: snapshotResult.plan ?? null,
        subscriptionRows: userSubscriptionsResult.rows,
        events: userEventsResult.events,
        billingNotes: snapshotResult.snapshot.billingNotes,
      })
    : null;
  const replayableUserEvents = userEventsResult.events.filter(
    (event): event is StripeEventRow & { event_id: string; event_type: string } =>
      isReplayEligibleStripeEvent(event) && typeof event.event_id === "string" && typeof event.event_type === "string"
  );

  const openRequests = snapshotResult.snapshot
    ? requests.filter((request) => request.profile_id === snapshotResult.snapshot?.profileId && request.status === "pending").length
    : 0;

  const supportSnapshot = snapshotResult.snapshot
    ? buildSupportSnapshot({
        snapshot: snapshotResult.snapshot,
        openUpgradeRequests: openRequests,
        events: userEventsResult.events.map((event) => ({
          event_type: event.event_type ?? null,
          status: event.status ?? null,
          reason: event.reason ?? null,
          mode: event.mode ?? null,
          created_at: event.created_at ?? null,
          processed_at: event.processed_at ?? null,
          event_id: event.event_id ?? null,
          stripe_customer_id: event.stripe_customer_id ?? null,
          stripe_subscription_id: event.stripe_subscription_id ?? null,
          stripe_price_id: event.stripe_price_id ?? null,
        })),
      })
    : null;

  const triageParams = new URLSearchParams();
  if (email) triageParams.set("email", email);
  if (profileIdParam) triageParams.set("profileId", profileIdParam);
  const triageHref = (value: string) => {
    const params = new URLSearchParams(triageParams);
    params.set("triage", value);
    return `/admin/billing?${params.toString()}#support-queue`;
  };
  const lookupHref = (profileId: string, lookupEmail?: string | null) =>
    buildAdminBillingLookupHref({ profileId, email: lookupEmail });
  const eventParams = new URLSearchParams();
  if (email) eventParams.set("email", email);
  if (profileIdParam) eventParams.set("profileId", profileIdParam);
  if (modeFilter) eventParams.set("mode", modeFilter);
  if (statusFilter) eventParams.set("status", statusFilter);
  if (planFilter) eventParams.set("plan", planFilter);
  if (rangeFilter) eventParams.set("range", rangeFilter);
  if (query) eventParams.set("q", query);
  const nextPageHref = (() => {
    if (events.length < PAGE_SIZE) return null;
    const params = new URLSearchParams(eventParams);
    params.set("page", String(page + 1));
    return `/admin/billing?${params.toString()}#events`;
  })();
  const prevPageHref = page > 1 ? (() => {
    const params = new URLSearchParams(eventParams);
    params.set("page", String(page - 1));
    return `/admin/billing?${params.toString()}#events`;
  })() : null;

  const providerEventParams = new URLSearchParams();
  if (email) providerEventParams.set("email", email);
  if (profileIdParam) providerEventParams.set("profileId", profileIdParam);
  if (providerFilter) providerEventParams.set("provider", providerFilter);
  if (providerStatusFilter) providerEventParams.set("provider_status", providerStatusFilter);
  if (providerModeFilter) providerEventParams.set("provider_mode", providerModeFilter);
  if (providerRangeFilter) providerEventParams.set("provider_range", providerRangeFilter);
  if (providerQuery) providerEventParams.set("provider_q", providerQuery);
  const providerNextPageHref = (() => {
    if (providerEvents.length < PAGE_SIZE) return null;
    const params = new URLSearchParams(providerEventParams);
    params.set("provider_page", String(providerPage + 1));
    return `/admin/billing?${params.toString()}#provider-events`;
  })();
  const providerPrevPageHref =
    providerPage > 1
      ? (() => {
          const params = new URLSearchParams(providerEventParams);
          params.set("provider_page", String(providerPage - 1));
          return `/admin/billing?${params.toString()}#provider-events`;
        })()
      : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Billing ops</p>
        <p className="text-sm text-slate-200">
          Diagnose plan issues, manage manual overrides, and audit Stripe events.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-200">
          <PaymentModeBadge mode={stripeMode} />
          {!stripeLiveReady && stripeMode === "live" && (
            <span className="rounded-full bg-amber-500/20 px-2 py-1 text-amber-200">Live keys missing</span>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-200">
          {stripeMode === "test"
            ? "You are in TEST mode. No real charges will be made."
            : "LIVE mode enabled."}
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/admin" className="underline underline-offset-4">
            Back to Admin
          </Link>
          <Link href="/admin/users" className="underline underline-offset-4">
            User management
          </Link>
          <Link href="/admin/settings/billing" className="underline underline-offset-4">
            Provider settings
          </Link>
        </div>
      </div>

      {stripeMode === "live" && !stripeLiveReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Live Stripe mode is missing keys</p>
              <p className="text-xs text-amber-800">
                Add live keys in the environment or switch back to test mode to avoid webhook failures.
              </p>
            </div>
            <form action={switchStripeToTest}>
              <button className="rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white">
                Switch to test mode
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">User billing lookup</h2>
          <p className="text-sm text-slate-600">
            Search by email to view a billing snapshot. Stripe IDs are masked for safety.
          </p>
          <form className="mt-3 flex flex-wrap items-center gap-2" action="/admin/billing" method="get">
            <input
              name="email"
              placeholder="user@email.com"
              defaultValue={email}
              className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
            <input
              name="profileId"
              placeholder="profile uuid"
              defaultValue={profileIdParam}
              className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              Search
            </button>
          </form>

          {!lookupInput.hasLookupInput && (
            <p className="mt-4 text-sm text-slate-500">
              Enter an email or profile ID to load the billing snapshot and admin actions.
            </p>
          )}

          {lookupError && (
            <div className="mt-4">
              <ErrorState
                title="Lookup failed"
                description={lookupError}
                retryLabel="Back to Admin"
                retryHref="/admin"
              />
            </div>
          )}

          {snapshotResult.snapshot && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {snapshotResult.snapshot.fullName || snapshotResult.snapshot.email || "Account loaded"}
                  </p>
                  <p className="text-xs text-slate-500">{snapshotResult.snapshot.email || "Email unavailable"}</p>
                  <p className="text-xs text-slate-500">
                    Profile UUID: {snapshotResult.snapshot.profileId} • Role: {formatRoleLabel(snapshotResult.snapshot.role)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-white">
                    {snapshotResult.snapshot.effectivePlanTier.replace("_", " ")}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 ${
                      snapshotResult.snapshot.manualOverrideActive
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {snapshotResult.snapshot.manualOverrideActive ? "Manual override active" : "Provider-owned billing"}
                  </span>
                  {billingDiagnostics?.hasStoredStripeTruth && (
                    <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-800">Stored Stripe truth present</span>
                  )}
                  {billingDiagnostics?.stateMatchesProviderTruth === false && (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">Provider mismatch</span>
                  )}
                  {billingDiagnostics?.hasIdentityMismatch && (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">Identity mismatch</span>
                  )}
                  {snapshotResult.snapshot.isExpired && (
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">Expired</span>
                  )}
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-400">Current access</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {snapshotResult.snapshot.effectivePlanTier.replace("_", " ")}
                  </p>
                  {snapshotResult.snapshot.isExpired &&
                  snapshotResult.snapshot.planTier !== snapshotResult.snapshot.effectivePlanTier ? (
                    <p className="mt-1 text-xs text-rose-600">
                      Previous override: {snapshotResult.snapshot.planTier.replace("_", " ")}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Billing source</p>
                  <p className="text-sm text-slate-700">{snapshotResult.snapshot.billingSource || "manual"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Manual override</p>
                  <p className="text-sm text-slate-700">
                    {snapshotResult.snapshot.manualOverrideActive ? "Active" : "No"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Provider truth alignment</p>
                  <p className="text-sm text-slate-700">
                    {billingDiagnostics?.stateMatchesProviderTruth === false
                      ? "Mismatch detected"
                      : billingDiagnostics?.hasProviderSubscription
                      ? "Aligned"
                      : "No provider subscription found"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Valid until</p>
                  <p className="text-sm text-slate-700">
                    {snapshotResult.snapshot.validUntil?.replace("T", " ").replace("Z", "") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Stripe status</p>
                  <p className="text-sm text-slate-700">{snapshotResult.snapshot.stripeStatus || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Customer</p>
                  <p className="text-sm text-slate-700">
                    {snapshotResult.snapshot.stripeCustomerId}{" "}
                    <span className="text-xs text-slate-500">
                      ({snapshotResult.snapshot.stripeCustomerIdPresent ? "present" : "missing"})
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Subscription</p>
                  <p className="text-sm text-slate-700">
                    {snapshotResult.snapshot.stripeSubscriptionId}{" "}
                    <span className="text-xs text-slate-500">
                      ({snapshotResult.snapshot.stripeSubscriptionIdPresent ? "present" : "missing"})
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Price</p>
                  <p className="text-sm text-slate-700">
                    {snapshotResult.snapshot.stripePriceId}{" "}
                    <span className="text-xs text-slate-500">
                      ({snapshotResult.snapshot.stripePriceIdPresent ? "present" : "missing"})
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Period end</p>
                  <p className="text-sm text-slate-700">
                    {snapshotResult.snapshot.stripeCurrentPeriodEnd?.replace("T", " ").replace("Z", "") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Updated</p>
                  <p className="text-sm text-slate-700">
                    {snapshotResult.snapshot.updatedAt?.replace("T", " ").replace("Z", "") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Upgraded</p>
                  <p className="text-sm text-slate-700">
                    {snapshotResult.snapshot.upgradedAt?.replace("T", " ").replace("Z", "") || "—"}
                  </p>
                </div>
              </div>
              {billingDiagnostics && (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Conflict diagnostics
                    </p>
                    <div className="mt-3 space-y-2">
                      {billingDiagnostics.diagnostics.map((item) => (
                        <div
                          key={item.key}
                          className={`rounded-xl border px-3 py-2 text-sm ${severityClasses(item.severity)}`}
                        >
                          <p className="font-semibold">{item.title}</p>
                          <p className="mt-1 text-xs">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Provider truth
                    </p>
                    {userSubscriptionsResult.error ? (
                      <p className="mt-2 text-sm text-rose-600">{userSubscriptionsResult.error}</p>
                    ) : billingDiagnostics.providerSubscription ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase text-slate-400">Provider</p>
                          <p className="text-sm text-slate-700">
                            {billingDiagnostics.providerSubscription.provider || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">Subscription row</p>
                          <p className="text-sm text-slate-700">
                            {maskIdentifier(billingDiagnostics.providerSubscription.provider_subscription_id ?? null)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">Status</p>
                          <p className="text-sm text-slate-700">
                            {billingDiagnostics.providerSubscription.status || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">Plan tier</p>
                          <p className="text-sm text-slate-700">
                            {billingDiagnostics.providerSubscription.plan_tier || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">Current period end</p>
                          <p className="text-sm text-slate-700">
                            {billingDiagnostics.providerSubscription.current_period_end
                              ?.replace("T", " ")
                              .replace("Z", "") || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-400">Updated</p>
                          <p className="text-sm text-slate-700">
                            {billingDiagnostics.providerSubscription.updated_at?.replace("T", " ").replace("Z", "") ||
                              billingDiagnostics.providerSubscription.created_at?.replace("T", " ").replace("Z", "") ||
                              "—"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">No provider subscription row found for this profile.</p>
                    )}
                  </div>
                </div>
              )}
              {supportSnapshot && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <SupportSnapshotCopy payload={supportSnapshot} />
                  <span className="text-xs text-slate-500">
                    Snapshot includes masked Stripe IDs and the last 3 events.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {snapshotResult.snapshot && (
          <BillingOpsActions
            profileId={snapshotResult.snapshot.profileId}
            email={snapshotResult.snapshot.email}
            currentPlan={snapshotResult.snapshot.planTier}
            billingSource={snapshotResult.snapshot.billingSource}
            validUntil={snapshotResult.snapshot.validUntil}
            billingNotes={snapshotResult.snapshot.billingNotes}
            billingNotesUpdatedAt={snapshotResult.snapshot.billingNotesUpdatedAt}
            canReturnToProviderBilling={Boolean(
              snapshotResult.snapshot.manualOverrideActive && billingDiagnostics?.hasStoredStripeTruth
            )}
            returnToProviderBillingHint={
              snapshotResult.snapshot.manualOverrideActive
                ? billingDiagnostics?.hasStoredStripeTruth
                  ? "Clears the manual mask and restores the latest Stripe-backed provider state on this account."
                  : "This account is manual today, but no stored Stripe provider truth is available to restore."
                : "This account is already provider-owned."
            }
            replayableEvents={replayableUserEvents.map((event) => ({
              eventId: event.event_id,
              eventType: event.event_type,
              status: event.status ?? null,
              reason: event.reason ?? null,
              createdAt: event.created_at ?? null,
            }))}
          />
        )}
      </div>

      {snapshotResult.snapshot && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent Stripe events</h3>
              <p className="text-sm text-slate-600">
                Last 10 events linked to this profile, including replay state and ignore reasons.
              </p>
            </div>
            <SupportSnapshotCopy
              payload={userEventsResult.events.map((event) => ({
                event_type: event.event_type,
                status: event.status,
                reason: event.reason,
                mode: event.mode,
                created_at: event.created_at,
                processed_at: event.processed_at,
                event_id: maskIdentifier(event.event_id),
                stripe_customer_id: maskIdentifier(event.stripe_customer_id),
                stripe_subscription_id: maskIdentifier(event.stripe_subscription_id),
              }))}
              label="Copy events"
              successLabel="Events copied"
            />
          </div>
          {!userEventsResult.events.length && (
            <p className="text-sm text-slate-600">No webhook events recorded for this profile yet.</p>
          )}
          {!!userEventsResult.events.length && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 pr-3">Event</th>
                    <th className="py-2 pr-3">Mode</th>
                    <th className="py-2 pr-3">Profile</th>
                    <th className="py-2 pr-3">Price</th>
                    <th className="py-2 pr-3">Outcome</th>
                    <th className="py-2 pr-3">Replay</th>
                    <th className="py-2 pr-3">Eligible</th>
                    <th className="py-2">Processed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {userEventsResult.events.map((event) => (
                    <tr key={event.event_id}>
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        {event.created_at?.replace("T", " ").replace("Z", "") || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="text-sm font-semibold text-slate-900">{event.event_type}</div>
                        <div className="text-xs text-slate-500">{maskIdentifier(event.event_id)}</div>
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{event.mode || "—"}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{event.profile_id || "—"}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{maskIdentifier(event.stripe_price_id)}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        <div>{event.status || "received"}</div>
                        <div className="text-[11px] text-slate-400">{event.reason || "—"}</div>
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        <div>{event.replay_count ?? 0} replay(s)</div>
                        <div className="text-[11px] text-slate-400">
                          {event.last_replay_status || "never replayed"}
                          {event.last_replay_reason ? ` • ${event.last_replay_reason}` : ""}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        <span
                          className={`rounded-full px-2 py-1 ${
                            isReplayEligibleStripeEvent(event)
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isReplayEligibleStripeEvent(event) ? "Replay eligible" : "Resolved"}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-slate-500">
                        {event.processed_at?.replace("T", " ").replace("Z", "") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {snapshotResult.snapshot && billingDiagnostics && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-slate-900">Billing ops timeline</h3>
            <p className="text-sm text-slate-600">
              Manual overrides, provider recovery signals, replay attempts, webhook outcomes, and billing notes for this loaded account.
            </p>
          </div>
          {!billingDiagnostics.timeline.length ? (
            <p className="text-sm text-slate-600">No billing timeline entries recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {billingDiagnostics.timeline.slice(0, 12).map((item) => (
                <div key={item.key} className={`rounded-xl border px-3 py-2 ${severityClasses(item.severity)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs opacity-80">
                      {item.timestamp?.replace("T", " ").replace("Z", "") || "—"}
                    </p>
                  </div>
                  <p className="mt-1 text-xs">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" id="support-queue">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Support triage queue</h2>
            <p className="text-sm text-slate-600">
              Filter accounts by billing risk signals. Use the lookup to take action.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {TRIAGE_OPTIONS.map((option) => {
              const isActive = triage === option;
              return (
                <Link
                  key={option}
                  href={triageHref(option)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {option === "attention"
                    ? "Needs attention"
                    : option.charAt(0).toUpperCase() + option.slice(1)}
                </Link>
              );
            })}
          </div>
        </div>

        {supportError && (
          <ErrorState
            title="Support queue unavailable"
            description={supportError}
            retryLabel="Back to Admin"
            retryHref="/admin"
          />
        )}

        {!supportError && !supportAccounts.length && (
          <p className="text-sm text-slate-600">No accounts match this filter.</p>
        )}

        {!supportError && !!supportAccounts.length && (
          <div className="divide-y divide-slate-100 text-sm">
            {supportAccounts.map((account) => (
              <div key={account.profile_id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {account.email ? maskEmail(account.email) : maskIdentifier(account.profile_id)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Role: {formatRoleLabel(account.role)} • Plan: {account.plan_tier || "free"} • Source:{" "}
                    {account.billing_source || "manual"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Valid until: {account.valid_until?.slice(0, 10) || "—"} • Stripe status:{" "}
                    {account.stripe_status || "—"}
                  </p>
                  {account.pending_requests > 0 && (
                    <p className="text-xs text-amber-600">Pending requests: {account.pending_requests}</p>
                  )}
                  {account.last_event_status && (
                    <p className="text-xs text-rose-600">
                      Last webhook: {account.last_event_status} •{" "}
                      {account.last_event_at?.replace("T", " ").replace("Z", "") || "—"}
                    </p>
                  )}
                </div>
                <Link
                  href={lookupHref(account.profile_id, account.email)}
                  className="text-xs font-semibold text-slate-900 underline underline-offset-4"
                >
                  Open lookup
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <UpgradeRequestsQueue initialRequests={requests} users={users} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" id="events">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Stripe webhook events</h2>
            <p className="text-sm text-slate-600">
              Recent events from the webhook pipeline. Outcomes show processed/ignored/failed.
            </p>
          </div>
          <form className="flex flex-wrap items-center gap-2" action="/admin/billing" method="get">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="profileId" value={profileIdParam} />
            <select
              name="mode"
              defaultValue={MODE_OPTIONS.includes(modeFilter as (typeof MODE_OPTIONS)[number]) ? modeFilter : stripeMode}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === "all" ? "All modes" : mode}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={STATUS_OPTIONS.includes(statusFilter as (typeof STATUS_OPTIONS)[number]) ? statusFilter : "all"}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : status === "ok" ? "Processed" : status}
                </option>
              ))}
            </select>
            <select
              name="plan"
              defaultValue={PLAN_OPTIONS.includes(planFilter as (typeof PLAN_OPTIONS)[number]) ? planFilter : "all"}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {PLAN_OPTIONS.map((plan) => (
                <option key={plan} value={plan}>
                  {plan === "all" ? "All plans" : plan.replace("_", " ")}
                </option>
              ))}
            </select>
            <select
              name="range"
              defaultValue={RANGE_OPTIONS.includes(rangeFilter as (typeof RANGE_OPTIONS)[number]) ? rangeFilter : "7d"}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {RANGE_OPTIONS.map((range) => (
                <option key={range} value={range}>
                  {range === "all" ? "All time" : `Last ${range}`}
                </option>
              ))}
            </select>
            <input
              name="q"
              placeholder="Search event id or Stripe id"
              defaultValue={query}
              className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
            <input type="hidden" name="page" value="1" />
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              Apply
            </button>
          </form>
        </div>

        {error && (
          <ErrorState
            title="Billing events unavailable"
            description={error}
            retryLabel="Back to Admin"
            retryHref="/admin"
          />
        )}

        {!error && !events.length && (
          <p className="text-sm text-slate-600">No webhook events found for this filter.</p>
        )}

        {!error && !!events.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2 pr-3">Profile</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Subscription</th>
                  <th className="py-2 pr-3">Price</th>
                  <th className="py-2 pr-3">Outcome</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2">Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {events.map((event) => (
                  <tr key={event.event_id}>
                    <td className="py-2 pr-3 text-xs text-slate-500">
                      {event.created_at?.replace("T", " ").replace("Z", "") || "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="text-sm font-semibold text-slate-900">{event.event_type}</div>
                      <div className="text-xs text-slate-500">{maskIdentifier(event.event_id)}</div>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{event.mode || "—"}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{maskIdentifier(event.profile_id)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{event.plan_tier || "—"}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{maskIdentifier(event.stripe_customer_id)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{maskIdentifier(event.stripe_subscription_id)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{maskIdentifier(event.stripe_price_id)}</td>
                    <td className="py-2 pr-3 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                        {event.status === "processed" ? "ok" : event.status || "received"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{event.reason || "—"}</td>
                    <td className="py-2 text-xs text-slate-500">
                      {event.processed_at?.replace("T", " ").replace("Z", "") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!error && (prevPageHref || nextPageHref) && (
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            {prevPageHref && (
              <Link href={prevPageHref} className="text-slate-600 underline underline-offset-4">
                Previous
              </Link>
            )}
            {nextPageHref && (
              <Link href={nextPageHref} className="font-semibold text-slate-900 underline underline-offset-4">
                Load more
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" id="provider-events">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Provider payment events</h2>
            <p className="text-sm text-slate-600">
              Paystack and Flutterwave activity (init, verify, and status updates).
            </p>
          </div>
          <form className="flex flex-wrap items-center gap-2" action="/admin/billing" method="get">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="profileId" value={profileIdParam} />
            <select
              name="provider"
              defaultValue={providerFilter}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {PROVIDER_OPTIONS.map((provider) => (
                <option key={provider} value={provider}>
                  {provider === "all" ? "All providers" : provider}
                </option>
              ))}
            </select>
            <select
              name="provider_mode"
              defaultValue={providerModeFilter}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === "all" ? "All modes" : mode}
                </option>
              ))}
            </select>
            <select
              name="provider_status"
              defaultValue={providerStatusFilter}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {PROVIDER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : status}
                </option>
              ))}
            </select>
            <select
              name="provider_range"
              defaultValue={providerRangeFilter}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {PROVIDER_RANGE_OPTIONS.map((range) => (
                <option key={range} value={range}>
                  {range === "all" ? "All time" : `Last ${range}`}
                </option>
              ))}
            </select>
            <input
              name="provider_q"
              placeholder="Search reference or profile id"
              defaultValue={providerQuery}
              className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
            <input type="hidden" name="provider_page" value="1" />
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              Apply
            </button>
          </form>
        </div>

        {providerEventsError && (
          <ErrorState
            title="Provider events unavailable"
            description={providerEventsError}
            retryLabel="Back to Admin"
            retryHref="/admin"
          />
        )}

        {!providerEventsError && !providerEvents.length && (
          <p className="text-sm text-slate-600">No provider payment events found for this filter.</p>
        )}

        {!providerEventsError && !!providerEvents.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2 pr-3">Profile</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Outcome</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2">Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {providerEvents.map((event) => (
                  <tr key={`${event.provider}:${event.reference}`}>
                    <td className="py-2 pr-3 text-xs text-slate-500">
                      {event.created_at?.replace("T", " ").replace("Z", "") || "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500 capitalize">{event.provider}</td>
                    <td className="py-2 pr-3">
                      <div className="text-sm font-semibold text-slate-900">{event.event_type}</div>
                      <div className="text-xs text-slate-500">{maskIdentifier(event.reference)}</div>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{event.mode || "—"}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{maskIdentifier(event.profile_id)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{event.plan_tier || "—"}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">
                      {typeof event.amount === "number"
                        ? `${(event.amount / 100).toFixed(2)} ${event.currency || "NGN"}`
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                        {event.status || "received"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{event.reason || "—"}</td>
                    <td className="py-2 text-xs text-slate-500">
                      {event.processed_at?.replace("T", " ").replace("Z", "") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!providerEventsError && (providerPrevPageHref || providerNextPageHref) && (
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            {providerPrevPageHref && (
              <Link href={providerPrevPageHref} className="text-slate-600 underline underline-offset-4">
                Previous
              </Link>
            )}
            {providerNextPageHref && (
              <Link href={providerNextPageHref} className="font-semibold text-slate-900 underline underline-offset-4">
                Load more
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
