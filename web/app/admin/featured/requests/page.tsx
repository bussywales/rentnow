import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import AdminFeaturedRequestsQueue from "@/components/admin/AdminFeaturedRequestsQueue";
import { fetchFeaturedRequestsQueue } from "@/lib/featured/requests.server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/featured/requests&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  return {
    client: hasServiceRoleEnv()
      ? (createServiceRoleClient() as unknown as SupabaseClient)
      : (supabase as unknown as SupabaseClient),
  };
}

export default async function AdminFeaturedRequestsPage() {
  const { client } = await requireAdmin();
  const requests = await fetchFeaturedRequestsQueue({
    client,
    filters: {
      status: "pending",
      timeframe: "30d",
      limit: 200,
    },
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Featured requests</p>
        <p className="text-sm text-slate-200">
          Review host requests and schedule featured placements.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/listings" className="underline underline-offset-4">
            Listings registry
          </Link>
          <Link href="/admin/settings" className="underline underline-offset-4">
            Admin settings
          </Link>
          <Link href="/admin" className="underline underline-offset-4">
            Admin home
          </Link>
        </div>
      </div>

      <AdminFeaturedRequestsQueue initialRequests={requests} />
    </div>
  );
}
