import Link from "next/link";
import { redirect } from "next/navigation";
import { buildMessagingAdminSnapshot, type MessagingAdminSnapshot } from "@/lib/admin/messaging-observability";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { formatRoleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

type MessagingDiagnostics = {
  ready: boolean;
  sampleSize: number;
  snapshot: MessagingAdminSnapshot | null;
  error: string | null;
};

type MessagingRow = {
  id: string;
  property_id: string;
  sender_id: string;
  recipient_id: string;
  created_at?: string | null;
};

type MessagingProfileRow = {
  id: string;
  role: string | null;
};

type MessagingPropertyRow = {
  id: string;
  owner_id: string;
  is_approved?: boolean | null;
  is_active?: boolean | null;
};

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

  let messaging: MessagingDiagnostics = {
    ready: false,
    sampleSize: 0,
    snapshot: null,
    error: null,
  };

  if (hasServiceRoleEnv()) {
    const adminClient = createServiceRoleClient();
    const { data: messages, error: messagesError } = await adminClient
      .from("messages")
      .select("id, property_id, sender_id, recipient_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (messagesError) {
      messaging = {
        ready: false,
        sampleSize: 0,
        snapshot: null,
        error: messagesError.message,
      };
    } else {
      const messageRows = (messages as MessagingRow[]) ?? [];
      const profileIds = Array.from(
        new Set(
          messageRows.flatMap((row) => [row.sender_id, row.recipient_id])
        )
      );
      const propertyIds = Array.from(new Set(messageRows.map((row) => row.property_id)));

      const [profilesResult, propertiesResult] = await Promise.all([
        profileIds.length
          ? adminClient.from("profiles").select("id, role").in("id", profileIds)
          : Promise.resolve({
              data: [] as MessagingProfileRow[],
              error: null,
            }),
        propertyIds.length
          ? adminClient
              .from("properties")
              .select("id, owner_id, is_approved, is_active")
              .in("id", propertyIds)
          : Promise.resolve({
              data: [] as MessagingPropertyRow[],
              error: null,
            }),
      ]);

      const snapshot = buildMessagingAdminSnapshot({
        messages: messageRows,
        profiles: (profilesResult.data as MessagingProfileRow[]) ?? [],
        properties: (propertiesResult.data as MessagingPropertyRow[]) ?? [],
      });

      messaging = {
        ready: true,
        sampleSize: messageRows.length,
        snapshot,
        error: [profilesResult.error?.message, propertiesResult.error?.message]
          .filter(Boolean)
          .join(" | ") || null,
      };
    }
  } else {
    messaging = {
      ready: false,
      sampleSize: 0,
      snapshot: null,
      error: "Service role key missing; messaging observability unavailable.",
    };
  }

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
    messaging,
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
            <p className="text-sm text-slate-600">Role: {formatRoleLabel(diag.role)}</p>
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
            <h3 className="text-lg font-semibold text-slate-900">Messaging snapshot</h3>
            {!diag.messaging?.ready && (
              <p className="text-sm text-slate-600">
                {diag.messaging?.error || "Messaging observability is unavailable."}
              </p>
            )}
            {diag.messaging?.ready && diag.messaging.snapshot && (
              <>
                <ul className="text-sm text-slate-700">
                  <li>Sample size: {diag.messaging.sampleSize}</li>
                  <li>Total messages: {diag.messaging.snapshot.totalMessages}</li>
                  <li>Delivered: {diag.messaging.snapshot.statusCounts.delivered}</li>
                  <li>Sent: {diag.messaging.snapshot.statusCounts.sent}</li>
                  <li>Read: {diag.messaging.snapshot.statusCounts.read}</li>
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  Delivery means the message was persisted. Read receipts are not tracked.
                </p>
                {diag.messaging.error && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Errors: {diag.messaging.error}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Messaging participants</h3>
            {!diag.messaging?.ready && (
              <p className="text-sm text-slate-600">
                Messaging counts require the service role key.
              </p>
            )}
            {diag.messaging?.ready && diag.messaging.snapshot && (
              <>
                {diag.messaging.snapshot.perUser.length ? (
                  <ul className="text-sm text-slate-700">
                    {diag.messaging.snapshot.perUser.map((entry) => (
                      <li key={entry.userId}>
                        {entry.userId} · sent {entry.sent} · received {entry.received}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-600">No message traffic in the sample.</p>
                )}
                <div className="mt-3 text-xs text-slate-500">
                  Restricted cases: {diag.messaging.snapshot.restricted.length}
                </div>
                {diag.messaging.snapshot.restricted.length > 0 && (
                  <ul className="mt-2 text-xs text-rose-700">
                    {diag.messaging.snapshot.restricted.slice(0, 5).map((item) => (
                      <li key={item.messageId}>
                        {item.messageId} · {item.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </>
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
