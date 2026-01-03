import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaymentModeBadge } from "@/components/billing/PaymentModeBadge";
import { normalizeProviderMode } from "@/lib/billing/provider-settings";
import { maskIdentifier } from "@/lib/billing/mask";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProviderSettingsRow = {
  stripe_mode?: string | null;
  paystack_mode?: string | null;
  flutterwave_mode?: string | null;
  paystack_test_secret_key?: string | null;
  paystack_live_secret_key?: string | null;
  paystack_test_public_key?: string | null;
  paystack_live_public_key?: string | null;
  flutterwave_test_secret_key?: string | null;
  flutterwave_live_secret_key?: string | null;
  flutterwave_test_public_key?: string | null;
  flutterwave_live_public_key?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/settings/billing&reason=auth");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/required?redirect=/admin/settings/billing&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");
}

async function loadSettings(): Promise<{ settings?: ProviderSettingsRow; error?: string }> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase not configured" };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("provider_settings")
    .select(
      "stripe_mode, paystack_mode, flutterwave_mode, paystack_test_secret_key, paystack_live_secret_key, paystack_test_public_key, paystack_live_public_key, flutterwave_test_secret_key, flutterwave_live_secret_key, flutterwave_test_public_key, flutterwave_live_public_key, updated_at, updated_by"
    )
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    return { error: error.message };
  }
  return { settings: (data as ProviderSettingsRow | null) ?? undefined };
}

async function updateProviderSettings(formData: FormData) {
  "use server";
  if (!hasServerSupabaseEnv()) return;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return;

  const { data: existing } = await supabase
    .from("provider_settings")
    .select(
      "paystack_test_secret_key, paystack_live_secret_key, paystack_test_public_key, paystack_live_public_key, flutterwave_test_secret_key, flutterwave_live_secret_key, flutterwave_test_public_key, flutterwave_live_public_key"
    )
    .eq("id", "default")
    .maybeSingle();

  const resolveKey = (field: string, fallback?: string | null) => {
    const raw = formData.get(field);
    const value = typeof raw === "string" ? raw.trim() : "";
    return value.length > 0 ? value : fallback || null;
  };

  const stripeMode = normalizeProviderMode(String(formData.get("stripe_mode") || ""));
  const paystackMode = normalizeProviderMode(String(formData.get("paystack_mode") || ""));
  const flutterwaveMode = normalizeProviderMode(String(formData.get("flutterwave_mode") || ""));
  const now = new Date().toISOString();

  await supabase.from("provider_settings").upsert(
    {
      id: "default",
      stripe_mode: stripeMode,
      paystack_mode: paystackMode,
      flutterwave_mode: flutterwaveMode,
      paystack_test_secret_key: resolveKey(
        "paystack_test_secret_key",
        (existing as ProviderSettingsRow | null)?.paystack_test_secret_key
      ),
      paystack_live_secret_key: resolveKey(
        "paystack_live_secret_key",
        (existing as ProviderSettingsRow | null)?.paystack_live_secret_key
      ),
      paystack_test_public_key: resolveKey(
        "paystack_test_public_key",
        (existing as ProviderSettingsRow | null)?.paystack_test_public_key
      ),
      paystack_live_public_key: resolveKey(
        "paystack_live_public_key",
        (existing as ProviderSettingsRow | null)?.paystack_live_public_key
      ),
      flutterwave_test_secret_key: resolveKey(
        "flutterwave_test_secret_key",
        (existing as ProviderSettingsRow | null)?.flutterwave_test_secret_key
      ),
      flutterwave_live_secret_key: resolveKey(
        "flutterwave_live_secret_key",
        (existing as ProviderSettingsRow | null)?.flutterwave_live_secret_key
      ),
      flutterwave_test_public_key: resolveKey(
        "flutterwave_test_public_key",
        (existing as ProviderSettingsRow | null)?.flutterwave_test_public_key
      ),
      flutterwave_live_public_key: resolveKey(
        "flutterwave_live_public_key",
        (existing as ProviderSettingsRow | null)?.flutterwave_live_public_key
      ),
      updated_at: now,
      updated_by: user.id,
    },
    { onConflict: "id" }
  );

  revalidatePath("/admin/settings/billing");
  revalidatePath("/admin/billing");
}

