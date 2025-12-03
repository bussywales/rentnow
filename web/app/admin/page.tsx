import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminProperty = {
  id: string;
  title: string;
  city: string;
  rental_type: string;
  is_approved: boolean;
};

type AdminUser = {
  id: string;
  role: string;
  full_name: string | null;
};

async function getData() {
  const supabase = createServerSupabaseClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, title, city, rental_type, is_approved")
    .order("created_at", { ascending: false });

  const { data: users } = await supabase
    .from("profiles")
    .select("id, role, full_name");

  return {
    properties: (properties as AdminProperty[]) || [],
    users: (users as AdminUser[]) || [],
  };
}

async function updateStatus(id: string, action: "approve" | "reject") {
  "use server";
  const supabase = createServerSupabaseClient();
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

  await supabase
    .from("properties")
    .update({ is_approved: action === "approve" })
    .eq("id", id);
}

export default async function AdminPage() {
  const { properties, users } = await getData();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Control panel</p>
        <p className="text-sm text-slate-200">
          Approve listings and audit users. Restricted to role = admin.
        </p>
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
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Properties</h2>
            <p className="text-sm text-slate-600">
              Approve or reject listings before they go live.
            </p>
          </div>
          <Link href="/dashboard/properties/new" className="text-sm text-sky-700">
            Create listing
          </Link>
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
                  {property.city} • {property.rental_type}
                </p>
                <p className="text-xs">
                  Status:{" "}
                  {property.is_approved ? (
                    <span className="text-emerald-600">Approved</span>
                  ) : (
                    <span className="text-amber-600">Pending</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={updateStatus.bind(null, property.id, "approve")}>
                  <Button size="sm" type="submit">
                    Approve
                  </Button>
                </form>
                <form action={updateStatus.bind(null, property.id, "reject")}>
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
    </div>
  );
}
