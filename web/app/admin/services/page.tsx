import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminMoveReadyServicesPage() {
  if (!hasServerSupabaseEnv()) {
    return <div className="p-6 text-sm text-slate-600">Supabase is not configured.</div>;
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/services&reason=auth");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Move &amp; Ready Services</h1>
        <p className="text-sm text-slate-600">
          Curated property-prep routing only. This is not a public services marketplace.
        </p>
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
            Pilot active
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
            Manual routing
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
            Limited capacity
          </span>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Keep the wedge narrow until the pilot scorecard passes. Do not expand to tenant requests,
        removals, scheduling, payments, or public provider discovery from this surface.
        <div className="mt-3 flex flex-wrap gap-4">
          <Link href="/help/admin/support-playbooks/move-ready-services" className="font-semibold underline">
            Operator playbook
          </Link>
          <Link href="/help/host/services" className="font-semibold underline">
            Host pilot guide
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/services/providers" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Providers</p>
          <p className="mt-2 text-sm text-slate-600">
            Approve, reject, or pause vetted providers and keep category and area coverage tight.
          </p>
        </Link>
        <Link href="/admin/services/requests" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Requests</p>
          <p className="mt-2 text-sm text-slate-600">
            Review matched and unmatched property-prep requests and route manually where needed.
          </p>
        </Link>
      </div>
    </div>
  );
}
