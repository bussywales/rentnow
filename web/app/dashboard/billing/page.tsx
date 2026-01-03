import { redirect } from "next/navigation";
import { PlansGrid } from "@/components/billing/PlansGrid";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProfile } from "@/lib/auth";
import { getUserRole } from "@/lib/authz";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { normalizePlanTier } from "@/lib/plans";

export const dynamic = "force-dynamic";

type PlanRow = {
  plan_tier?: string | null;
  billing_source?: string | null;
  valid_until?: string | null;
  stripe_status?: string | null;
  stripe_current_period_end?: string | null;
  stripe_customer_id?: string | null;
};

async function requestUpgrade(formData: FormData) {
  "use server";
  if (!hasServerSupabaseEnv()) return;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const role = await getUserRole(supabase, user.id);
  if (!role || (role !== "landlord" && role !== "agent" && role !== "tenant")) return;

  const rawTier = formData.get("plan_tier");
  const requestedPlan =
    role === "tenant"
      ? "tenant_pro"
      : rawTier === "pro" || rawTier === "starter"
      ? rawTier
      : "starter";

  const { data: existing } = await supabase
    .from("plan_upgrade_requests")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return;

  await supabase.from("plan_upgrade_requests").insert({
    profile_id: user.id,
    requester_id: user.id,
    requested_plan_tier: requestedPlan,
    status: "pending",
  });
}

export default async function BillingPage() {
  if (!hasServerSupabaseEnv()) {
    return (
      <ErrorState
        title="Billing unavailable"
        description="Supabase is not configured, so billing details cannot be loaded."
        retryLabel="Back to dashboard"
        retryHref="/dashboard"
      />
    );
  }

  const profile = await getProfile();
  if (!profile) {
    redirect("/auth/login?reason=auth");
  }

  if (!["landlord", "agent", "tenant", "admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const serviceClient = hasServiceRoleEnv() ? createServiceRoleClient() : null;
  const planClient = serviceClient ?? supabase;
  const { data: planRow } = await planClient
    .from("profile_plans")
    .select(
      "plan_tier, billing_source, valid_until, stripe_status, stripe_current_period_end, stripe_customer_id"
    )
    .eq("profile_id", profile.id)
    .maybeSingle();

  const billingSource = (planRow as PlanRow | null)?.billing_source ?? "manual";
  const validUntil = (planRow as PlanRow | null)?.valid_until ?? null;
  const stripeStatus = (planRow as PlanRow | null)?.stripe_status ?? null;
  const stripePeriodEnd = (planRow as PlanRow | null)?.stripe_current_period_end ?? null;
  const stripeCustomerId = (planRow as PlanRow | null)?.stripe_customer_id ?? null;
  const now = new Date();
  const expired =
    !!validUntil && Number.isFinite(Date.parse(validUntil)) && new Date(validUntil).getTime() < now.getTime();
  const planTier = normalizePlanTier((planRow as PlanRow | null)?.plan_tier);
  const usage = await getPlanUsage({
    supabase,
    ownerId: profile.id,
    serviceClient,
  });
  const plan = usage.plan;
  const { count: savedSearchCount } =
    profile.role === "tenant"
      ? await supabase
          .from("saved_searches")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.id)
      : { count: 0 };

  const { data: upgradeRequest } = await supabase
    .from("plan_upgrade_requests")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("status", "pending")
    .maybeSingle();
  const pendingUpgrade = !!upgradeRequest;

  const stripeEnabled =
    (profile.role === "landlord" &&
      !!process.env.STRIPE_SECRET_KEY &&
      !!process.env.STRIPE_PRICE_LANDLORD_MONTHLY &&
      !!process.env.STRIPE_PRICE_LANDLORD_YEARLY) ||
    (profile.role === "agent" &&
      !!process.env.STRIPE_SECRET_KEY &&
      !!process.env.STRIPE_PRICE_AGENT_MONTHLY &&
      !!process.env.STRIPE_PRICE_AGENT_YEARLY) ||
    (profile.role === "tenant" &&
      !!process.env.STRIPE_SECRET_KEY &&
      !!process.env.STRIPE_PRICE_TENANT_MONTHLY &&
      !!process.env.STRIPE_PRICE_TENANT_YEARLY);
  const showManage = billingSource === "stripe" && !!stripeCustomerId;

  const statusLabel =
    billingSource === "stripe"
      ? stripeStatus || (expired ? "expired" : "active")
      : billingSource === "manual"
      ? "manual"
      : expired
      ? "expired"
      : "free";
  const summaryCopy =
    profile.role === "tenant"
      ? "Your plan unlocks saved search alerts and early access."
      : "Your plan controls listing limits and approval priority.";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Plans & Billing
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              Upgrade and manage your subscription
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {summaryCopy}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Current plan</span>
              <span className="font-semibold">{plan.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-slate-500">Billing source</span>
              <span className="capitalize">{billingSource}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-slate-500">Status</span>
              <span className="capitalize">{statusLabel.replace(/_/g, " ")}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-slate-500">Valid until</span>
              <span>{validUntil ? new Date(validUntil).toLocaleDateString() : "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <PlansGrid
        currentTier={planTier}
        currentRole={profile.role}
        billingSource={billingSource}
        stripeStatus={stripeStatus}
        stripePeriodEnd={stripePeriodEnd}
        stripeEnabled={stripeEnabled}
        showManage={showManage}
        pendingUpgrade={pendingUpgrade}
        activeCount={usage.activeCount}
        maxListings={plan.maxListings}
        savedSearchCount={savedSearchCount ?? 0}
        requestUpgradeAction={requestUpgrade}
      />
    </div>
  );
}
