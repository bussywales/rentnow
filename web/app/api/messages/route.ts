import { NextResponse } from "next/server";
import { z } from "zod";
import { DEV_MOCKS } from "@/lib/env";
import { getUserRole, requireUser } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { logFailure } from "@/lib/observability";
import { mockProperties } from "@/lib/mock";
import {
  buildMessagingPermission,
  getMessagingPermission,
  getMessagingReasonCta,
  type MessagingPermissionCode,
} from "@/lib/messaging/permissions";
import {
  checkMessagingRateLimit,
  getMessagingRateLimitConfig,
} from "@/lib/messaging/rate-limit";
import {
  buildThrottleTelemetryRow,
  buildThrottleThreadKey,
  recordThrottleTelemetryEvent,
} from "@/lib/messaging/throttle-telemetry";
import { mapDeliveryState, withDeliveryState } from "@/lib/messaging/status";
import type { Message } from "@/lib/types";

const messageSchema = z.object({
  property_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  body: z.string().min(1),
});

type PermissionPayload = {
  allowed: boolean;
  code?: MessagingPermissionCode;
  message?: string;
};

function buildPermission(code: MessagingPermissionCode): PermissionPayload {
  return buildMessagingPermission(code);
}

function permissionStatus(code: MessagingPermissionCode): number {
  switch (code) {
    case "not_authenticated":
      return 401;
    case "rate_limited":
      return 429;
    case "property_not_accessible":
      return 404;
    case "unknown":
      return 503;
    default:
      return 403;
  }
}

export function buildPermissionResponseBody(
  code: MessagingPermissionCode,
  extra: Record<string, unknown> = {}
) {
  const permission = buildPermission(code);
  return {
    ok: false,
    message: permission.message,
    reason_code: permission.code,
    error: permission.message,
    code: permission.code,
    permission,
    ...extra,
  };
}

