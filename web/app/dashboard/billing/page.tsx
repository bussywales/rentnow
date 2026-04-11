import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { PlansGrid } from "@/components/billing/PlansGrid";
import { PaymentModeBadge } from "@/components/billing/PaymentModeBadge";
import { ProductEventTracker } from "@/components/analytics/ProductEventTracker";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProfile } from "@/lib/auth";
import { getUserRole } from "@/lib/authz";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeConfigForMode } from "@/lib/billing/stripe";
import { getPaystackConfig } from "@/lib/billing/paystack";
import { getFlutterwaveConfig } from "@/lib/billing/flutterwave";
import { getCreditSummary } from "@/lib/billing/credits-summary.server";
import { getPlanUsage } from "@/lib/plan-enforcement";
import { normalizeRole } from "@/lib/roles";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { normalizePlanTier, resolveEffectivePlanTier } from "@/lib/plans";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getMarketSettings } from "@/lib/market/market.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest, formatMarketLabel } from "@/lib/market/market";
import { SUBSCRIPTION_PLAN_CARDS } from "@/lib/billing/subscription-plan-cards";
import { resolveSubscriptionPlanQuote } from "@/lib/billing/subscription-pricing";
import { loadSubscriptionPriceBookRows } from "@/lib/billing/subscription-price-book.repository";
import { resolveSubscriptionLifecycleState } from "@/lib/billing/subscription-lifecycle";
import type { SubscriptionPlanPricingSet } from "@/lib/billing/subscription-pricing.types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type SearchParamsInput = SearchParams | Promise<SearchParams>;

