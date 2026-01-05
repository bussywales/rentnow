import { normalizeRole } from "@/lib/roles";
import {
  getMessagingPermission,
  getMessagingPermissionMessage,
  type MessagingPermissionCode,
} from "@/lib/messaging/permissions";
import { deriveDeliveryState } from "@/lib/messaging/status";
import type { MessageDeliveryState, UserRole } from "@/lib/types";

type MessagingProfile = {
  id: string;
  role: string | null;
};

type MessagingMessage = {
  id: string;
  property_id: string;
  sender_id: string;
  recipient_id: string;
  created_at?: string | null;
  delivery_state?: MessageDeliveryState;
};

type MessagingProperty = {
  id: string;
  owner_id: string;
  is_approved?: boolean | null;
  is_active?: boolean | null;
};

export type MessagingUserCount = {
  userId: string;
  sent: number;
  received: number;
  total: number;
  lastMessageAt: string | null;
};

export type MessagingRestrictedCase = {
  messageId: string;
  propertyId: string;
  senderId: string;
  recipientId: string;
  reason: MessagingPermissionCode;
  reasonLabel: string;
  senderRole: UserRole | null;
  recipientRole: UserRole | null;
};

export type MessagingAdminMessage = {
  id: string;
  propertyId: string;
  senderId: string;
  recipientId: string;
  senderRole: UserRole | null;
  recipientRole: UserRole | null;
  status: MessageDeliveryState | "restricted";
  reasonCode?: MessagingPermissionCode;
  reasonLabel?: string;
  createdAt?: string | null;
};

export type MessagingAdminSnapshot = {
  totalMessages: number;
  statusCounts: Record<MessageDeliveryState, number>;
  perUser: MessagingUserCount[];
  restricted: MessagingRestrictedCase[];
  recentMessages: MessagingAdminMessage[];
};

export function filterMessagingAdminMessages(
  messages: MessagingAdminMessage[],
  status: string,
  reason: string
): MessagingAdminMessage[] {
  return messages.filter((item) => {
    if (status !== "all" && item.status !== status) return false;
    if (status === "restricted" && reason !== "all") {
      return item.reasonCode === reason;
    }
    return true;
  });
}

function ensureUserCount(
  counts: Map<string, MessagingUserCount>,
  userId: string
): MessagingUserCount {
  const existing = counts.get(userId);
  if (existing) return existing;
  const entry = {
    userId,
    sent: 0,
    received: 0,
    total: 0,
    lastMessageAt: null,
  };
  counts.set(userId, entry);
  return entry;
}

function updateLastMessageAt(entry: MessagingUserCount, createdAt?: string | null) {
  if (!createdAt) return;
  const current = entry.lastMessageAt ? Date.parse(entry.lastMessageAt) : 0;
  const next = Date.parse(createdAt);
  if (!Number.isNaN(next) && next > current) {
    entry.lastMessageAt = createdAt;
  }
}

function resolveRole(roleById: Map<string, UserRole | null>, id: string): UserRole | null {
  return roleById.get(id) ?? null;
}

