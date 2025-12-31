import { getEnvPresence } from "@/lib/env";

type LogLevel = "error" | "warn";

type FailureLogInput = {
  request: Request;
  route: string;
  status: number;
  startTime: number;
  level?: LogLevel;
  error?: unknown;
};

type ApprovalLogInput = {
  request?: Request;
  route: string;
  actorId: string;
  propertyId: string;
  action: "approve" | "reject";
  reasonProvided?: boolean;
};

type PlanLimitLogInput = {
  request?: Request;
  route: string;
  actorId: string;
  ownerId: string;
  planTier: string;
  maxListings: number;
  activeCount: number;
  propertyId?: string;
  source?: "service" | "rls" | "default";
};

type PlanOverrideLogInput = {
  request?: Request;
  route: string;
  actorId: string;
  profileId: string;
  planTier: string;
  maxListingsOverride?: number | null;
  billingSource?: string;
  validUntil?: string | null;
};

type StripeCheckoutLogInput = {
  request?: Request;
  route: string;
  actorId: string;
  role: string;
  tier: string;
  cadence: string;
};

type StripeWebhookLogInput = {
  route: string;
  eventType: string;
  eventId: string;
};

type StripePlanUpdateLogInput = {
  route: string;
  profileId: string;
  planTier: string;
  stripeStatus: string | null;
  stripeSubscriptionId?: string | null;
};

type StripePaymentFailedLogInput = {
  route: string;
  profileId: string;
  stripeStatus: string | null;
  stripeSubscriptionId?: string | null;
};

function normalizeError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  if (typeof error === "string") {
    return { name: "Error", message: error };
  }
  if (typeof error === "object") {
    const maybeName = (error as { name?: string }).name;
    const maybeMessage = (error as { message?: string }).message;
    if (maybeName || maybeMessage) {
      return {
        name: maybeName || "Error",
        message: maybeMessage || "Unknown error",
      };
    }
  }
  return { name: "Error", message: "Unknown error" };
}

export function getRequestId(request?: Request) {
  const headerId =
    request?.headers.get("x-request-id") || request?.headers.get("x-vercel-id");
  if (headerId) return headerId;
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function logFailure({
  request,
  route,
  status,
  startTime,
  level = "error",
  error,
}: FailureLogInput) {
  const durationMs = Math.max(0, Date.now() - startTime);
  const payload = {
    level,
    route,
    requestId: getRequestId(request),
    status,
    durationMs,
    url: request.url,
    method: request.method,
    env: getEnvPresence(),
    error: normalizeError(error),
  };

  console.error(JSON.stringify(payload));
}

export function logApprovalAction({
  request,
  route,
  actorId,
  propertyId,
  action,
  reasonProvided = false,
}: ApprovalLogInput) {
  const payload = {
    level: "info",
    event: "property_approval",
    route,
    requestId: getRequestId(request),
    actorId,
    propertyId,
    action,
    reasonProvided,
  };

  console.log(JSON.stringify(payload));
}

export function logPlanLimitHit({
  request,
  route,
  actorId,
  ownerId,
  planTier,
  maxListings,
  activeCount,
  propertyId,
  source,
}: PlanLimitLogInput) {
  const payload = {
    level: "info",
    event: "plan_limit_hit",
    route,
    requestId: getRequestId(request),
    actorId,
    ownerId,
    propertyId,
    planTier,
    maxListings,
    activeCount,
    source,
  };

  console.log(JSON.stringify(payload));
}

export function logPlanOverride({
  request,
  route,
  actorId,
  profileId,
  planTier,
  maxListingsOverride,
  billingSource,
  validUntil,
}: PlanOverrideLogInput) {
  const payload = {
    level: "info",
    event: "plan_override",
    route,
    requestId: getRequestId(request),
    actorId,
    profileId,
    planTier,
    maxListingsOverride,
    billingSource: billingSource || "manual",
    validUntil,
    source: "manual",
  };

  console.log(JSON.stringify(payload));
}

export function logStripeCheckoutStarted({
  request,
  route,
  actorId,
  role,
  tier,
  cadence,
}: StripeCheckoutLogInput) {
  const payload = {
    level: "info",
    event: "stripe_checkout_started",
    route,
    requestId: getRequestId(request),
    actorId,
    role,
    tier,
    cadence,
  };

  console.log(JSON.stringify(payload));
}

export function logStripeWebhookApplied({ route, eventType, eventId }: StripeWebhookLogInput) {
  const payload = {
    level: "info",
    event: "stripe_webhook_applied",
    route,
    eventType,
    eventId,
  };

  console.log(JSON.stringify(payload));
}

export function logStripePlanUpdated({
  route,
  profileId,
  planTier,
  stripeStatus,
  stripeSubscriptionId,
}: StripePlanUpdateLogInput) {
  const payload = {
    level: "info",
    event: "stripe_plan_updated",
    route,
    profileId,
    planTier,
    stripeStatus,
    stripeSubscriptionId,
  };

  console.log(JSON.stringify(payload));
}

export function logStripePaymentFailed({
  route,
  profileId,
  stripeStatus,
  stripeSubscriptionId,
}: StripePaymentFailedLogInput) {
  const payload = {
    level: "warn",
    event: "stripe_payment_failed",
    route,
    profileId,
    stripeStatus,
    stripeSubscriptionId,
  };

  console.log(JSON.stringify(payload));
}
