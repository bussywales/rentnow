import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { loadDeliveryMonitorBoard } from "@/lib/admin/delivery-monitor.server";
import { summarizeDeliveryMonitorCounts } from "@/lib/admin/delivery-monitor";
import { AdminDeliveryMonitorClient } from "@/components/admin/AdminDeliveryMonitorClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function AdminDeliveryMonitorPage() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/delivery-monitor&reason=auth");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/forbidden?reason=role");

  const items = await loadDeliveryMonitorBoard(supabase);
  const counts = summarizeDeliveryMonitorCounts(items);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8" data-testid="admin-delivery-monitor-page">
      <section className="rounded-2xl bg-slate-900 px-6 py-5 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <h1 className="text-3xl font-semibold">Delivery Monitor</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-200">
          Internal closure board for stakeholder workstreams, delivery state, and verification follow-through.
          This is not a general roadmap system.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-200">
          <span>Total items: <span className="font-semibold text-white">{counts.total}</span></span>
          <span>Testing passed: <span className="font-semibold text-white">{counts.passed}</span></span>
          <span>Testing failed: <span className="font-semibold text-white">{counts.failed}</span></span>
          <span>Testing in progress: <span className="font-semibold text-white">{counts.in_progress}</span></span>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
        Seeded from repo-truth workstreams and recent closure states. Runtime updates are intentionally limited to
        status changes, test outcomes, and notes.
      </div>

      <AdminDeliveryMonitorClient items={items} />
    </div>
  );
}