const modeOptions = [
  { value: "test", label: "Test mode" },
  { value: "live", label: "Live mode" },
];

export default async function AdminBillingSettingsPage() {
  await requireAdmin();
  const { settings, error } = await loadSettings();

  if (error) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4">
        <ErrorState
          title="Billing settings unavailable"
          description={error}
          retryLabel="Back to Admin"
          retryHref="/admin"
        />
      </div>
    );
  }

  const stripeMode = normalizeProviderMode(settings?.stripe_mode);
  const paystackMode = normalizeProviderMode(settings?.paystack_mode);
  const flutterwaveMode = normalizeProviderMode(settings?.flutterwave_mode);

  const stripeEnv = {
    secret: !!process.env.STRIPE_SECRET_KEY,
    secretTest: !!process.env.STRIPE_SECRET_KEY_TEST,
    secretLive: !!process.env.STRIPE_SECRET_KEY_LIVE,
    webhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    webhookTest: !!process.env.STRIPE_WEBHOOK_SECRET_TEST,
    webhookLive: !!process.env.STRIPE_WEBHOOK_SECRET_LIVE,
    landlordMonthly: !!process.env.STRIPE_PRICE_LANDLORD_MONTHLY,
    landlordYearly: !!process.env.STRIPE_PRICE_LANDLORD_YEARLY,
    landlordMonthlyTest: !!process.env.STRIPE_PRICE_LANDLORD_MONTHLY_TEST,
    landlordMonthlyLive: !!process.env.STRIPE_PRICE_LANDLORD_MONTHLY_LIVE,
    landlordYearlyTest: !!process.env.STRIPE_PRICE_LANDLORD_YEARLY_TEST,
    landlordYearlyLive: !!process.env.STRIPE_PRICE_LANDLORD_YEARLY_LIVE,
    agentMonthly: !!process.env.STRIPE_PRICE_AGENT_MONTHLY,
    agentYearly: !!process.env.STRIPE_PRICE_AGENT_YEARLY,
    agentMonthlyTest: !!process.env.STRIPE_PRICE_AGENT_MONTHLY_TEST,
    agentMonthlyLive: !!process.env.STRIPE_PRICE_AGENT_MONTHLY_LIVE,
    agentYearlyTest: !!process.env.STRIPE_PRICE_AGENT_YEARLY_TEST,
    agentYearlyLive: !!process.env.STRIPE_PRICE_AGENT_YEARLY_LIVE,
    tenantMonthly: !!process.env.STRIPE_PRICE_TENANT_MONTHLY,
    tenantYearly: !!process.env.STRIPE_PRICE_TENANT_YEARLY,
    tenantMonthlyTest: !!process.env.STRIPE_PRICE_TENANT_MONTHLY_TEST,
    tenantMonthlyLive: !!process.env.STRIPE_PRICE_TENANT_MONTHLY_LIVE,
    tenantYearlyTest: !!process.env.STRIPE_PRICE_TENANT_YEARLY_TEST,
    tenantYearlyLive: !!process.env.STRIPE_PRICE_TENANT_YEARLY_LIVE,
  };

  const paystackEnv = {
    secret: !!process.env.PAYSTACK_SECRET_KEY,
    public: !!process.env.PAYSTACK_PUBLIC_KEY,
    secretTest: !!process.env.PAYSTACK_SECRET_KEY_TEST,
    secretLive: !!process.env.PAYSTACK_SECRET_KEY_LIVE,
    publicTest: !!process.env.PAYSTACK_PUBLIC_KEY_TEST,
    publicLive: !!process.env.PAYSTACK_PUBLIC_KEY_LIVE,
  };

  const flutterwaveEnv = {
    secret: !!process.env.FLUTTERWAVE_SECRET_KEY,
    public: !!process.env.FLUTTERWAVE_PUBLIC_KEY,
    secretTest: !!process.env.FLUTTERWAVE_SECRET_KEY_TEST,
    secretLive: !!process.env.FLUTTERWAVE_SECRET_KEY_LIVE,
    publicTest: !!process.env.FLUTTERWAVE_PUBLIC_KEY_TEST,
    publicLive: !!process.env.FLUTTERWAVE_PUBLIC_KEY_LIVE,
  };

  const paystackStored = {
    testSecret: settings?.paystack_test_secret_key || null,
    liveSecret: settings?.paystack_live_secret_key || null,
    testPublic: settings?.paystack_test_public_key || null,
    livePublic: settings?.paystack_live_public_key || null,
  };

  const flutterwaveStored = {
    testSecret: settings?.flutterwave_test_secret_key || null,
    liveSecret: settings?.flutterwave_live_secret_key || null,
    testPublic: settings?.flutterwave_test_public_key || null,
    livePublic: settings?.flutterwave_live_public_key || null,
  };

  const updatedAt = settings?.updated_at
    ? settings.updated_at.replace("T", " ").replace("Z", "")
    : "—";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Billing provider settings</p>
        <p className="text-sm text-slate-200">
          Toggle live/test mode per provider. Env keys remain the source of truth.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-200">
          <PaymentModeBadge mode={stripeMode} />
        </div>
        <p className="mt-2 text-xs text-slate-200">
          {stripeMode === "test"
            ? "You are in TEST mode. No real charges will be made."
            : "LIVE mode enabled."}
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/admin/billing" className="underline underline-offset-4">
            Back to Billing ops
          </Link>
          <Link href="/admin" className="underline underline-offset-4">
            Admin home
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Provider modes</h2>
        <p className="text-sm text-slate-600">
          Current modes are saved in the database. Stripe mode controls which keys are selected.
        </p>
        <form className="mt-4 space-y-4" action={updateProviderSettings}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Stripe</p>
              <p className="text-xs text-slate-500">Current: {stripeMode}</p>
              <select
                name="stripe_mode"
                defaultValue={stripeMode}
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                {modeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Paystack</p>
              <p className="text-xs text-slate-500">Current: {paystackMode}</p>
              <select
                name="paystack_mode"
                defaultValue={paystackMode}
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                {modeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Flutterwave</p>
              <p className="text-xs text-slate-500">Current: {flutterwaveMode}</p>
              <select
                name="flutterwave_mode"
                defaultValue={flutterwaveMode}
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                {modeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Paystack stored keys</p>
              <p className="text-xs text-slate-500">Leave blank to keep existing values.</p>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-xs text-slate-500">Test secret key</label>
                  <input
                    name="paystack_test_secret_key"
                    type="password"
                    autoComplete="off"
                    placeholder="ps_test_..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  {paystackStored.testSecret && (
                    <p className="mt-1 text-xs text-slate-500">
                      Saved: {maskIdentifier(paystackStored.testSecret)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500">Live secret key</label>
                  <input
                    name="paystack_live_secret_key"
                    type="password"
                    autoComplete="off"
                    placeholder="ps_live_..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  {paystackStored.liveSecret && (
                    <p className="mt-1 text-xs text-slate-500">
                      Saved: {maskIdentifier(paystackStored.liveSecret)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500">Test public key (optional)</label>
                  <input
                    name="paystack_test_public_key"
                    type="text"
                    autoComplete="off"
                    placeholder="pk_test_..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  {paystackStored.testPublic && (
                    <p className="mt-1 text-xs text-slate-500">
                      Saved: {maskIdentifier(paystackStored.testPublic)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500">Live public key (optional)</label>
                  <input
                    name="paystack_live_public_key"
                    type="text"
                    autoComplete="off"
                    placeholder="pk_live_..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  {paystackStored.livePublic && (
                    <p className="mt-1 text-xs text-slate-500">
                      Saved: {maskIdentifier(paystackStored.livePublic)}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Flutterwave stored keys</p>
              <p className="text-xs text-slate-500">Leave blank to keep existing values.</p>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-xs text-slate-500">Test secret key</label>
                  <input
                    name="flutterwave_test_secret_key"
                    type="password"
                    autoComplete="off"
                    placeholder="FLWSECK_TEST..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  {flutterwaveStored.testSecret && (
                    <p className="mt-1 text-xs text-slate-500">
                      Saved: {maskIdentifier(flutterwaveStored.testSecret)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500">Live secret key</label>
                  <input
                    name="flutterwave_live_secret_key"
                    type="password"
                    autoComplete="off"
                    placeholder="FLWSECK_LIVE..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  {flutterwaveStored.liveSecret && (
                    <p className="mt-1 text-xs text-slate-500">
                      Saved: {maskIdentifier(flutterwaveStored.liveSecret)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500">Test public key (optional)</label>
                  <input
                    name="flutterwave_test_public_key"
                    type="text"
                    autoComplete="off"
                    placeholder="FLWPUBK_TEST..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  {flutterwaveStored.testPublic && (
                    <p className="mt-1 text-xs text-slate-500">
                      Saved: {maskIdentifier(flutterwaveStored.testPublic)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-slate-500">Live public key (optional)</label>
                  <input
                    name="flutterwave_live_public_key"
                    type="text"
                    autoComplete="off"
                    placeholder="FLWPUBK_LIVE..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  {flutterwaveStored.livePublic && (
                    <p className="mt-1 text-xs text-slate-500">
                      Saved: {maskIdentifier(flutterwaveStored.livePublic)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Last updated: {updatedAt}</span>
            <Button size="sm" type="submit">
              Save settings
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Environment readiness (fallback)</h2>
        <p className="text-sm text-slate-600">
          Keys are never shown. Green means the env key is present if database keys are missing.
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Stripe keys</p>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <li>Secret (single): {stripeEnv.secret ? "Yes" : "No"}</li>
              <li>Secret (test): {stripeEnv.secretTest ? "Yes" : "No"}</li>
              <li>Secret (live): {stripeEnv.secretLive ? "Yes" : "No"}</li>
              <li>Webhook (single): {stripeEnv.webhook ? "Yes" : "No"}</li>
              <li>Webhook (test): {stripeEnv.webhookTest ? "Yes" : "No"}</li>
              <li>Webhook (live): {stripeEnv.webhookLive ? "Yes" : "No"}</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Stripe prices</p>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <li>Landlord monthly: {stripeEnv.landlordMonthly ? "Yes" : "No"}</li>
              <li>Landlord monthly (test): {stripeEnv.landlordMonthlyTest ? "Yes" : "No"}</li>
              <li>Landlord monthly (live): {stripeEnv.landlordMonthlyLive ? "Yes" : "No"}</li>
              <li>Landlord yearly: {stripeEnv.landlordYearly ? "Yes" : "No"}</li>
              <li>Agent monthly: {stripeEnv.agentMonthly ? "Yes" : "No"}</li>
              <li>Agent yearly: {stripeEnv.agentYearly ? "Yes" : "No"}</li>
              <li>Tenant monthly: {stripeEnv.tenantMonthly ? "Yes" : "No"}</li>
              <li>Tenant yearly: {stripeEnv.tenantYearly ? "Yes" : "No"}</li>
            </ul>
          </div>
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-slate-900">Paystack keys</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-600">
                <li>Secret (single): {paystackEnv.secret ? "Yes" : "No"}</li>
                <li>Public (single): {paystackEnv.public ? "Yes" : "No"}</li>
                <li>Secret (test): {paystackEnv.secretTest ? "Yes" : "No"}</li>
                <li>Secret (live): {paystackEnv.secretLive ? "Yes" : "No"}</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Flutterwave keys</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-600">
                <li>Secret (single): {flutterwaveEnv.secret ? "Yes" : "No"}</li>
                <li>Public (single): {flutterwaveEnv.public ? "Yes" : "No"}</li>
                <li>Secret (test): {flutterwaveEnv.secretTest ? "Yes" : "No"}</li>
                <li>Secret (live): {flutterwaveEnv.secretLive ? "Yes" : "No"}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
