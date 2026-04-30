import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  assessMoveReadyRoutingReadiness,
  type MoveReadyProviderRecord,
} from "@/lib/services/move-ready.server";
import type { MoveReadyServiceCategory } from "@/lib/services/move-ready";

export const dynamic = "force-dynamic";

export default async function AdminMoveReadyServicesPage() {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return <div className="p-6 text-sm text-slate-600">Supabase is not configured.</div>;
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/services&reason=auth");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");

  const client = createServiceRoleClient();
  const [{ data: providersData }, { data: requestsData }] = await Promise.all([
    client
      .from("move_ready_service_providers")
      .select(
        "id,business_name,contact_name,email,phone,verification_state,provider_status,move_ready_provider_categories(category),move_ready_provider_areas(market_code,city,area)"
      ),
    client
      .from("move_ready_requests")
      .select("id,category,market_code,city,area"),
  ]);

  const providers = (providersData ?? []) as MoveReadyProviderRecord[];
  const requests = ((requestsData ?? []) as Array<{
    id: string;
    category: string;
    market_code: string;
    city: string | null;
    area: string | null;
  }>).map((request) =>
    assessMoveReadyRoutingReadiness(providers, {
      category: request.category as MoveReadyServiceCategory,
      marketCode: request.market_code,
      city: request.city,
      area: request.area,
    })
  );

  const supplierApplicationsSubmitted = providers.length;
  const suppliersApproved = providers.filter(
    (provider) => provider.verification_state === "approved" && provider.provider_status === "active"
  ).length;
  const requestsRouteReady = requests.filter((request) => request.status === "route_ready").length;
  const requestsManualRouting = requests.filter(
    (request) => request.status === "manual_routing_required"
  ).length;

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
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Applications</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{supplierApplicationsSubmitted}</p>
          <p className="mt-1 text-sm text-slate-600">Supplier applications submitted</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Approved</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{suppliersApproved}</p>
          <p className="mt-1 text-sm text-slate-600">Active approved suppliers</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Route-ready</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{requestsRouteReady}</p>
          <p className="mt-1 text-sm text-slate-600">Requests with approved matching suppliers</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Manual gaps</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{requestsManualRouting}</p>
          <p className="mt-1 text-sm text-slate-600">Requests needing manual routing follow-up</p>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Keep the wedge narrow until the pilot scorecard passes. Do not expand to tenant requests,
        removals, scheduling, payments, or public provider discovery from this surface.
        <div className="mt-3 flex flex-wrap gap-4">
          <Link href="/help/admin/support-playbooks/move-ready-services" className="font-semibold underline">
            Pilot launch pack
          </Link>
          <Link href="/services/providers/apply" className="font-semibold underline">
            Supplier application form
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
