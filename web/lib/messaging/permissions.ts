import type { UserRole } from "@/lib/types";

export type MessagingPermissionCode =
  | "auth_required"
  | "messaging_unavailable"
  | "missing_property"
  | "property_not_found"
  | "property_unavailable"
  | "role_required"
  | "role_not_permitted"
  | "recipient_not_owner"
  | "owner_cannot_start"
  | "owner_mismatch"
  | "self_message"
  | "recipient_role_unavailable";

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
  recipientRole?: UserRole | null;
};

const MESSAGING_PERMISSION_MESSAGES: Record<MessagingPermissionCode, string> = {
  auth_required: "Sign in to message the host.",
  messaging_unavailable: "Messaging is unavailable right now. Try again later.",
  missing_property: "Select a listing before messaging.",
  property_not_found: "Listing not found.",
  property_unavailable: "Messaging is unavailable for this listing.",
  role_required: "Complete onboarding to enable messaging.",
  role_not_permitted: "Your account cannot send messages.",
  recipient_not_owner: "Messaging is only available for the listing host.",
  owner_cannot_start: "Hosts can reply after a tenant starts the conversation.",
  owner_mismatch: "Only the listing host can reply in this thread.",
  self_message: "You cannot message yourself.",
  recipient_role_unavailable: "Messaging is restricted to tenants and listing hosts.",
};

export const MESSAGING_RULES = [
  "Tenants can message a listing host (landlord or agent) once the listing is live.",
  "Landlords and agents can reply after a tenant sends the first message.",
  "Messaging is only available between a tenant and the listing host.",
];

export function getMessagingPermissionMessage(code: MessagingPermissionCode): string {
  return MESSAGING_PERMISSION_MESSAGES[code];
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
    recipientRole,
  } = context;

  if (!recipientId) {
    return {
      allowed: false,
      code: "missing_property",
      message: getMessagingPermissionMessage("missing_property"),
    };
  }

  if (senderId === recipientId) {
    return {
      allowed: false,
      code: "self_message",
      message: getMessagingPermissionMessage("self_message"),
    };
  }

  if (!senderRole) {
    return {
      allowed: false,
      code: "role_required",
      message: getMessagingPermissionMessage("role_required"),
    };
  }

  if (senderRole === "tenant") {
    if (propertyOwnerId && recipientId !== propertyOwnerId) {
      return {
        allowed: false,
        code: "recipient_not_owner",
        message: getMessagingPermissionMessage("recipient_not_owner"),
      };
    }

    if (!propertyPublished) {
      return {
        allowed: false,
        code: "property_unavailable",
        message: getMessagingPermissionMessage("property_unavailable"),
      };
    }

    if (recipientRole && recipientRole !== "landlord" && recipientRole !== "agent") {
      return {
        allowed: false,
        code: "recipient_role_unavailable",
        message: getMessagingPermissionMessage("recipient_role_unavailable"),
      };
    }

    return { allowed: true };
  }

  if (senderRole === "landlord" || senderRole === "agent") {
    if (!isOwner) {
      return {
        allowed: false,
        code: "owner_mismatch",
        message: getMessagingPermissionMessage("owner_mismatch"),
      };
    }

    if (!hasThread) {
      return {
        allowed: false,
        code: "owner_cannot_start",
        message: getMessagingPermissionMessage("owner_cannot_start"),
      };
    }

    if (recipientRole && recipientRole !== "tenant") {
      return {
        allowed: false,
        code: "recipient_role_unavailable",
        message: getMessagingPermissionMessage("recipient_role_unavailable"),
      };
    }

    return { allowed: true };
  }

  return {
    allowed: false,
    code: "role_not_permitted",
    message: getMessagingPermissionMessage("role_not_permitted"),
  };
}
