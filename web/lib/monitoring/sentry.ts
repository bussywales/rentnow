import * as Sentry from "@sentry/nextjs";
import { getRequestId } from "@/lib/observability";

type Runtime = "client" | "server" | "edge";

type SharedSentryContext = {
  route: string;
  request?: Request;
  status?: number;
  requestId?: string | null;
  userId?: string | null;
  userRole?: string | null;
  listingId?: string | null;
  propertyRequestId?: string | null;
  bookingId?: string | null;
  digest?: string | null;
  pathname?: string | null;
  href?: string | null;
  userAgent?: string | null;
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
};

function resolveCommitSha() {
  return (
    process.env.SENTRY_RELEASE ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    null
  );
}

export function resolveSentryEnvironment() {
  return (
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    "development"
  );
}

export function resolveSentryRelease() {
  return resolveCommitSha();
}

export function getSentryDsn(runtime: Runtime) {
  if (runtime === "client") {
    return process.env.NEXT_PUBLIC_SENTRY_DSN || null;
  }
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || null;
}

export function isSentryEnabled(runtime: Runtime) {
  const dsn = getSentryDsn(runtime);
  return Boolean(dsn && String(dsn).trim());
}

export function getSharedSentryOptions(runtime: Runtime) {
  return {
    dsn: getSentryDsn(runtime) || undefined,
    enabled: isSentryEnabled(runtime),
    environment: resolveSentryEnvironment(),
    release: resolveSentryRelease() || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  };
}

function applyCommonScope(scope: Sentry.Scope, context: SharedSentryContext) {
  const requestId = context.requestId || getRequestId(context.request);

  scope.setTag("route", context.route);
  scope.setTag("request_id", requestId);

  if (typeof context.status === "number") {
    scope.setTag("http.status_code", context.status);
  }
  if (context.userRole) {
    scope.setTag("user_role", context.userRole);
  }
  if (context.listingId) {
    scope.setTag("listing_id", context.listingId);
  }
  if (context.propertyRequestId) {
    scope.setTag("property_request_id", context.propertyRequestId);
  }
  if (context.bookingId) {
    scope.setTag("booking_id", context.bookingId);
  }
  if (context.digest) {
    scope.setTag("next_error_digest", context.digest);
  }

  for (const [key, value] of Object.entries(context.tags || {})) {
    if (typeof value !== "undefined" && value !== null) {
      scope.setTag(key, String(value));
    }
  }

  if (context.userId) {
    scope.setUser({ id: context.userId });
  }

  scope.setContext("route_context", {
    route: context.route,
    requestId,
    status: context.status ?? null,
    pathname: context.pathname ?? null,
    href: context.href ?? null,
    userAgent: context.userAgent ?? null,
    method: context.request?.method ?? null,
    url: context.request?.url ?? null,
    release: resolveSentryRelease(),
    environment: resolveSentryEnvironment(),
    ...context.extra,
  });

  if (context.fingerprint?.length) {
    scope.setFingerprint(context.fingerprint);
  }
}

export function captureServerException(error: unknown, context: SharedSentryContext) {
  if (!isSentryEnabled("server")) return;

  Sentry.withScope((scope) => {
    applyCommonScope(scope, context);
    scope.setLevel(context.status && context.status < 500 ? "warning" : "error");
    Sentry.captureException(error);
  });
}

export function captureClientBoundaryException(error: Error, context: SharedSentryContext) {
  if (!isSentryEnabled("client")) return;

  Sentry.withScope((scope) => {
    applyCommonScope(scope, context);
    scope.setLevel("error");
    Sentry.captureException(error);
  });
}
