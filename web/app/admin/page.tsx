import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logApprovalAction } from "@/lib/observability";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

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

async function updateUpgradeRequest(formData: FormData) {
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

  const id = String(formData.get("id") || "");
  const action = formData.get("action");
  const status =
    action === "approve" ? "approved" : action === "reject" ? "rejected" : null;
  if (!id || !status) return;

  const now = new Date().toISOString();
  await supabase
    .from("plan_upgrade_requests")
    .update({
      status,
      resolved_at: now,
      resolved_by: user.id,
      updated_at: now,
    })
    .eq("id", id);

  revalidatePath("/admin");
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
      console.warn("Admin auth guard failed; showing demo state", err);
    }
  }

  const { properties, users, requests } = await getData(statusFilter, searchParam, ownerParam);

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
                <p className="text-slate-600">Role: {user.role}</p>
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
          <form id="bulk-approvals" action={bulkUpdate} className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Bulk actions
              </p>
              <p className="text-xs text-slate-600">
                Select listings below to approve or reject them together.
              </p>
            </div>
            <div className="min-w-[220px]">
              <Input
                name="reason"
                placeholder="Rejection reason"
                className="h-9"
                minLength={3}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" name="action" value="approve" formNoValidate>
                Approve selected
              </Button>
              <Button size="sm" variant="secondary" type="submit" name="action" value="reject">
                Reject selected
              </Button>
            </div>
          </form>
        </div>
        <div className="grid gap-3">
          {properties.map((property) => (
            <div
              key={property.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
            >
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
              <div className="flex items-center gap-3">
                <input
                  form="bulk-approvals"
                  type="checkbox"
                  name="ids"
                  value={property.id}
                  aria-label={`Select ${property.title}`}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-xs text-slate-500">Select</span>
              </div>
              <div className="flex items-center gap-2">
                <form
                  className="flex items-center gap-2"
                  action={updateStatus.bind(null, property.id, "approve")}
                >
                  <Button size="sm" type="submit">
                    Approve
                  </Button>
                </form>
                <form
                  className="flex items-center gap-2"
                  action={updateStatus.bind(null, property.id, "reject")}
                >
                  <Input
                    name="reason"
                    placeholder="Rejection reason"
                    className="h-9 w-44"
                    minLength={3}
                    required
                  />
                  <Button size="sm" variant="secondary" type="submit">
                    Reject
                  </Button>
                </form>
              </div>
            </div>
          ))}
          {!properties.length && (
            <p className="text-sm text-slate-600">No properties found.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Upgrade requests</h2>
            <p className="text-sm text-slate-600">
              Manual billing requests from landlords and agents.
            </p>
          </div>
        </div>
        {!requests.length && (
          <p className="text-sm text-slate-600">No upgrade requests.</p>
        )}
        <div className="divide-y divide-slate-100 text-sm">
          {requests.map((request) => {
            const requester = users.find((u) => u.id === request.requester_id);
            return (
              <div key={request.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {requester?.full_name || requester?.id || "Unknown requester"}
                  </p>
                  <p className="text-slate-600">
                    Requested: {request.requested_plan_tier || "starter"} • Status:{" "}
                    {request.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    Created: {request.created_at?.replace("T", " ").replace("Z", "") || "—"}
                  </p>
                </div>
                {request.status === "pending" && (
                  <div className="flex gap-2">
                    <form action={updateUpgradeRequest}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="action" value="approve" />
                      <Button size="sm" type="submit">
                        Mark approved
                      </Button>
                    </form>
                    <form action={updateUpgradeRequest}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="action" value="reject" />
                      <Button size="sm" variant="secondary" type="submit">
                        Reject
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
