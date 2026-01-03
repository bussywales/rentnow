import Link from "next/link";
import { redirect } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";
import { UpgradeRequestsQueue } from "@/components/admin/UpgradeRequestsQueue";
import { BillingOpsActions } from "@/components/admin/BillingOpsActions";
import { buildBillingSnapshot, type BillingSnapshot } from "@/lib/billing/snapshot";
import { maskIdentifier } from "@/lib/billing/mask";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

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
};

const STATUS_OPTIONS = ["all", "processed", "ignored", "failed"] as const;
const RANGE_OPTIONS = ["24h", "7d", "30d", "all"] as const;
const PLAN_OPTIONS = ["all", "free", "starter", "pro", "tenant_pro"] as const;

function parseParam(params: SearchParams, key: string) {
  const value = params[key];
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function resolveStartDate(range: string) {
  const now = Date.now();
  if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/billing&reason=auth");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/required?redirect=/admin/billing&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");
}

async function loadBillingSnapshot(email: string): Promise<{ snapshot: BillingSnapshot | null; error?: string }> {
  if (!hasServiceRoleEnv()) {
    return { snapshot: null, error: "Service role key missing; billing snapshot unavailable." };
  }

  const adminClient = createServiceRoleClient();
  const { data: users, error } = await adminClient.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    return { snapshot: null, error: error.message };
  }

  const user = (users?.users || []).find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    return { snapshot: null, error: "User not found." };
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

  return {
    snapshot: buildBillingSnapshot({
      profileId: user.id,
      email: user.email ?? null,
      role: (profile as { role?: string | null } | null)?.role ?? null,
      fullName: (profile as { full_name?: string | null } | null)?.full_name ?? null,
      plan: (plan as Record<string, string | null> | null) ?? null,
      notes: (notes as { billing_notes?: string | null; updated_at?: string | null; updated_by?: string | null } | null) ?? null,
    }),
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

async function loadEvents(params: SearchParams): Promise<{ events: StripeEventRow[]; error?: string }> {
  if (!hasServiceRoleEnv()) {
    return { events: [], error: "Service role key missing for billing events." };
  }

  const statusFilter = parseParam(params, "status") || "all";
  const planFilter = parseParam(params, "plan") || "all";
  const rangeFilter = parseParam(params, "range") || "7d";
  const query = parseParam(params, "q").trim();

  const adminClient = createServiceRoleClient();
  let eventsQuery = adminClient
    .from("stripe_webhook_events")
    .select(
      "event_id, event_type, created_at, status, reason, mode, plan_tier, profile_id, stripe_customer_id, stripe_subscription_id"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (statusFilter !== "all") {
    eventsQuery = eventsQuery.eq("status", statusFilter);
  }
  if (planFilter !== "all") {
    eventsQuery = eventsQuery.eq("plan_tier", planFilter);
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
        event.stripe_subscription_id?.toLowerCase().includes(lower)
    );
  }

  return { events, error: undefined };
}

export default async function AdminBillingPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const email = parseParam(searchParams, "email");
  const statusFilter = parseParam(searchParams, "status") || "all";
  const planFilter = parseParam(searchParams, "plan") || "all";
  const rangeFilter = parseParam(searchParams, "range") || "7d";
  const query = parseParam(searchParams, "q");

  const snapshotResult = email ? await loadBillingSnapshot(email) : { snapshot: null };
  const { requests, users } = await loadUpgradeRequests();
  const { events, error } = await loadEvents(searchParams);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Billing ops</p>
        <p className="text-sm text-slate-200">
          Diagnose plan issues, manage manual overrides, and audit Stripe events.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/admin" className="underline underline-offset-4">
            Back to Admin
          </Link>
          <Link href="/admin/users" className="underline underline-offset-4">
            User management
          </Link>
        </div>
      </div>

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
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              Search
            </button>
          </form>

          {!email && (
            <p className="mt-4 text-sm text-slate-500">
              Enter an email to load the billing snapshot and admin actions.
            </p>
          )}

          {email && snapshotResult.error && (
            <div className="mt-4">
              <ErrorState
                title="Lookup failed"
                description={snapshotResult.error}
                retryLabel="Back to Admin"
                retryHref="/admin"
              />
            </div>
          )}

          {snapshotResult.snapshot && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{snapshotResult.snapshot.email}</p>
                  <p className="text-xs text-slate-500">
                    Profile: {maskIdentifier(snapshotResult.snapshot.profileId)} • Role: {snapshotResult.snapshot.role || "unknown"}
                  </p>
                </div>
                {snapshotResult.snapshot.isExpired && (
                  <span className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700">Expired</span>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-400">Plan tier</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {snapshotResult.snapshot.planTier.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Billing source</p>
                  <p className="text-sm text-slate-700">{snapshotResult.snapshot.billingSource || "manual"}</p>
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
                  <p className="text-sm text-slate-700">{snapshotResult.snapshot.stripeCustomerId}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Subscription</p>
                  <p className="text-sm text-slate-700">{snapshotResult.snapshot.stripeSubscriptionId}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">Price</p>
                  <p className="text-sm text-slate-700">{snapshotResult.snapshot.stripePriceId}</p>
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
            </div>
          )}
        </div>

        {snapshotResult.snapshot && (
          <BillingOpsActions
            profileId={snapshotResult.snapshot.profileId}
            currentPlan={snapshotResult.snapshot.planTier}
            billingSource={snapshotResult.snapshot.billingSource}
            validUntil={snapshotResult.snapshot.validUntil}
            billingNotes={snapshotResult.snapshot.billingNotes}
            billingNotesUpdatedAt={snapshotResult.snapshot.billingNotesUpdatedAt}
          />
        )}
      </div>

      <UpgradeRequestsQueue initialRequests={requests} users={users} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Stripe webhook events</h2>
            <p className="text-sm text-slate-600">
              Recent events from the webhook pipeline. Outcomes show processed/ignored/failed.
            </p>
          </div>
          <form className="flex flex-wrap items-center gap-2" action="/admin/billing" method="get">
            <input type="hidden" name="email" value={email} />
            <select
              name="status"
              defaultValue={STATUS_OPTIONS.includes(statusFilter as (typeof STATUS_OPTIONS)[number]) ? statusFilter : "all"}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : status}
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
                  <th className="py-2 pr-3">Outcome</th>
                  <th className="py-2">Reason</th>
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
                    <td className="py-2 pr-3 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                        {event.status || "received"}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-slate-500">{event.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
