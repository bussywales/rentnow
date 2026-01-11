import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buildMessagingAdminSnapshot,
  filterMessagingAdminMessages,
  type MessagingAdminSnapshot,
} from "@/lib/admin/messaging-observability";
import {
  buildThrottleTelemetrySummary,
  type ThrottleTelemetrySummary,
} from "@/lib/admin/messaging-throttle";
import {
  buildPushTelemetrySummary,
  derivePushOutcomeMarker,
  type PushAlertRow,
  type PushTelemetrySummary,
} from "@/lib/admin/push-telemetry";
import {
  buildShareTelemetrySummary,
  type ShareTelemetrySummary,
} from "@/lib/admin/message-share-telemetry";
import {
  buildTrustMarkerSummary,
  type TrustMarkerSummary,
} from "@/lib/admin/trust-markers";
import { buildBetaReadinessSnapshot } from "@/lib/admin/beta-readiness";
import {
  buildAffectedListings,
  type AffectedListingsSnapshot,
} from "@/lib/admin/affected-listings";
import {
  buildDataQualitySnapshot,
  type DataQualitySnapshot,
} from "@/lib/admin/data-quality";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { formatRoleLabel } from "@/lib/roles";
import { getMessagingPermissionMessage, MESSAGING_REASON_CODES } from "@/lib/messaging/permissions";
import { getRateLimitSnapshot } from "@/lib/messaging/rate-limit";
import { getPushConfig } from "@/lib/push/server";

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

type ThrottleRange = "24h" | "7d" | "30d";

type ThrottleTelemetryDiagnostics = {
  ready: boolean;
  range: ThrottleRange;
  totals: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  summary: ThrottleTelemetrySummary | null;
  error: string | null;
};

type PushTelemetryDiagnostics = {
  ready: boolean;
  configured: boolean;
  counts: {
    total: number;
    active: number;
    last24h: number;
    last7d: number;
  };
  pruned: {
    last7d: number;
    last30d: number;
  };
  summary: PushTelemetrySummary | null;
  error: string | null;
};

type ShareTelemetryDiagnostics = {
  ready: boolean;
  counts: {
    last7d: number;
    last30d: number;
    active: number;
    revoked: number;
    expired: number;
  };
  summary: ShareTelemetrySummary | null;
  error: string | null;
};

type TrustMarkerDiagnostics = {
  ready: boolean;
  summary: TrustMarkerSummary | null;
  error: string | null;
};

type DataQualityDiagnostics = {
  ready: boolean;
  snapshot: DataQualitySnapshot | null;
  error: string | null;
};

