import { redirect } from "next/navigation";
import { PlansGrid } from "@/components/billing/PlansGrid";
import { PaymentModeBadge } from "@/components/billing/PaymentModeBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProfile } from "@/lib/auth";
import { getUserRole } from "@/lib/authz";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeConfigForMode } from "@/lib/billing/stripe";
import { getPaystackConfig } from "@/lib/billing/paystack";
import { getFlutterwaveConfig } from "@/lib/billing/flutterwave";
import { getStripePriceId } from "@/lib/billing/stripe-plans";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { normalizeRole } from "@/lib/roles";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { normalizePlanTier, type PlanTier } from "@/lib/plans";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";

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
  const { supabase, user } = await getServerAuthUser();
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
    logAuthRedirect("/dashboard/billing");
    redirect("/auth/login?reason=auth");
  }
  const normalizedRole = normalizeRole(profile.role);
  if (!normalizedRole) {
    redirect("/onboarding");
  }

  if (!["landlord", "agent", "tenant", "admin"].includes(normalizedRole)) {
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
    normalizedRole === "tenant"
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

  const providerModes = await getProviderModes();
  const stripeConfig = getStripeConfigForMode(providerModes.stripeMode);
  const paystackConfig = await getPaystackConfig(providerModes.paystackMode);
  const flutterwaveConfig = await getFlutterwaveConfig(providerModes.flutterwaveMode);
  const paidTiers: PlanTier[] =
    normalizedRole === "tenant" ? ["tenant_pro"] : ["starter", "pro"];
  const hasStripePrice = paidTiers.some((tier) =>
    (["monthly", "yearly"] as const).some((cadence) =>
      !!getStripePriceId({
        role: normalizedRole,
        tier,
        cadence,
        mode: stripeConfig.mode,
      })
    )
  );
  const stripeEnabled = !!stripeConfig.secretKey && hasStripePrice;
  const paystackEnabled =
    !!paystackConfig.secretKey && !(providerModes.paystackMode === "live" && paystackConfig.fallbackFromLive);
  const flutterwaveEnabled =
    !!flutterwaveConfig.secretKey && !(providerModes.flutterwaveMode === "live" && flutterwaveConfig.fallbackFromLive);
  const showManage = billingSource === "stripe" && !!stripeCustomerId;

  const statusToken =
    billingSource === "stripe"
      ? stripeStatus || (expired ? "expired" : "active")
      : billingSource === "manual"
      ? "manual"
      : expired
      ? "expired"
      : "active";
  const statusLabel = statusToken.replace(/_/g, " ");
  const statusTone =
    statusToken === "active" || statusToken === "trialing"
      ? "bg-emerald-100 text-emerald-700"
      : statusToken === "past_due" || statusToken === "unpaid"
      ? "bg-amber-100 text-amber-700"
      : statusToken === "canceled" || statusToken === "incomplete_expired" || statusToken === "expired"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-100 text-slate-600";
  const summaryCopy =
    normalizedRole === "tenant"
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
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <PaymentModeBadge mode={providerModes.stripeMode} />
              <span>
                {providerModes.stripeMode === "test"
                  ? "You are in TEST mode. No real charges will be made."
                  : "LIVE mode enabled."}
              </span>
            </div>
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
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone}`}>
                {statusLabel}
              </span>
            </div>
            {billingSource === "stripe" && stripePeriodEnd && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-slate-500">Renews</span>
                <span>{new Date(stripePeriodEnd).toLocaleDateString()}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-slate-500">Valid until</span>
              <span>{validUntil ? new Date(validUntil).toLocaleDateString() : "—"}</span>
            </div>
          </div>
        </div>
      </div>

          <PlansGrid
            currentTier={planTier}
            currentRole={normalizedRole}
            billingSource={billingSource}
        stripeStatus={stripeStatus}
        stripePeriodEnd={stripePeriodEnd}
        stripeEnabled={stripeEnabled}
        paystackEnabled={paystackEnabled}
        paystackMode={providerModes.paystackMode}
        flutterwaveEnabled={flutterwaveEnabled}
        flutterwaveMode={providerModes.flutterwaveMode}
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