type PlanRow = {
  plan_tier?: string | null;
  billing_source?: string | null;
  valid_until?: string | null;
  stripe_status?: string | null;
  stripe_current_period_end?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

type SubscriptionRow = {
  provider?: string | null;
  provider_subscription_id?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  canceled_at?: string | null;
};

function parseParam(params: SearchParams, key: string) {
  const value = params[key];
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}

function resolveLifecycleToneClasses(tone: "neutral" | "positive" | "warning" | "danger") {
  if (tone === "positive") return "bg-emerald-100 text-emerald-700";
  if (tone === "warning") return "bg-amber-100 text-amber-700";
  if (tone === "danger") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

function resolveBillingModePresentation(input: {
  normalizedRole: string;
  pricingByPlanKey: Record<string, SubscriptionPlanPricingSet>;
  providerModes: { stripeMode: "test" | "live"; paystackMode: "test" | "live"; flutterwaveMode: "test" | "live" };
}) {
  const activePlanKey =
    input.normalizedRole === "tenant"
      ? "tenant_pro"
      : input.normalizedRole === "agent"
      ? "agent_pro"
      : "landlord_pro";
  const activePricing = input.pricingByPlanKey[activePlanKey];
  const provider = activePricing?.monthly.provider ?? activePricing?.yearly.provider ?? "stripe";

  if (provider === "paystack") {
    return {
      providerLabel: "Paystack",
      mode: input.providerModes.paystackMode,
      detail:
        input.providerModes.paystackMode === "live"
          ? "Paystack live mode enabled for this market."
          : "Paystack test mode enabled for this market. Real charges are not being made.",
    } as const;
  }

  if (provider === "flutterwave") {
    return {
      providerLabel: "Flutterwave",
      mode: input.providerModes.flutterwaveMode,
      detail:
        input.providerModes.flutterwaveMode === "live"
          ? "Flutterwave live mode enabled for this market."
          : "Flutterwave test mode enabled for this market. Real charges are not being made.",
    } as const;
  }

  return {
    providerLabel: "Stripe",
    mode: input.providerModes.stripeMode,
    detail:
      input.providerModes.stripeMode === "test"
        ? "Stripe test mode enabled. No real charges will be made."
        : "Stripe live mode enabled for this market.",
  } as const;
}

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

export default async function BillingPage({ searchParams }: { searchParams?: SearchParamsInput } = {}) {
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
      "plan_tier, billing_source, valid_until, stripe_status, stripe_current_period_end, stripe_customer_id, stripe_subscription_id"
    )
    .eq("profile_id", profile.id)
    .maybeSingle();

  const billingSource = (planRow as PlanRow | null)?.billing_source ?? "manual";
  const validUntil = (planRow as PlanRow | null)?.valid_until ?? null;
  const stripeStatus = (planRow as PlanRow | null)?.stripe_status ?? null;
  const stripePeriodEnd = (planRow as PlanRow | null)?.stripe_current_period_end ?? null;
  const stripeCustomerId = (planRow as PlanRow | null)?.stripe_customer_id ?? null;
  const stripeSubscriptionId = (planRow as PlanRow | null)?.stripe_subscription_id ?? null;
  const effectivePlanTier = resolveEffectivePlanTier(
    normalizePlanTier((planRow as PlanRow | null)?.plan_tier),
    validUntil
  );
  const { data: subscriptionRow } = await planClient
    .from("subscriptions")
    .select("provider, provider_subscription_id, status, current_period_end, canceled_at")
    .eq("user_id", profile.id)
    .eq("provider", "stripe")
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const usage = await getPlanUsage({
    supabase,
    ownerId: profile.id,
    serviceClient,
  });
  const plan = usage.plan;
  const creditSummary = await getCreditSummary({
    supabase,
    userId: profile.id,
  });
  const subscriptionsEnabled = await getAppSettingBool(
    APP_SETTING_KEYS.subscriptionsEnabled,
    false
  );
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
  const canonicalRows = await loadSubscriptionPriceBookRows();
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const marketSettings = await getMarketSettings(supabase);
  const market = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: requestCookies.get(MARKET_COOKIE_NAME)?.value ?? null,
    appSettings: marketSettings,
  });
  const marketLabel = formatMarketLabel(market);
  const stripeEnabled = !!stripeConfig.secretKey;
  const paystackEnabled =
    !!paystackConfig.secretKey && !(providerModes.paystackMode === "live" && paystackConfig.fallbackFromLive);
  const flutterwaveCheckoutVisible = false;
  const flutterwaveEnabled =
    flutterwaveCheckoutVisible &&
    !!flutterwaveConfig.secretKey && !(providerModes.flutterwaveMode === "live" && flutterwaveConfig.fallbackFromLive);
  const lifecycle = resolveSubscriptionLifecycleState({
    billingSource,
    planTier: (planRow as PlanRow | null)?.plan_tier ?? null,
    effectivePlanTier,
    validUntil,
    stripeStatus,
    stripeCurrentPeriodEnd: stripePeriodEnd,
    providerSubscription: (subscriptionRow as SubscriptionRow | null) ?? null,
  });
  const showManage = lifecycle.portalEligible && !!stripeCustomerId && !!stripeSubscriptionId;
  const pricingEntries = await Promise.all(
    SUBSCRIPTION_PLAN_CARDS.filter((planCard) => planCard.tier !== "free" && planCard.role)
      .map(async (planCard) => {
        const monthly = await resolveSubscriptionPlanQuote({
          role: planCard.role!,
          tier: planCard.tier,
          cadence: "monthly",
          market,
          canonicalRows,
          stripe: {
            enabled: stripeEnabled,
            mode: stripeConfig.mode,
            secretKey: stripeConfig.secretKey,
          },
          paystack: {
            enabled: paystackEnabled,
            mode: providerModes.paystackMode,
          },
          flutterwave: {
            enabled: flutterwaveEnabled,
            mode: providerModes.flutterwaveMode,
          },
        });
        const yearly = await resolveSubscriptionPlanQuote({
          role: planCard.role!,
          tier: planCard.tier,
          cadence: "yearly",
          market,
          canonicalRows,
          stripe: {
            enabled: stripeEnabled,
            mode: stripeConfig.mode,
            secretKey: stripeConfig.secretKey,
          },
          paystack: {
            enabled: paystackEnabled,
            mode: providerModes.paystackMode,
          },
          flutterwave: {
            enabled: flutterwaveEnabled,
            mode: providerModes.flutterwaveMode,
          },
        });
        return [planCard.key, { monthly, yearly } satisfies SubscriptionPlanPricingSet] as const;
      })
  );
  const pricingByPlanKey = Object.fromEntries(pricingEntries) as Record<string, SubscriptionPlanPricingSet>;
  const billingModePresentation = resolveBillingModePresentation({
    normalizedRole,
    pricingByPlanKey,
    providerModes,
  });

  const summaryCopy =
    normalizedRole === "tenant"
      ? "Your plan unlocks saved search alerts and early access."
      : "Your plan controls listing limits and approval priority.";
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const portalReturned = parseParam(resolvedSearchParams, "stripe") === "portal-return";

  return (
    <div className="space-y-6">
      <ProductEventTracker
        eventName="billing_page_viewed"
        dedupeKey={`billing:${profile.id}:${billingSource}:${effectivePlanTier}`}
        properties={{
          market: market.country,
          role: normalizedRole,
          planTier: effectivePlanTier,
          billingSource,
        }}
      />
      {portalReturned ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          <p className="font-semibold">Returned from Stripe billing portal.</p>
          <p className="mt-1">Subscription details below were refreshed from the latest stored Stripe state.</p>
        </div>
      ) : null}
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
              <PaymentModeBadge
                mode={billingModePresentation.mode}
                providerLabel={billingModePresentation.providerLabel}
              />
              <span>{billingModePresentation.detail}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">Current plan</span>
              <span className="font-semibold">{plan.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-slate-500">Lifecycle</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${resolveLifecycleToneClasses(lifecycle.tone)}`}
              >
                {lifecycle.label}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-xs text-slate-500">{lifecycle.description}</p>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-slate-500">Billing source</span>
              <span className="capitalize">{billingSource}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-slate-500">Stripe status</span>
              <span>{stripeStatus ? stripeStatus.replace(/_/g, " ") : "—"}</span>
            </div>
            {lifecycle.renewalAt && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-slate-500">Renews</span>
                <span>{new Date(lifecycle.renewalAt).toLocaleDateString()}</span>
              </div>
            )}
            {lifecycle.accessUntil ? (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-slate-500">
                  {lifecycle.key === "cancelled_period_end" ? "Access until" : "Valid until"}
                </span>
                <span>{new Date(lifecycle.accessUntil).toLocaleDateString()}</span>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-slate-500">Valid until</span>
                <span>—</span>
              </div>
            )}
            {lifecycle.cancellationRequestedAt && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-slate-500">Cancellation requested</span>
                <span>{new Date(lifecycle.cancellationRequestedAt).toLocaleDateString()}</span>
              </div>
            )}
            {!showManage && billingSource === "stripe" && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Stripe billing exists, but portal access is unavailable for the current lifecycle state.
              </div>
            )}
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Listing credits</span>
                <span className="font-semibold" data-testid="billing-listing-credits">
                  {creditSummary.listingRemaining}/{creditSummary.listingTotal}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-slate-500">Featured credits</span>
                <span className="font-semibold" data-testid="billing-featured-credits">
                  {creditSummary.featuredRemaining}/{creditSummary.featuredTotal}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Pay per listing anytime.</p>
            </div>
          </div>
        </div>
      </div>
      {subscriptionsEnabled ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Save more with a plan (optional)</p>
            <p className="mt-1 text-xs text-slate-600">
              Plans bundle monthly listing + featured credits, but PAYG is always available.
            </p>
          </div>
          <PlansGrid
            currentTier={effectivePlanTier}
            currentRole={normalizedRole}
            billingSource={billingSource}
            stripeStatus={stripeStatus}
            stripePeriodEnd={stripePeriodEnd}
            paystackMode={providerModes.paystackMode}
            flutterwaveMode={providerModes.flutterwaveMode}
            flutterwaveCheckoutVisible={flutterwaveCheckoutVisible}
            showManage={showManage}
            pendingUpgrade={pendingUpgrade}
            activeCount={usage.activeCount}
            maxListings={plan.maxListings}
            savedSearchCount={savedSearchCount ?? 0}
            marketCountry={market.country}
            marketCurrency={market.currency}
            marketLabel={marketLabel}
            pricingByPlanKey={pricingByPlanKey}
            requestUpgradeAction={requestUpgrade}
            lifecycleLabel={lifecycle.label}
            lifecycleDetail={
              lifecycle.key === "cancelled_period_end" && lifecycle.accessUntil
                ? `Access until ${new Date(lifecycle.accessUntil).toLocaleDateString()}`
                : lifecycle.key === "active_paid" && lifecycle.renewalAt
                ? `Renews ${new Date(lifecycle.renewalAt).toLocaleDateString()}`
                : lifecycle.key === "payment_issue"
                ? "Payment collection needs attention."
                : null
            }
          />
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
          Subscriptions are currently paused. Pay per listing anytime.
        </div>
      )}
    </div>
  );
}