export function buildMessagingAdminSnapshot(input: {
  messages: MessagingMessage[];
  profiles: MessagingProfile[];
  properties: MessagingProperty[];
}): MessagingAdminSnapshot {
  const roleById = new Map<string, UserRole | null>(
    input.profiles.map((profile) => [profile.id, normalizeRole(profile.role)])
  );
  const propertyById = new Map<string, MessagingProperty>(
    input.properties.map((property) => [property.id, property])
  );

  const statusCounts: Record<MessageDeliveryState, number> = {
    sent: 0,
    delivered: 0,
    read: 0,
  };
  const userCounts = new Map<string, MessagingUserCount>();
  const restricted: MessagingRestrictedCase[] = [];
  const recentMessages: MessagingAdminMessage[] = [];

  const sortedMessages = [...input.messages].sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    return aTime - bTime;
  });

  const tenantThreadStarted = new Map<string, boolean>();

  for (const message of sortedMessages) {
    const deliveryState = deriveDeliveryState(message);
    statusCounts[deliveryState] += 1;

    const senderEntry = ensureUserCount(userCounts, message.sender_id);
    senderEntry.sent += 1;
    senderEntry.total += 1;
    updateLastMessageAt(senderEntry, message.created_at);

    const recipientEntry = ensureUserCount(userCounts, message.recipient_id);
    recipientEntry.received += 1;
    recipientEntry.total += 1;
    updateLastMessageAt(recipientEntry, message.created_at);

    const senderRole = resolveRole(roleById, message.sender_id);
    const recipientRole = resolveRole(roleById, message.recipient_id);
    const property = propertyById.get(message.property_id);
    if (!property) {
      const reason = "property_not_accessible" as MessagingPermissionCode;
      const reasonLabel = getMessagingPermissionMessage(reason);
      restricted.push({
        messageId: message.id,
        propertyId: message.property_id,
        senderId: message.sender_id,
        recipientId: message.recipient_id,
        reason,
        reasonLabel,
        senderRole,
        recipientRole,
      });
      recentMessages.push({
        id: message.id,
        propertyId: message.property_id,
        senderId: message.sender_id,
        recipientId: message.recipient_id,
        senderRole,
        recipientRole,
        status: "restricted",
        reasonCode: reason,
        reasonLabel,
        createdAt: message.created_at ?? null,
      });
      continue;
    }

    const hostId = property.owner_id;
    const includesHost =
      message.sender_id === hostId || message.recipient_id === hostId;
    if (!includesHost) {
      const reason = "conversation_not_allowed" as MessagingPermissionCode;
      const reasonLabel = getMessagingPermissionMessage(reason);
      restricted.push({
        messageId: message.id,
        propertyId: message.property_id,
        senderId: message.sender_id,
        recipientId: message.recipient_id,
        reason,
        reasonLabel,
        senderRole,
        recipientRole,
      });
      recentMessages.push({
        id: message.id,
        propertyId: message.property_id,
        senderId: message.sender_id,
        recipientId: message.recipient_id,
        senderRole,
        recipientRole,
        status: "restricted",
        reasonCode: reason,
        reasonLabel,
        createdAt: message.created_at ?? null,
      });
      continue;
    }

    const tenantId = message.sender_id === hostId ? message.recipient_id : message.sender_id;
    const threadKey = `${message.property_id}:${tenantId}`;
    const hasThread = tenantThreadStarted.get(threadKey) ?? false;

    const permission = getMessagingPermission({
      senderRole,
      senderId: message.sender_id,
      recipientId: message.recipient_id,
      propertyOwnerId: hostId,
      propertyPublished: property.is_approved === true && property.is_active === true,
      isOwner: message.sender_id === hostId,
      hasThread,
      recipientRole,
    });

    if (!permission.allowed) {
      const reason = permission.code ?? "unknown";
      const reasonLabel = permission.message ?? getMessagingPermissionMessage(reason);
      restricted.push({
        messageId: message.id,
        propertyId: message.property_id,
        senderId: message.sender_id,
        recipientId: message.recipient_id,
        reason,
        reasonLabel,
        senderRole,
        recipientRole,
      });
      recentMessages.push({
        id: message.id,
        propertyId: message.property_id,
        senderId: message.sender_id,
        recipientId: message.recipient_id,
        senderRole,
        recipientRole,
        status: "restricted",
        reasonCode: reason,
        reasonLabel,
        createdAt: message.created_at ?? null,
      });
    } else {
      recentMessages.push({
        id: message.id,
        propertyId: message.property_id,
        senderId: message.sender_id,
        recipientId: message.recipient_id,
        senderRole,
        recipientRole,
        status: deliveryState,
        createdAt: message.created_at ?? null,
      });
    }

    if (includesHost && message.sender_id !== hostId) {
      tenantThreadStarted.set(threadKey, true);
    }
  }

  const perUser = Array.from(userCounts.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  return {
    totalMessages: sortedMessages.length,
    statusCounts,
    perUser,
    restricted,
    recentMessages,
  };
}
