import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyBulkActions } from "@/components/admin/PropertyBulkActions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { UpgradeRequestsQueue } from "@/components/admin/UpgradeRequestsQueue";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logApprovalAction } from "@/lib/observability";
import { formatRoleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

function isRedirectError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

type AdminProperty = {
  id: string;
  title: string;
  city: string;
  rental_type: string;
  is_approved: boolean;
  status?: string | null;
  rejection_reason?: string | null;
  owner_id?: string;
};

type AdminUser = {
  id: string;
  role: string;
  full_name: string | null;
};

type UpgradeRequest = {
  id: string;
  profile_id: string;
  requester_id: string;
  requested_plan_tier: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

async function getData(
  status: "all" | "draft" | "pending" | "live" | "rejected" | "paused" = "all",
  search = "",
  ownerId = ""
) {
  if (!hasServerSupabaseEnv()) {
    return { properties: [], users: [], requests: [] };
  }

  try {
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("properties")
      .select("id, title, city, rental_type, is_approved, owner_id, status, rejection_reason")
      .order("created_at", { ascending: false });

    if (status !== "all") query = query.eq("status", status);
    if (ownerId) query = query.eq("owner_id", ownerId);
    if (search) {
      query = query.ilike("title", `%${search}%`);
    }

    const { data: properties } = await query;

    const { data: users } = await supabase
      .from("profiles")
      .select("id, role, full_name");

    const { data: requests } = await supabase
      .from("plan_upgrade_requests")
      .select("id, profile_id, requester_id, requested_plan_tier, status, notes, created_at")
      .order("created_at", { ascending: false });

    return {
      properties: (properties as AdminProperty[]) || [],
      users: (users as AdminUser[]) || [],
      requests: (requests as UpgradeRequest[]) || [],
    };
  } catch (err) {
    console.warn("Admin data load failed; rendering empty state", err);
    return { properties: [], users: [], requests: [] };
  }
}

async function updateStatus(
  id: string,
  action: "approve" | "reject",
  formData: FormData
) {
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

  const rejectionReason = formData.get("reason");
  const reason =
    typeof rejectionReason === "string" ? rejectionReason.trim() : null;

  if (action === "reject" && !reason) return;
  const now = new Date().toISOString();

  await supabase
    .from("properties")
    .update(
      action === "approve"
        ? {
            status: "live",
            is_approved: true,
            is_active: true,
            approved_at: now,
            rejection_reason: null,
            rejected_at: null,
          }
        : {
            status: "rejected",
            is_approved: false,
            is_active: false,
            rejected_at: now,
            rejection_reason: reason,
          }
    )
    .eq("id", id);

  logApprovalAction({
    route: "/admin",
    actorId: user.id,
    propertyId: id,
    action,
    reasonProvided: action === "reject",
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

async function bulkUpdate(formData: FormData) {
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

  const ids = formData.getAll("ids").map((value) => String(value)).filter(Boolean);
  if (!ids.length) return;

  const actionValue = formData.get("action");
  const action = actionValue === "approve" || actionValue === "reject" ? actionValue : null;
  if (!action) return;

  const reasonValue = formData.get("reason");
  const reason = typeof reasonValue === "string" ? reasonValue.trim() : "";
  if (action === "reject" && !reason) return;

  const now = new Date().toISOString();
  const update =
    action === "approve"
      ? {
          status: "live",
          is_approved: true,
          is_active: true,
          approved_at: now,
          rejection_reason: null,
          rejected_at: null,
        }
      : {
          status: "rejected",
          is_approved: false,
          is_active: false,
          rejected_at: now,
          rejection_reason: reason,
        };

  const { error } = await supabase.from("properties").update(update).in("id", ids);
  if (error) return;

  ids.forEach((propertyId) => {
    logApprovalAction({
      route: "/admin",
      actorId: user.id,
      propertyId,
      action,
      reasonProvided: action === "reject",
    });
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export default async function AdminPage({ searchParams }: Props) {
  const supabaseReady = hasServerSupabaseEnv();
  const statusParam = searchParams.status
    ? Array.isArray(searchParams.status)
      ? searchParams.status[0]
      : searchParams.status
    : null;
  const ownerParam = searchParams.owner
    ? Array.isArray(searchParams.owner)
      ? searchParams.owner[0]
      : searchParams.owner
    : "";
  const searchParam = searchParams.q
    ? Array.isArray(searchParams.q)
      ? searchParams.q[0]
      : searchParams.q
    : "";
  const statusFilter =
    statusParam && ["draft", "pending", "live", "rejected", "paused"].includes(statusParam)
      ? (statusParam as "draft" | "pending" | "live" | "rejected" | "paused")
      : "all";

  if (supabaseReady) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        redirect("/auth/required?redirect=/admin&reason=auth");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role !== "admin") {
        redirect("/forbidden?reason=role");
      }
    } catch (err) {
      if (isRedirectError(err)) {
        throw err;
      }
      console.warn("Admin auth guard failed; showing demo state", err);
    }
  }

  const { properties, users, requests } = await getData(statusFilter, searchParam, ownerParam);
  const pendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Control panel</p>
        <p className="text-sm text-slate-200">
          Approve listings and audit users. Restricted to role = admin.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link
            href="/admin/users"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Open user management
          </Link>
          <Link
            href="/admin/billing"
            className="inline-flex items-center justify-center rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25"
          >
            Billing events
          </Link>
          <Link href="/admin#upgrade-requests" className="inline-flex items-center gap-2 text-sm underline">
            Upgrade requests
            {pendingCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">
                {pendingCount}
              </span>
            )}
          </Link>
        </div>
        {!supabaseReady && (
          <p className="mt-2 text-sm text-amber-100">
            Connect Supabase to moderate real data. Demo mode shows empty lists.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Users</h2>
            <p className="text-sm text-slate-600">
              Basic list for audits (Supabase auth + profiles).
            </p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 text-sm">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-semibold text-slate-900">
                  {user.full_name || "No name"}
                </p>
                <p className="text-slate-600">Role: {formatRoleLabel(user.role)}</p>
              </div>
            </div>
          ))}
          {!users.length && (
            <p className="text-sm text-slate-600">No users found.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Properties</h2>
            <p className="text-sm text-slate-600">
              Approve or reject listings before they go live.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form className="flex flex-wrap items-center gap-2" action="/admin" method="get">
              <select
                name="status"
                defaultValue={statusFilter}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="live">Live</option>
                <option value="draft">Draft</option>
                <option value="rejected">Rejected</option>
                <option value="paused">Paused</option>
              </select>
              <select
                name="owner"
                defaultValue={ownerParam}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                <option value="">All owners</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.id.slice(0, 6)}
                  </option>
                ))}
              </select>
              <Input
                name="q"
                defaultValue={searchParam}
                placeholder="Search title"
                className="h-9"
              />
              <Button size="sm" type="submit">
                Filter
              </Button>
            </form>
            <Link href="/dashboard/properties/new" className="text-sm text-sky-700">
              Create listing
            </Link>
          </div>
        </div>
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <PropertyBulkActions action={bulkUpdate} />
        </div>
        <div className="grid gap-3">
          {properties.map((property) => (
            <div
              key={property.id}
              className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[32px_minmax(0,1fr)_auto] md:items-start"
            >
              <div className="flex items-start pt-1">
                <input
                  form="bulk-approvals"
                  type="checkbox"
                  name="ids"
                  value={property.id}
                  aria-label={`Select ${property.title}`}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {property.title}
                </p>
                <p className="text-xs text-slate-600">
                  {property.city} - {property.rental_type}
                </p>
                <p className="text-xs">
                  Status:{" "}
                  <span className="text-slate-700">{property.status || "pending"}</span>
                </p>
                {property.rejection_reason && (
                  <p className="text-xs text-rose-600">
                    Reason: {property.rejection_reason}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <form
                  className="flex items-center"
                  action={updateStatus.bind(null, property.id, "approve")}
                >
                  <Button size="sm" type="submit">
                    Approve
                  </Button>
                </form>
                <details className="group">
                  <summary className="list-none cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200">
                    Reject
                  </summary>
                  <form
                    className="mt-2 flex flex-wrap items-center gap-2"
                    action={updateStatus.bind(null, property.id, "reject")}
                  >
                    <Input
                      name="reason"
                      placeholder="Reason for rejection"
                      className="h-9 w-48"
                      minLength={3}
                      required
                    />
                    <Button size="sm" variant="secondary" type="submit">
                      Confirm reject
                    </Button>
                  </form>
                </details>
              </div>
            </div>
          ))}
          {!properties.length && (
            <p className="text-sm text-slate-600">No properties found.</p>
          )}
        </div>
      </div>

      <UpgradeRequestsQueue initialRequests={requests} users={users} />
    </div>
  );
}
