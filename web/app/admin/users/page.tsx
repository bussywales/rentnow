import { redirect } from "next/navigation";
import { AdminUsersPanelClient } from "@/components/admin/AdminUsersPanelClient";
import {
  filterAdminUsers,
  parseAdminUsersQuery,
  type AdminUserRow,
  type AdminUsersQuery,
} from "@/lib/admin/admin-users";
import { getAdminAccessState, shouldShowProfileMissing } from "@/lib/admin/user-view";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

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

const LIST_USERS_PAGE_SIZE = 200;
const MAX_SCAN_PAGES = 10;
const CHUNK_SIZE = 200;

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/users&reason=auth");
  }
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/users&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();
  const access = getAdminAccessState(profile);
  if (!access.isAdmin) redirect("/forbidden?reason=role");
  return access;
}

async function listAllUsers(adminClient: ReturnType<typeof createServiceRoleClient>) {
  const users: AdminAuthUser[] = [];
  let page = 1;
  let truncated = false;

  while (page <= MAX_SCAN_PAGES) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PAGE_SIZE,
    });
    if (error) {
      throw error;
    }
    const batch = (data?.users as AdminAuthUser[]) || [];
    users.push(...batch);
    if (batch.length < LIST_USERS_PAGE_SIZE) {
      return { users, truncated: false };
    }
    page += 1;
  }

  truncated = true;
  return { users, truncated };
}

async function getUsers() {
  if (!hasServiceRoleEnv()) {
    return {
      users: [],
      profiles: [],
      plans: [],
      notes: [],
      pendingCount: 0,
      pendingMap: {} as Record<string, number>,
      truncated: false,
    };
  }
  try {
    const adminClient = createServiceRoleClient();
    const { users, truncated } = await listAllUsers(adminClient);
    const ids = users.map((u) => u.id);
    if (!ids.length) {
      return {
        users: [],
        profiles: [],
        plans: [],
        notes: [],
        pendingCount: 0,
        pendingMap: {} as Record<string, number>,
        truncated,
      };
    }
    const chunks = Array.from({ length: Math.ceil(ids.length / CHUNK_SIZE) }, (_, index) =>
      ids.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE)
    );

    const profiles: ProfileRow[] = [];
    const plans: PlanRow[] = [];
    const notes: BillingNotesRow[] = [];

    for (const chunk of chunks) {
      const { data: profileRows } = await adminClient
        .from("profiles")
        .select("id, role, full_name, onboarding_completed")
        .in("id", chunk);
      if (profileRows) profiles.push(...(profileRows as ProfileRow[]));

      const { data: planRows } = await adminClient
        .from("profile_plans")
        .select(
          "profile_id, plan_tier, max_listings_override, valid_until, billing_source, stripe_status, stripe_current_period_end"
        )
        .in("profile_id", chunk);
      if (planRows) plans.push(...(planRows as PlanRow[]));

      const { data: noteRows } = await adminClient
        .from("profile_billing_notes")
        .select("profile_id, billing_notes")
        .in("profile_id", chunk);
      if (noteRows) notes.push(...(noteRows as BillingNotesRow[]));
    }
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
      users,
      profiles,
      plans,
      notes,
      pendingCount: Object.values(pendingMap).reduce((sum, count) => sum + count, 0),
      pendingMap,
      truncated,
    };
  } catch (error) {
    console.error("[admin/users] listUsers failed", (error as Error)?.message ?? error);
    return {
      users: [],
      profiles: [],
      plans: [],
      notes: [],
      pendingCount: 0,
      pendingMap: {} as Record<string, number>,
      truncated: false,
    };
  }
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

async function resolveSearchParams(raw?: SearchParams | Promise<SearchParams>) {
  if (raw && typeof (raw as { then?: unknown }).then === "function") {
    return (raw as Promise<SearchParams>);
  }
  return raw ?? {};
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const adminAccess = await requireAdmin();
  const serviceReady = hasServiceRoleEnv();
  const params = await resolveSearchParams(searchParams);
  const query = parseAdminUsersQuery(params);
  const { users, profiles, plans, notes, pendingCount, pendingMap, truncated } = await getUsers();
  const adminActionsDisabled = adminAccess.actionsDisabled;

  const rows: AdminUserRow[] = users.map((user) => {
    const profile = joinProfile(profiles, user.id);
    const plan = joinPlan(plans, user.id);
    const note = joinNotes(notes, user.id);
    const pendingForUser = pendingMap[user.id] ?? 0;
    const profileMissing = shouldShowProfileMissing(profile, serviceReady);
    return {
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      fullName: profile?.full_name ?? null,
      role: profile?.role ?? null,
      onboardingCompleted: profile?.onboarding_completed ?? null,
      planTier: plan?.plan_tier ?? null,
      maxListingsOverride: plan?.max_listings_override ?? null,
      validUntil: plan?.valid_until ?? null,
      billingNotes: note?.billing_notes ?? null,
      billingSource: plan?.billing_source ?? null,
      stripeStatus: plan?.stripe_status ?? null,
      stripeCurrentPeriodEnd: plan?.stripe_current_period_end ?? null,
      pendingCount: pendingForUser,
      profileMissing,
    };
  });

  const sortedRows = rows.slice().sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });

  const filteredRows = filterAdminUsers(sortedRows, query);
  const totalCount = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / query.pageSize));
  const safePage = Math.min(query.page, pageCount);
  const pageStart = (safePage - 1) * query.pageSize;
  const pagedRows = filteredRows.slice(pageStart, pageStart + query.pageSize);
  const safeQuery: AdminUsersQuery = { ...query, page: safePage };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-10">
      <AdminUsersPanelClient
        users={pagedRows}
        query={safeQuery}
        totalCount={totalCount}
        pageCount={pageCount}
        pendingCount={pendingCount}
        serviceReady={serviceReady}
        actionsDisabled={adminActionsDisabled}
        showOnboardingBanner={adminAccess.showOnboardingBanner}
        truncated={truncated}
      />
    </div>
  );
}
