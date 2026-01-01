import Link from "next/link";
import { redirect } from "next/navigation";
import { StripeUpgradeActions } from "@/components/billing/StripeUpgradeActions";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { getProfile } from "@/lib/auth";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { hasServiceRoleEnv, createServiceRoleClient } from "@/lib/supabase/admin";
import { getPlanForTier } from "@/lib/plans";

export const dynamic = "force-dynamic";

type PlanRow = {
  plan_tier?: string | null;
  billing_source?: string | null;
  valid_until?: string | null;
  stripe_status?: string | null;
  stripe_current_period_end?: string | null;
  stripe_customer_id?: string | null;
};

export default async function BillingPage() {
  if (!hasServerSupabaseEnv()) {
    return (
      <ErrorState
        title="Billing unavailable"
        description="Supabase is not configured, so billing details cannot be loaded."
        retryAction={
          <Link href="/dashboard">
            <Button size="sm" variant="secondary">
              Back to dashboard
            </Button>
          </Link>
        }
      />
    );
  }

  const profile = await getProfile();
  if (!profile) {
    redirect("/auth/login?reason=auth");
  }

  if (!["landlord", "agent", "admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createServerSupabaseClient();
  const planClient = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
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
    !!validUntil &&
    Number.isFinite(Date.parse(validUntil)) &&
    new Date(validUntil).getTime() < now.getTime();
  const planTier = (planRow as PlanRow | null)?.plan_tier ?? "free";
  const plan = getPlanForTier(expired ? "free" : planTier);

  const stripeEnabled =
    (profile.role === "landlord" &&
      !!process.env.STRIPE_SECRET_KEY &&
      !!process.env.STRIPE_PRICE_LANDLORD_MONTHLY &&
      !!process.env.STRIPE_PRICE_LANDLORD_YEARLY) ||
    (profile.role === "agent" &&
      !!process.env.STRIPE_SECRET_KEY &&
      !!process.env.STRIPE_PRICE_AGENT_MONTHLY &&
      !!process.env.STRIPE_PRICE_AGENT_YEARLY);
  const showManage = billingSource === "stripe" && !!stripeCustomerId;

  const statusLabel =
    billingSource === "stripe"
      ? stripeStatus || (expired ? "expired" : "active")
      : billingSource === "manual"
      ? "manual"
      : expired
      ? "expired"
      : "free";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Billing</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your plan and subscription status.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Current plan</h2>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <dt>Plan tier</dt>
              <dd className="font-semibold text-slate-900">{plan.name}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Billing source</dt>
              <dd className="capitalize">{billingSource}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Status</dt>
              <dd className="capitalize">{statusLabel.replace(/_/g, " ")}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Valid until</dt>
              <dd>{validUntil ? new Date(validUntil).toLocaleDateString() : "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upgrade or manage your subscription based on your billing source.
          </p>
          <div className="mt-4">
            {billingSource === "stripe" ? (
              <StripeUpgradeActions
                defaultTier="starter"
                stripeEnabled={stripeEnabled}
                stripeStatus={stripeStatus}
                stripePeriodEnd={stripePeriodEnd}
                showManage={showManage}
                showUpgrade={false}
              />
            ) : billingSource === "manual" ? (
              <Link href="/support?intent=billing">
                <Button variant="secondary">Contact support</Button>
              </Link>
            ) : (
              <StripeUpgradeActions
                defaultTier="starter"
                stripeEnabled={stripeEnabled}
                stripeStatus={stripeStatus}
                stripePeriodEnd={stripePeriodEnd}
                showManage={showManage}
                showUpgrade
              />
            )}
          </div>
          {billingSource !== "stripe" && (
            <p className="mt-3 text-xs text-slate-500">
              Manual upgrades remain available even after Stripe is enabled.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
