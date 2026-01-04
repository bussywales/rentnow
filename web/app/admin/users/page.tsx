import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { isPlanExpired, normalizePlanTier } from "@/lib/plans";
import { formatRoleStatus } from "@/lib/roles";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminAuthUser = {
  id: string;
  email?: string;
  phone?: string;
  created_at?: string;
  last_sign_in_at?: string;
};

type ProfileRow = {
  id: string;
  role: string | null;
  full_name: string | null;
  onboarding_completed?: boolean | null;
};
type PlanRow = {
  profile_id: string;
  plan_tier: string | null;
  max_listings_override: number | null;
  valid_until: string | null;
  billing_source?: string | null;
  stripe_status?: string | null;
  stripe_current_period_end?: string | null;
};
type BillingNotesRow = { profile_id: string; billing_notes: string | null };

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/users&reason=auth");
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/required?redirect=/admin/users&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");
}

async function getUsers() {
  if (!hasServiceRoleEnv()) {
    return { users: [], profiles: [], plans: [], notes: [], pendingCount: 0, pendingMap: {} as Record<string, number> };
  }
  const adminClient = createServiceRoleClient();
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    console.error("[admin/users] listUsers failed", error.message);
    return { users: [], profiles: [], plans: [], notes: [], pendingCount: 0, pendingMap: {} as Record<string, number> };
  }
  const supabase = await createServerSupabaseClient();
  const ids = (data.users || []).map((u) => u.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role, full_name, onboarding_completed")
    .in("id", ids);
  const { data: plans } = await adminClient
    .from("profile_plans")
    .select("profile_id, plan_tier, max_listings_override, valid_until, billing_source, stripe_status, stripe_current_period_end")
    .in("profile_id", ids);
  const { data: notes } = await adminClient
    .from("profile_billing_notes")
    .select("profile_id, billing_notes")
    .in("profile_id", ids);
  const { data: pendingRequests } = await adminClient
    .from("plan_upgrade_requests")
    .select("profile_id, status")
    .eq("status", "pending");
  const pendingMap = (pendingRequests || []).reduce<Record<string, number>>((acc, row) => {
    const profileId = (row as { profile_id?: string | null }).profile_id;
    if (profileId) acc[profileId] = (acc[profileId] || 0) + 1;
    return acc;
  }, {});
  return {
    users: (data.users as AdminAuthUser[]) || [],
    profiles: (profiles as ProfileRow[]) || [],
    plans: (plans as PlanRow[]) || [],
    notes: (notes as BillingNotesRow[]) || [],
    pendingCount: Object.values(pendingMap).reduce((sum, count) => sum + count, 0),
    pendingMap,
  };
}

function joinProfile(profiles: ProfileRow[], userId: string) {
  return profiles.find((p) => p.id === userId) || null;
}

function joinPlan(plans: PlanRow[], userId: string) {
  return plans.find((plan) => plan.profile_id === userId) || null;
}

function joinNotes(notes: BillingNotesRow[], userId: string) {
  return notes.find((note) => note.profile_id === userId) || null;
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const serviceReady = hasServiceRoleEnv();
  const { users, profiles, plans, notes, pendingCount, pendingMap } = await getUsers();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">User management</p>
        <p className="text-sm text-slate-200">
          Reset passwords, delete accounts, and review roles.
        </p>
        {!serviceReady && (
          <p className="mt-2 text-sm text-amber-100">
            Add SUPABASE_SERVICE_ROLE_KEY to enable admin user actions.
          </p>
        )}
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/admin" className="underline underline-offset-4">
            Back to Admin
          </Link>
          <Link href="/proxy/auth?path=/admin/users" className="underline underline-offset-4">
            Proxy check
          </Link>
          {pendingCount > 0 && (
            <Link href="/admin/billing#upgrade-requests" className="underline underline-offset-4">
              Pending requests ({pendingCount})
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Users</h2>
            <p className="text-sm text-slate-600">
              Only admins can perform actions. Password reset sends the Supabase recovery email.
            </p>
          </div>
        </div>

        {!users.length && (
          <p className="text-sm text-slate-600">No users found or admin API unavailable.</p>
        )}

        <div className="divide-y divide-slate-100 text-sm">
          {users.map((user) => {
            const profile = joinProfile(profiles, user.id);
            const plan = joinPlan(plans, user.id);
            const note = joinNotes(notes, user.id);
            const planTier = normalizePlanTier(plan?.plan_tier ?? "free");
            const expired = isPlanExpired(plan?.valid_until ?? null);
            const pendingForUser = pendingMap[user.id] ?? 0;
            return (
              <div key={user.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{user.email || "No email"}</p>
                    {pendingForUser > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                        Pending request
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600">
                    Role: {formatRoleStatus(profile?.role, profile?.onboarding_completed ?? null)} • Name:{" "}
                    {profile?.full_name || "—"} • Plan:{" "}
                    {planTier}
                  </p>
                  <p className="text-xs text-slate-500">
                    Source: {plan?.billing_source || "manual"} • Status: {plan?.stripe_status || "—"} • Valid
                    until: {plan?.valid_until?.slice(0, 10) || "—"}{expired ? " (expired)" : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    Created: {user.created_at?.replace("T", " ").replace("Z", "") || "—"} | Last
                    sign-in: {user.last_sign_in_at?.replace("T", " ").replace("Z", "") || "—"}
                  </p>
                </div>
                <AdminUserActions
                  userId={user.id}
                  email={user.email}
                  serviceReady={serviceReady}
                  currentRole={profile?.role ?? null}
                  onboardingCompleted={profile?.onboarding_completed ?? null}
                  planTier={plan?.plan_tier ?? null}
                  maxListingsOverride={plan?.max_listings_override ?? null}
                  validUntil={plan?.valid_until ?? null}
                  billingNotes={note?.billing_notes ?? null}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
