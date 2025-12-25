import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getDiagnostics() {
  if (!hasServerSupabaseEnv()) {
    return { supabaseReady: false };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/required?redirect=/admin/support&reason=auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const [propsApproved, propsPending, savedCount] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("is_approved", true).eq("is_active", true),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("is_approved", false),
    supabase.from("saved_properties").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  return {
    supabaseReady: true,
    userId: user.id,
    role: profile?.role,
    counts: {
      approved: propsApproved.count ?? 0,
      pending: propsPending.count ?? 0,
      savedForUser: savedCount.count ?? 0,
    },
    errors: {
      approved: propsApproved.error?.message ?? null,
      pending: propsPending.error?.message ?? null,
      saved: savedCount.error?.message ?? null,
    },
  };
}

export default async function AdminSupportPage() {
  const diag = await getDiagnostics();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Support & Diagnostics</h1>
        <p className="text-sm text-slate-600">Only visible to admins. Quick checks and tools for debugging.</p>
      </div>

      {!diag.supabaseReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Supabase is not configured; diagnostics are limited. Set the Supabase env vars in Vercel.
        </div>
      )}

      {diag.supabaseReady && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Auth & role</h3>
            <p className="text-sm text-slate-600">User: {diag.userId}</p>
            <p className="text-sm text-slate-600">Role: {diag.role || "unknown"}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Link href="/api/debug/session" className="text-sky-700 underline">
                /api/debug/session
              </Link>
              <Link href="/api/debug/env" className="text-sky-700 underline">
                /api/debug/env
              </Link>
              <Link href="/api/debug/rls" className="text-sky-700 underline">
                /api/debug/rls
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Data posture</h3>
            <ul className="text-sm text-slate-700">
              <li>Approved listings: {diag.counts?.approved ?? "n/a"}</li>
              <li>Pending listings: {diag.counts?.pending ?? "n/a"}</li>
              <li>Your saved items: {diag.counts?.savedForUser ?? "n/a"}</li>
            </ul>
            {(diag.errors?.approved || diag.errors?.pending || diag.errors?.saved) && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Errors: {[diag.errors?.approved, diag.errors?.pending, diag.errors?.saved].filter(Boolean).join(" | ")}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Canonical host</h3>
            <p className="text-sm text-slate-600">
              Ensure magic links and cookies stay on https://www.rentnow.space. Apex redirects are configured in Next/Vercel.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/auth/confirm" className="text-sm font-semibold text-sky-700 underline">
                Confirm page
              </Link>
              <Link href="/auth/confirmed" className="text-sm font-semibold text-sky-700 underline">
                Confirmed landing
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Tools</h3>
            <p className="text-sm text-slate-600">Use CI tests for auth/tenant/admin flows.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="https://github.com/bussywales/rentnow/actions" className="text-sm font-semibold text-sky-700 underline">
                GitHub Actions
              </Link>
              <Link href="/admin/users" className="text-sm font-semibold text-sky-700 underline">
                User management
              </Link>
              <Link href="/admin" className="text-sm font-semibold text-sky-700 underline">
                Admin approvals
              </Link>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Env for e2e: PLAYWRIGHT_BASE_URL, PLAYWRIGHT_USER_EMAIL/PASSWORD, PLAYWRIGHT_TENANT_EMAIL/PASSWORD (optional), PLAYWRIGHT_ALLOW_WRITE=true.
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Support</h3>
        <p className="text-sm text-slate-600">Email: hello@rentnow.africa</p>
        <p className="text-sm text-slate-600">Ops: view Vercel deploys, Supabase health, and RLS debug links above.</p>
      </div>
    </div>
  );
}