type AffectedListingsDiagnostics = {
  ready: boolean;
  snapshot: AffectedListingsSnapshot | null;
  error: string | null;
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

type ShareRow = {
  id: string;
  created_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
};

const THROTTLE_RANGES: Record<ThrottleRange, { label: string; windowMs: number }> = {
  "24h": { label: "Last 24h", windowMs: 24 * 60 * 60 * 1000 },
  "7d": { label: "Last 7d", windowMs: 7 * 24 * 60 * 60 * 1000 },
  "30d": { label: "Last 30d", windowMs: 30 * 24 * 60 * 60 * 1000 },
};

function resolveThrottleRange(value?: string): ThrottleRange {
  if (value === "7d" || value === "30d") return value;
  return "24h";
}

function toIsoRangeStart(windowMs: number) {
  return new Date(Date.now() - windowMs).toISOString();
}

function formatDateLabel(value?: string | null) {
  if (!value) return "n/a";
  return value.slice(0, 10);
}

async function getDiagnostics(throttleRange: ThrottleRange) {
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

  let throttleTelemetry: ThrottleTelemetryDiagnostics = {
    ready: false,
    range: throttleRange,
    totals: { last24h: 0, last7d: 0, last30d: 0 },
    summary: null,
    error: null,
  };

  const pushConfig = getPushConfig();
  let pushTelemetry: PushTelemetryDiagnostics = {
    ready: false,
    configured: pushConfig.configured,
    counts: { total: 0, active: 0, last24h: 0, last7d: 0 },
    pruned: { last7d: 0, last30d: 0 },
    summary: null,
    error: null,
  };
  let shareTelemetry: ShareTelemetryDiagnostics = {
    ready: false,
    counts: { last7d: 0, last30d: 0, active: 0, revoked: 0, expired: 0 },
    summary: null,
    error: null,
  };
  let trustMarkers: TrustMarkerDiagnostics = {
    ready: false,
    summary: null,
    error: null,
  };
  let dataQuality: DataQualityDiagnostics = {
    ready: false,
    snapshot: null,
    error: null,
  };
  let affectedListings: AffectedListingsDiagnostics = {
    ready: false,
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

    const [last24hResult, last7dResult, last30dResult] = await Promise.all([
      adminClient
        .from("messaging_throttle_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", toIsoRangeStart(THROTTLE_RANGES["24h"].windowMs)),
      adminClient
        .from("messaging_throttle_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", toIsoRangeStart(THROTTLE_RANGES["7d"].windowMs)),
      adminClient
        .from("messaging_throttle_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", toIsoRangeStart(THROTTLE_RANGES["30d"].windowMs)),
    ]);

    const throttleRangeStart = toIsoRangeStart(
      THROTTLE_RANGES[throttleRange].windowMs
    );
    const { data: throttleEvents, error: throttleError } = await adminClient
      .from("messaging_throttle_events")
      .select("actor_profile_id, thread_key, created_at")
      .gte("created_at", throttleRangeStart)
      .order("created_at", { ascending: false })
      .limit(1000);

    throttleTelemetry = {
      ready: true,
      range: throttleRange,
      totals: {
        last24h: last24hResult.count ?? 0,
        last7d: last7dResult.count ?? 0,
        last30d: last30dResult.count ?? 0,
      },
      summary: buildThrottleTelemetrySummary(
        (throttleEvents ?? []) as Array<{
          actor_profile_id: string;
          thread_key: string;
          created_at?: string | null;
        }>
      ),
      error: [throttleError?.message, last24hResult.error?.message, last7dResult.error?.message, last30dResult.error?.message]
        .filter(Boolean)
        .join(" | ") || null,
    };

    const pruned7dStart = toIsoRangeStart(THROTTLE_RANGES["7d"].windowMs);
    const pruned30dStart = toIsoRangeStart(THROTTLE_RANGES["30d"].windowMs);
    const [
      totalSubsResult,
      activeSubsResult,
      subs24hResult,
      subs7dResult,
      pruned7dResult,
      pruned30dResult,
    ] = await Promise.all([
      adminClient.from("push_subscriptions").select("id", { count: "exact", head: true }),
      adminClient
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      adminClient
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", toIsoRangeStart(THROTTLE_RANGES["24h"].windowMs)),
      adminClient
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", toIsoRangeStart(THROTTLE_RANGES["7d"].windowMs)),
      adminClient
        .from("saved_search_alerts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", pruned7dStart)
        .ilike("error", "%push_pruned:%"),
      adminClient
        .from("saved_search_alerts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", pruned30dStart)
        .ilike("error", "%push_pruned:%"),
    ]);

    const { data: alertRowsRaw, error: alertRowsError } = await adminClient
      .from("saved_search_alerts")
      .select("id, user_id, property_id, channel, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    const alertRows = (alertRowsRaw as PushAlertRow[]) ?? [];

    pushTelemetry = {
      ready: true,
      configured: pushConfig.configured,
      counts: {
        total: totalSubsResult.count ?? 0,
        active: activeSubsResult.count ?? 0,
        last24h: subs24hResult.count ?? 0,
        last7d: subs7dResult.count ?? 0,
      },
      pruned: {
        last7d: pruned7dResult.count ?? 0,
        last30d: pruned30dResult.count ?? 0,
      },
      summary: buildPushTelemetrySummary(alertRows),
      error: [
        totalSubsResult.error?.message,
        activeSubsResult.error?.message,
        subs24hResult.error?.message,
        subs7dResult.error?.message,
        pruned7dResult.error?.message,
        pruned30dResult.error?.message,
        alertRowsError?.message,
      ]
        .filter(Boolean)
        .join(" | ") || null,
    };

    const shareNowIso = new Date().toISOString();
    const share7dStart = toIsoRangeStart(THROTTLE_RANGES["7d"].windowMs);
    const share30dStart = toIsoRangeStart(THROTTLE_RANGES["30d"].windowMs);

    const [
      share7dResult,
      share30dResult,
      shareActiveResult,
      shareRevokedResult,
      shareExpiredResult,
      shareRowsResult,
    ] = await Promise.all([
      adminClient
        .from("message_thread_shares")
        .select("id", { count: "exact", head: true })
        .gte("created_at", share7dStart),
      adminClient
        .from("message_thread_shares")
        .select("id", { count: "exact", head: true })
        .gte("created_at", share30dStart),
      adminClient
        .from("message_thread_shares")
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null)
        .gt("expires_at", shareNowIso),
      adminClient
        .from("message_thread_shares")
        .select("id", { count: "exact", head: true })
        .not("revoked_at", "is", null),
      adminClient
        .from("message_thread_shares")
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null)
        .lte("expires_at", shareNowIso),
      adminClient
        .from("message_thread_shares")
        .select("id, created_at, expires_at, revoked_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const shareRows = (shareRowsResult.data as ShareRow[]) ?? [];

    shareTelemetry = {
      ready: true,
      counts: {
        last7d: share7dResult.count ?? 0,
        last30d: share30dResult.count ?? 0,
        active: shareActiveResult.count ?? 0,
        revoked: shareRevokedResult.count ?? 0,
        expired: shareExpiredResult.count ?? 0,
      },
      summary: buildShareTelemetrySummary(shareRows),
      error: [
        share7dResult.error?.message,
        share30dResult.error?.message,
        shareActiveResult.error?.message,
        shareRevokedResult.error?.message,
        shareExpiredResult.error?.message,
        shareRowsResult.error?.message,
      ]
        .filter(Boolean)
        .join(" | ") || null,
    };

    const { data: trustRows, error: trustError } = await adminClient
      .from("profiles")
      .select(
        "id, role, email_verified, phone_verified, bank_verified, reliability_power, reliability_water, reliability_internet"
      )
      .in("role", ["landlord", "agent"]);

    trustMarkers = {
      ready: !trustError,
      summary: trustRows ? buildTrustMarkerSummary(trustRows) : null,
      error: trustError?.message ?? null,
    };

    const { snapshot: dataQualitySnapshot, error: dataQualityError } =
      await buildDataQualitySnapshot(adminClient);
    dataQuality = {
      ready: true,
      snapshot: dataQualitySnapshot,
      error: dataQualityError,
    };

    const { listings, missingPhotosAvailable, error: affectedError } =
      await buildAffectedListings(adminClient);
    affectedListings = {
      ready: true,
      snapshot: { listings, missingPhotosAvailable, error: affectedError },
      error: affectedError,
    };
  } else {
    messaging = {
      ready: false,
      sampleSize: 0,
      snapshot: null,
      error: "Service role key missing; messaging observability unavailable.",
    };
    throttleTelemetry = {
      ready: false,
      range: throttleRange,
      totals: { last24h: 0, last7d: 0, last30d: 0 },
      summary: null,
      error: "Service role key missing; throttle telemetry unavailable.",
    };
    pushTelemetry = {
      ready: false,
      configured: pushConfig.configured,
      counts: { total: 0, active: 0, last24h: 0, last7d: 0 },
      pruned: { last7d: 0, last30d: 0 },
      summary: null,
      error: "Service role key missing; push telemetry unavailable.",
    };
    shareTelemetry = {
      ready: false,
      counts: { last7d: 0, last30d: 0, active: 0, revoked: 0, expired: 0 },
      summary: null,
      error: "Service role key missing; share telemetry unavailable.",
    };
    trustMarkers = {
      ready: false,
      summary: null,
      error: "Service role key missing; trust markers unavailable.",
    };
    dataQuality = {
      ready: false,
      snapshot: null,
      error: "Service role key missing; data quality unavailable.",
    };
    affectedListings = {
      ready: false,
      snapshot: null,
      error: "Service role key missing; affected listings unavailable.",
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
    throttleTelemetry,
    pushTelemetry,
    shareTelemetry,
    rateLimit,
    trustMarkers,
    dataQuality,
    affectedListings,
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
  const throttleRange = resolveThrottleRange(getParamValue(params, "throttle"));
  const diag = await getDiagnostics(throttleRange);
  const serviceRoleReady = hasServiceRoleEnv();
  const pushConfigured = diag.pushTelemetry?.configured ?? false;
  const missingPhotosAvailable =
    diag.dataQuality?.snapshot?.counts.missingPhotos !== null &&
    diag.affectedListings?.snapshot?.missingPhotosAvailable !== false;
  const betaReadiness = buildBetaReadinessSnapshot({
    supabaseReady: diag.supabaseReady,
    serviceRoleReady,
    pushConfigured,
    missingPhotosAvailable,
  });
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
            <h3 className="text-lg font-semibold text-slate-900">Beta readiness</h3>
            <p className="text-sm text-slate-600">
              Read-only snapshot of beta readiness signals. Use docs for migration verification.
            </p>
            <ul className="mt-3 text-sm text-slate-700">
              <li>Supabase configured: {diag.supabaseReady ? "Yes" : "No"}</li>
              <li>Service role available: {betaReadiness.flags.serviceRoleReady ? "Yes" : "No"}</li>
              <li>Push configured: {betaReadiness.flags.pushConfigured ? "Yes" : "No"}</li>
            </ul>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Blocks beta
                </p>
                {betaReadiness.blockers.length ? (
                  <ul className="mt-1 list-disc pl-5 text-slate-700">
                    {betaReadiness.blockers.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-slate-600">None detected.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Does not block beta
                </p>
                {betaReadiness.warnings.length ? (
                  <ul className="mt-1 list-disc pl-5 text-slate-700">
                    {betaReadiness.warnings.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-slate-600">No non-blocking gaps detected.</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Manual checks
                </p>
                <ul className="mt-1 list-disc pl-5 text-slate-700">
                  <li>{betaReadiness.migrationStatus}</li>
                  <li>Verify listings flow via the beta smoke checklist.</li>
                </ul>
              </div>
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
            <h3 className="text-lg font-semibold text-slate-900">Throttle telemetry</h3>
            {!diag.throttleTelemetry?.ready && (
              <p className="text-sm text-slate-600">
                {diag.throttleTelemetry?.error || "Throttle telemetry is unavailable."}
              </p>
            )}
            {diag.throttleTelemetry?.ready && diag.throttleTelemetry.summary && (
              <>
                <p className="text-sm text-slate-600">
                  Totals: 24h {diag.throttleTelemetry.totals.last24h} · 7d {diag.throttleTelemetry.totals.last7d} · 30d {diag.throttleTelemetry.totals.last30d}
                </p>
                <form className="mt-3 flex flex-wrap items-end gap-2 text-sm" method="get">
                  <input type="hidden" name="status" value={statusFilter} />
                  <input type="hidden" name="reason" value={reasonFilter} />
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500">Range</span>
                    <select
                      name="throttle"
                      defaultValue={diag.throttleTelemetry.range}
                      className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                    >
                      {Object.entries(THROTTLE_RANGES).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
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
                  Sample: last {diag.throttleTelemetry.summary.sampleSize} events in {THROTTLE_RANGES[diag.throttleTelemetry.range].label}.
                </p>
                {diag.throttleTelemetry.summary.topSenders.length ? (
                  <ul className="mt-2 text-sm text-slate-700">
                    {diag.throttleTelemetry.summary.topSenders.map((entry) => (
                      <li key={entry.key}>
                        {entry.key} · throttled {entry.count}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No throttled users in this range.</p>
                )}
                {diag.throttleTelemetry.summary.topThreads.length ? (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">Top threads</p>
                    <ul className="mt-1 text-sm text-slate-700">
                      {diag.throttleTelemetry.summary.topThreads.map((entry) => (
                        <li key={entry.key}>
                          {entry.key} · throttled {entry.count}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {diag.throttleTelemetry.error && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Errors: {diag.throttleTelemetry.error}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Push & alerts</h3>
            {!diag.pushTelemetry?.ready && (
              <p className="text-sm text-slate-600">
                {diag.pushTelemetry?.error || "Push telemetry is unavailable."}
              </p>
            )}
            {diag.pushTelemetry?.ready && diag.pushTelemetry.summary && (
              <>
                <p className="text-sm text-slate-600">
                  Push configured: {diag.pushTelemetry.configured ? "Yes" : "No"}
                </p>
                <p className="text-sm text-slate-600">
                  Subscriptions: total {diag.pushTelemetry.counts.total} · active {diag.pushTelemetry.counts.active} · new 24h {diag.pushTelemetry.counts.last24h} · 7d {diag.pushTelemetry.counts.last7d}
                </p>
                <p className="text-sm text-slate-600">
                  Pruned (alerts): last 7d {diag.pushTelemetry.pruned.last7d} · 30d {diag.pushTelemetry.pruned.last30d}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Alert sample: last {diag.pushTelemetry.summary.sampleSize} alerts.
                </p>
                <p className="text-sm text-slate-700">
                  Push attempted: {diag.pushTelemetry.summary.pushAttempted} · Push succeeded: {diag.pushTelemetry.summary.pushSucceeded}
                </p>
                {diag.pushTelemetry.summary.topFailureReasons.length ? (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">Top failure reasons</p>
                    <ul className="mt-1 text-sm text-slate-700">
                      {diag.pushTelemetry.summary.topFailureReasons.map((entry) => (
                        <li key={entry.reason}>
                          {entry.reason} · {entry.count}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No push failures in the recent sample.</p>
                )}
                {diag.pushTelemetry.summary.topPrunedReasons.length ? (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">Pruned reasons (sample)</p>
                    <ul className="mt-1 text-sm text-slate-700">
                      {diag.pushTelemetry.summary.topPrunedReasons.map((entry) => (
                        <li key={entry.reason}>
                          {entry.reason} · {entry.count}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {diag.pushTelemetry.summary.recent.length ? (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">Recent push outcomes</p>
                    <ul className="mt-1 text-sm text-slate-700">
                      {diag.pushTelemetry.summary.recent.map((row) => (
                        <li key={row.id}>
                          {row.user_id} · {row.property_id || "property unknown"} · {derivePushOutcomeMarker(row)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No push attempts in the recent sample.</p>
                )}
                {diag.pushTelemetry.error && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Errors: {diag.pushTelemetry.error}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Share links</h3>
            {!diag.shareTelemetry?.ready && (
              <p className="text-sm text-slate-600">
                {diag.shareTelemetry?.error || "Share telemetry is unavailable."}
              </p>
            )}
            {diag.shareTelemetry?.ready && diag.shareTelemetry.summary && (
              <>
                <p className="text-sm text-slate-600">
                  Created: last 7d {diag.shareTelemetry.counts.last7d} · 30d {diag.shareTelemetry.counts.last30d}
                </p>
                <p className="text-sm text-slate-600">
                  Status: active {diag.shareTelemetry.counts.active} · revoked {diag.shareTelemetry.counts.revoked} · expired {diag.shareTelemetry.counts.expired}
                </p>
                <p className="text-sm text-slate-600">
                  Invalid/unknown attempts: Not tracked
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Sample: last {diag.shareTelemetry.summary.sampleSize} links. Invalid tokens are not tracked.
                </p>
                {diag.shareTelemetry.summary.topFailureReasons.length ? (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">Top failure reasons</p>
                    <ul className="mt-1 text-sm text-slate-700">
                      {diag.shareTelemetry.summary.topFailureReasons.map((entry) => (
                        <li key={entry.reason}>
                          {entry.reason} · {entry.count}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {diag.shareTelemetry.error && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Errors: {diag.shareTelemetry.error}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Trust markers</h3>
            {!diag.trustMarkers?.ready && (
              <p className="text-sm text-slate-600">
                {diag.trustMarkers?.error || "Trust markers are unavailable."}
              </p>
            )}
            {diag.trustMarkers?.ready && diag.trustMarkers.summary && (
              <>
                <p className="text-sm text-slate-600">
                  Host profiles: {diag.trustMarkers.summary.hostCount}
                </p>
                <p className="text-sm text-slate-600">
                  Email verified: {diag.trustMarkers.summary.emailVerified} · Phone verified: {diag.trustMarkers.summary.phoneVerified} · Bank verified: {diag.trustMarkers.summary.bankVerified}
                </p>
                <p className="text-sm text-slate-600">
                  Reliability fields set: {diag.trustMarkers.summary.reliabilitySet}
                </p>
                {diag.trustMarkers.error && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Errors: {diag.trustMarkers.error}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Data quality</h3>
            {!diag.dataQuality?.ready && (
              <p className="text-sm text-slate-600">
                {diag.dataQuality?.error || "Data quality metrics are unavailable."}
              </p>
            )}
            {diag.dataQuality?.ready && diag.dataQuality.snapshot && (
              <>
                <ul className="text-sm text-slate-700">
                  <li>Properties total: {diag.dataQuality.snapshot.counts.total}</li>
                  <li>Country present, code missing: {diag.dataQuality.snapshot.counts.missingCountryCode}</li>
                  <li>Code present, country missing: {diag.dataQuality.snapshot.counts.countryCodeMissingCountry}</li>
                  <li>Deposit amount missing currency: {diag.dataQuality.snapshot.counts.depositMissingCurrency}</li>
                  <li>Deposit currency missing amount: {diag.dataQuality.snapshot.counts.currencyMissingDeposit}</li>
                  <li>Size value missing unit: {diag.dataQuality.snapshot.counts.sizeMissingUnit}</li>
                  <li>Size unit missing value: {diag.dataQuality.snapshot.counts.unitMissingSize}</li>
                  <li>Listing type missing: {diag.dataQuality.snapshot.counts.listingTypeMissing}</li>
                  <li>Year built out of range: {diag.dataQuality.snapshot.counts.yearBuiltOutOfRange}</li>
                  <li>Bathroom type missing (bathrooms &gt; 0): {diag.dataQuality.snapshot.counts.bathroomTypeMissing}</li>
                  <li>
                    Missing photos:{" "}
                    {diag.dataQuality.snapshot.counts.missingPhotos === null
                      ? "Not available"
                      : diag.dataQuality.snapshot.counts.missingPhotos}
                  </li>
                </ul>
                <div className="mt-3 space-y-3">
                  {diag.dataQuality.snapshot.samples.missingCountryCode.length ? (
                    <div>
                      <p className="text-xs text-slate-500">Sample: missing country codes</p>
                      <ul className="mt-1 text-sm text-slate-700">
                        {diag.dataQuality.snapshot.samples.missingCountryCode.map((row) => (
                          <li key={row.id}>
                            {row.id} · {row.title || "Untitled"} · {row.country || "country n/a"} · {row.city || "city n/a"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {diag.dataQuality.snapshot.samples.missingDepositCurrency.length ? (
                    <div>
                      <p className="text-xs text-slate-500">Sample: deposit missing currency</p>
                      <ul className="mt-1 text-sm text-slate-700">
                        {diag.dataQuality.snapshot.samples.missingDepositCurrency.map((row) => (
                          <li key={row.id}>
                            {row.id} · {row.title || "Untitled"} · deposit {row.deposit_amount ?? "n/a"} · {row.currency || "currency n/a"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {diag.dataQuality.snapshot.samples.missingPhotos?.length ? (
                    <div>
                      <p className="text-xs text-slate-500">Sample: missing photos</p>
                      <ul className="mt-1 text-sm text-slate-700">
                        {diag.dataQuality.snapshot.samples.missingPhotos.map((row) => (
                          <li key={row.id}>
                            {row.id} · {row.title || "Untitled"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                {diag.dataQuality.error && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Errors: {diag.dataQuality.error}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900">Affected listings</h3>
            {!diag.affectedListings?.ready && (
              <p className="text-sm text-slate-600">
                {diag.affectedListings?.error || "Affected listings are unavailable."}
              </p>
            )}
            {diag.affectedListings?.ready && diag.affectedListings.snapshot && (
              <>
                {!diag.affectedListings.snapshot.missingPhotosAvailable && (
                  <p className="text-xs text-slate-500">
                    Missing photos: not available (property_images join unavailable).
                  </p>
                )}
                {diag.affectedListings.snapshot.listings.length ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-slate-700">
                      <thead className="text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-2 pr-4">Listing</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Owner</th>
                          <th className="py-2 pr-4">Missing fields</th>
                          <th className="py-2">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diag.affectedListings.snapshot.listings.map((row) => (
                          <tr key={row.id} className="border-t border-slate-100">
                            <td className="py-2 pr-4">
                              <Link
                                href={`/properties/${row.id}`}
                                className="font-semibold text-sky-700 underline"
                              >
                                {row.title || "Untitled"}
                              </Link>
                            </td>
                            <td className="py-2 pr-4 capitalize">{row.statusLabel}</td>
                            <td className="py-2 pr-4">{row.ownerLabel}</td>
                            <td className="py-2 pr-4">
                              Missing: {row.missingLabels.join(", ")}
                            </td>
                            <td className="py-2">{formatDateLabel(row.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No affected listings in the current sample.</p>
                )}
                {diag.affectedListings.snapshot.error && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Errors: {diag.affectedListings.snapshot.error}
                  </div>
                )}
              </>
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
