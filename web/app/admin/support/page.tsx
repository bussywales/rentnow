import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buildMessagingAdminSnapshot,
  filterMessagingAdminMessages,
  type MessagingAdminSnapshot,
} from "@/lib/admin/messaging-observability";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { formatRoleLabel } from "@/lib/roles";
import { getMessagingPermissionMessage, MESSAGING_REASON_CODES } from "@/lib/messaging/permissions";
import { getRateLimitSnapshot } from "@/lib/messaging/rate-limit";

export const dynamic = "force-dynamic";

type MessagingDiagnostics = {
  ready: boolean;
  sampleSize: number;
  snapshot: MessagingAdminSnapshot | null;
  error: string | null;
};

type RateLimitDiagnostics = {
  windowSeconds: number;
  total: number;
  bySender: Array<{ senderId: string; count: number }>;
  events: Array<{
    senderId: string;
    recipientId: string | null;
    propertyId: string | null;
    createdAt: string;
    retryAfterSeconds: number;
  }>;
};

type SearchParams = Record<string, string | string[] | undefined>;

type SupportProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
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

  const rateLimitSnapshot = getRateLimitSnapshot();
  const rateLimit: RateLimitDiagnostics = {
    windowSeconds: rateLimitSnapshot.windowSeconds,
    total: rateLimitSnapshot.total,
    bySender: rateLimitSnapshot.bySender,
    events: rateLimitSnapshot.events.map((event) => ({
      senderId: event.senderId,
      recipientId: event.recipientId,
      propertyId: event.propertyId,
      createdAt: event.createdAt,
      retryAfterSeconds: event.retryAfterSeconds,
    })),
  };

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
    rateLimit,
  };
}

function getParamValue(params: SearchParams | undefined, key: string) {
  const value = params?.[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

async function resolveSearchParams(raw?: SearchParams | Promise<SearchParams>) {
  if (raw && typeof (raw as { then?: unknown }).then === "function") {
    return (raw as Promise<SearchParams>);
  }
  return raw ?? {};
}

export default async function AdminSupportPage({ searchParams }: SupportProps) {
  const params = await resolveSearchParams(searchParams);
  const diag = await getDiagnostics();
  const statusFilter = getParamValue(params, "status") || "all";
  const reasonFilter = getParamValue(params, "reason") || "all";
  const snapshot = diag.messaging?.snapshot;
  const reasonCodes = Array.from(MESSAGING_REASON_CODES);
  const rateLimitMessages = (diag.rateLimit?.events ?? []).map((event) => ({
    id: `rate-limit-${event.senderId}-${event.createdAt}`,
    propertyId: event.propertyId ?? "unknown",
    senderId: event.senderId,
    recipientId: event.recipientId ?? "unknown",
    senderRole: null,
    recipientRole: null,
    status: "restricted" as const,
    reasonCode: "rate_limited" as const,
    reasonLabel: getMessagingPermissionMessage("rate_limited"),
    createdAt: event.createdAt,
  }));
  const activityMessages = snapshot
    ? [...snapshot.recentMessages, ...rateLimitMessages]
    : rateLimitMessages;
  const filteredMessages = filterMessagingAdminMessages(
    activityMessages,
    statusFilter,
    reasonFilter
  );

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
                  <li>Snapshot scope: last {diag.messaging.sampleSize} messages</li>
                  <li>Total messages: {diag.messaging.snapshot.totalMessages}</li>
                  <li>Delivered: {diag.messaging.snapshot.statusCounts.delivered}</li>
                  <li>Sent: {diag.messaging.snapshot.statusCounts.sent}</li>
                  <li>Read: {diag.messaging.snapshot.statusCounts.read}</li>
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  This is a read-only snapshot. Delivery means the message was persisted. Read receipts are not tracked.
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
            <h3 className="text-lg font-semibold text-slate-900">Rate limiting</h3>
            <p className="text-sm text-slate-600">
              Window: {diag.rateLimit?.windowSeconds ?? 0}s · Throttled events: {diag.rateLimit?.total ?? 0}
            </p>
            {diag.rateLimit?.bySender.length ? (
              <ul className="mt-2 text-sm text-slate-700">
                {diag.rateLimit.bySender.map((entry) => (
                  <li key={entry.senderId}>
                    {entry.senderId} · throttled {entry.count}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No throttled senders in this window.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Messaging filters</h3>
            {!diag.messaging?.ready && (
              <p className="text-sm text-slate-600">
                Messaging counts require the service role key.
              </p>
            )}
            {diag.messaging?.ready && diag.messaging.snapshot && (
              <>
                <form className="flex flex-wrap items-end gap-2 text-sm" method="get">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">Status</span>
                    <select
                      name="status"
                      defaultValue={statusFilter}
                      className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                    >
                      <option value="all">All</option>
                      <option value="sent">Sent</option>
                      <option value="delivered">Delivered</option>
                      <option value="read">Read</option>
                      <option value="restricted">Restricted</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">Reason</span>
                    <select
                      name="reason"
                      defaultValue={reasonFilter}
                      className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                    >
                      <option value="all">All</option>
                      {reasonCodes.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-700"
                  >
                    Apply
                  </button>
                </form>
                <p className="mt-3 text-xs text-slate-500">
                  Restricted cases: {diag.messaging.snapshot.restricted.length}
                </p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Messaging activity</h3>
            {!diag.messaging?.ready && (
              <p className="text-sm text-slate-600">
                Messaging activity is unavailable without the service role key.
              </p>
            )}
            {diag.messaging?.ready && snapshot && (
              <>
                {filteredMessages.length ? (
                  <ul className="text-sm text-slate-700">
                    {filteredMessages.slice(0, 12).map((item) => (
                      <li key={item.id} className="py-1">
                        <span className="font-semibold">{item.status}</span> · {item.id} ·
                        {item.reasonCode ? ` ${item.reasonCode}` : " ok"} ·
                        {item.reasonLabel ? ` ${item.reasonLabel}` : ""} ·
                        sender {item.senderId} ({item.senderRole || "n/a"}) ·
                        recipient {item.recipientId} ({item.recipientRole || "n/a"}) ·
                        property {item.propertyId}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-600">
                    No messages match the current filter.
                  </p>
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
            {diag.messaging?.ready && snapshot && (
              <>
                {snapshot.perUser.length ? (
                  <ul className="text-sm text-slate-700">
                    {snapshot.perUser.map((entry) => (
                      <li key={entry.userId}>
                        {entry.userId} · sent {entry.sent} · received {entry.received}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-600">No message traffic in the sample.</p>
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
