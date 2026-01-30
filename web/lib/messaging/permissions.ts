import type { UserRole } from "@/lib/types";

export const MESSAGING_REASON_CODES = [
  "not_authenticated",
  "onboarding_incomplete",
  "role_not_allowed",
  "property_not_accessible",
  "conversation_not_allowed",
  "rate_limited",
  "unknown",
] as const;

export type MessagingPermissionCode = (typeof MESSAGING_REASON_CODES)[number];

export type MessagingPermission = {
  allowed: boolean;
  code?: MessagingPermissionCode;
  message?: string;
};

export type MessagingPermissionContext = {
  senderRole: UserRole | null;
  senderId: string;
  recipientId: string;
  propertyOwnerId: string | null;
  propertyPublished: boolean;
  isOwner: boolean;
  hasThread: boolean;
  hasTenantMessage?: boolean;
  recipientRole?: UserRole | null;
};

const MESSAGING_PERMISSION_MESSAGES: Record<MessagingPermissionCode, string> = {
  not_authenticated: "Sign in to message the host.",
  onboarding_incomplete: "Complete onboarding to message the host.",
  role_not_allowed: "Your account cannot send messages.",
  property_not_accessible: "Messaging is unavailable for this listing.",
  conversation_not_allowed: "Messaging is only available between a tenant and the listing host.",
  rate_limited: "Too many messages. Try again shortly.",
  unknown: "Messaging is unavailable right now. Try again later.",
};

export const MESSAGING_RULES = [
  "Tenants can message a listing host (landlord or agent) once the listing is live.",
  "Landlords and agents can reply after a tenant sends the first message.",
  "Messaging is only available between a tenant and the listing host.",
];

export function getMessagingPermissionMessage(code: MessagingPermissionCode): string {
  return MESSAGING_PERMISSION_MESSAGES[code];
}

export function getMessagingReasonCta(
  code: MessagingPermissionCode
): { href: string; label: string } | null {
  switch (code) {
    case "not_authenticated":
      return { href: "/auth/login", label: "Sign in" };
    case "onboarding_incomplete":
      return { href: "/onboarding", label: "Finish onboarding" };
    case "unknown":
    case "property_not_accessible":
    case "conversation_not_allowed":
    case "role_not_allowed":
    case "rate_limited":
    default:
      return { href: "/support", label: "Contact support" };
  }
}

export function buildMessagingPermission(code: MessagingPermissionCode): MessagingPermission {
  return {
    allowed: false,
    code,
    message: getMessagingPermissionMessage(code),
  };
}

export function getMessagingPermission(
  context: MessagingPermissionContext
): MessagingPermission {
  const {
    senderRole,
    senderId,
    recipientId,
    propertyOwnerId,
    propertyPublished,
    isOwner,
    hasThread,
    hasTenantMessage,
    recipientRole,
  } = context;
  const tenantHasMessaged = typeof hasTenantMessage === "boolean" ? hasTenantMessage : hasThread;

  if (!recipientId) {
    return buildMessagingPermission("property_not_accessible");
  }

  if (senderId === recipientId) {
    return buildMessagingPermission("conversation_not_allowed");
  }

  if (!senderRole) {
    return buildMessagingPermission("onboarding_incomplete");
  }

  if (senderRole === "tenant") {
    if (propertyOwnerId && recipientId !== propertyOwnerId) {
      return buildMessagingPermission("conversation_not_allowed");
    }

    if (!propertyPublished) {
      return buildMessagingPermission("property_not_accessible");
    }

    if (recipientRole && recipientRole !== "landlord" && recipientRole !== "agent") {
      return buildMessagingPermission("conversation_not_allowed");
    }

    return { allowed: true };
  }

  if (senderRole === "landlord" || senderRole === "agent") {
    if (!isOwner) {
      return buildMessagingPermission("conversation_not_allowed");
    }

    if (!tenantHasMessaged) {
      return buildMessagingPermission("conversation_not_allowed");
    }

    if (recipientRole && recipientRole !== "tenant") {
      return buildMessagingPermission("conversation_not_allowed");
    }

    return { allowed: true };
  }

  return buildMessagingPermission("role_not_allowed");
}