function permissionErrorResponse(
  code: MessagingPermissionCode,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(buildPermissionResponseBody(code, extra), {
    status: permissionStatus(code),
  });
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/messages";
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId");
  let messages: Message[] = [];

  if (!propertyId) {
    return NextResponse.json({
      messages,
      permission: buildPermission("property_not_accessible"),
    });
  }

  if (!hasServerSupabaseEnv()) {
    const permission = buildPermission("unknown");
    if (DEV_MOCKS) {
      return NextResponse.json({
        messages: mapDeliveryState([
          {
            id: "demo-message",
            property_id: propertyId,
            sender_id: "demo-tenant",
            recipient_id: mockProperties[0]?.owner_id || "demo-owner",
            body: "Demo mode: connect Supabase to enable real messaging.",
            created_at: new Date().toISOString(),
          },
        ]),
        permission,
      });
    }
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      {
        error: permission.message,
        code: permission.code,
        messages: [],
        permission,
      },
      { status: 503 }
    );
  }

  try {
    const auth = await requireUser({ request, route: routeLabel, startTime });
    if (!auth.ok) {
      return permissionErrorResponse("not_authenticated", { messages: [] });
    }

    const supabase = auth.supabase;
    const role = await getUserRole(supabase, auth.user.id);
    let propertyOwnerId: string | null = null;
    let propertyPublished = false;

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, owner_id, title, is_approved, is_active")
      .eq("id", propertyId)
      .maybeSingle();

    if (propertyError) {
      logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        error: new Error(propertyError.message),
      });
    } else if (property) {
      propertyOwnerId = property.owner_id;
      propertyPublished = property.is_approved === true && property.is_active === true;
    }

    let query = supabase
      .from("messages")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true });

    if (role !== "admin") {
      query = query.or(
        `sender_id.eq.${auth.user.id},recipient_id.eq.${auth.user.id}`
      );
    }

    const { data, error } = await query;

    if (error) {
      if (!DEV_MOCKS) {
        logFailure({
          request,
          route: routeLabel,
          status: 500,
          startTime,
          error: new Error(error.message),
        });
        return permissionErrorResponse("unknown", { messages: [] });
      }
    } else if (data) {
      messages = mapDeliveryState(data);
    }

    const hasThread = messages.length > 0;
    const tenantHasMessaged = messages.some(
      (message) =>
        (message as Message & { sender_role?: string | null }).sender_role === "tenant" ||
        (!!propertyOwnerId && message.sender_id !== propertyOwnerId)
    );
    const permission = propertyOwnerId
      ? getMessagingPermission({
          senderRole: role,
          senderId: auth.user.id,
          recipientId: propertyOwnerId,
          propertyOwnerId,
          propertyPublished,
          isOwner: auth.user.id === propertyOwnerId,
          hasThread,
          hasTenantMessage: tenantHasMessaged,
        })
      : buildPermission("property_not_accessible");

    return NextResponse.json({ messages, permission });
  } catch (err: unknown) {
    if (DEV_MOCKS) {
      messages = mapDeliveryState([
        {
          id: "mock-msg-1",
          property_id: propertyId,
          sender_id: "tenant-1",
          recipient_id: mockProperties[0]?.owner_id,
          body: "Is this still available next month?",
          created_at: new Date().toISOString(),
        },
      ]);
    } else {
      logFailure({
        request,
        route: routeLabel,
        status: 500,
        startTime,
        error: err,
      });
      return permissionErrorResponse("unknown", { messages: [] });
    }
  }
  return NextResponse.json({
    messages,
    permission: buildPermission("unknown"),
  });
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/messages";

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return permissionErrorResponse("unknown");
  }

  try {
    const auth = await requireUser({ request, route: routeLabel, startTime });
    if (!auth.ok) {
      return permissionErrorResponse("not_authenticated");
    }
    const supabase = auth.supabase;
    const role = await getUserRole(supabase, auth.user.id);

    const body = await request.json().catch(() => null);
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) {
      return permissionErrorResponse("unknown");
    }
    const payload = parsed.data;

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, owner_id, title, is_approved, is_active")
      .eq("id", payload.property_id)
      .maybeSingle();

    if (propertyError || !property) {
      logFailure({
        request,
        route: routeLabel,
        status: 404,
        startTime,
        error: "Property not found",
      });
      return permissionErrorResponse("property_not_accessible");
    }

    const isOwner = auth.user.id === property.owner_id;
    const isPublished = property.is_approved === true && property.is_active === true;
    let hasThread = true;
    let tenantHasMessaged = true;

    if (isOwner) {
      const { data: existingThread } = await supabase
        .from("messages")
        .select("id, sender_id, sender_role")
        .eq("property_id", payload.property_id)
        .or(
          `and(sender_id.eq.${auth.user.id},recipient_id.eq.${payload.recipient_id}),and(sender_id.eq.${payload.recipient_id},recipient_id.eq.${auth.user.id})`
        )
        .limit(1);
      hasThread = !!existingThread?.length;
      tenantHasMessaged =
        existingThread?.some(
          (row) =>
            (row as { sender_role?: string | null }).sender_role === "tenant" ||
            row.sender_id === payload.recipient_id
        ) ?? false;
    }

    const permission = getMessagingPermission({
      senderRole: role,
      senderId: auth.user.id,
      recipientId: payload.recipient_id,
      propertyOwnerId: property.owner_id,
      propertyPublished: isPublished,
      isOwner,
      hasThread,
      hasTenantMessage: tenantHasMessaged,
    });

    if (!permission.allowed) {
      const code = permission.code ?? "unknown";
      logFailure({
        request,
        route: routeLabel,
        status: permissionStatus(code),
        startTime,
        error: permission.message ?? "Messaging restricted",
      });
      return permissionErrorResponse(code);
    }

    const rateLimit = checkMessagingRateLimit({
      senderId: auth.user.id,
      recipientId: payload.recipient_id,
      propertyId: payload.property_id,
    });

    if (!rateLimit.allowed) {
      if (hasServiceRoleEnv()) {
        const config = getMessagingRateLimitConfig();
        const threadKey = buildThrottleThreadKey({
          propertyId: payload.property_id,
          recipientId: payload.recipient_id,
          senderId: auth.user.id,
        });
        try {
          const adminClient = createServiceRoleClient();
          const row = buildThrottleTelemetryRow({
            actorProfileId: auth.user.id,
            threadKey,
            propertyId: payload.property_id,
            recipientProfileId: payload.recipient_id,
            retryAfterSeconds: rateLimit.retryAfterSeconds,
            windowSeconds: config.windowSeconds,
            maxSends: config.maxSends,
            mode: "send_message",
          });
          const result = await recordThrottleTelemetryEvent({
            client: adminClient,
            code: "rate_limited",
            row,
          });
          if (!result.ok && !result.skipped) {
            logFailure({
              request,
              route: routeLabel,
              status: 500,
              startTime,
              level: "warn",
              error: result.error || "messaging throttle telemetry insert failed",
            });
          }
        } catch (err) {
          logFailure({
            request,
            route: routeLabel,
            status: 500,
            startTime,
            level: "warn",
            error: err,
          });
        }
      }
      return permissionErrorResponse("rate_limited", {
        retry_after_seconds: rateLimit.retryAfterSeconds,
        cta: getMessagingReasonCta("rate_limited"),
      });
    }

    const tenantId = role === "tenant" ? auth.user.id : payload.recipient_id;
    const hostId = property.owner_id;

    const { data: threadRow, error: threadError } = await supabase
      .from("message_threads")
      .upsert(
        {
          property_id: payload.property_id,
          tenant_id: tenantId,
          host_id: hostId,
          subject: property.title ?? null,
          last_post_at: new Date().toISOString(),
        },
        { onConflict: "property_id,tenant_id,host_id" }
      )
      .select("id")
      .single();

    if (threadError || !threadRow) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(threadError?.message || "Unable to create thread"),
      });
      return NextResponse.json(
        { error: threadError?.message || "Unable to create thread", code: "unknown" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        ...payload,
        sender_id: auth.user.id,
        sender_role: role,
        thread_id: threadRow.id,
      })
      .select()
      .single();

    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json(
        { error: error.message, code: "unknown" },
        { status: 400 }
      );
    }
    await supabase
      .from("message_threads")
      .update({ last_post_at: new Date().toISOString() })
      .eq("id", threadRow.id);
    return NextResponse.json({ message: withDeliveryState(data) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unable to send message";
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
