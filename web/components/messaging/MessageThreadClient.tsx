"use client";

import { useEffect, useState } from "react";
import { MessageThread } from "@/components/messaging/MessageThread";
import {
  MESSAGING_RULES,
  getMessagingPermissionMessage,
  getMessagingReasonCta,
  type MessagingPermission,
} from "@/lib/messaging/permissions";
import { mapDeliveryState, withDeliveryState } from "@/lib/messaging/status";
import type { Message, Profile } from "@/lib/types";

type Props = {
  propertyId: string;
  recipientId: string;
  currentUser?: Profile | null;
};

export function MessageThreadClient({
  propertyId,
  recipientId,
  currentUser,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<MessagingPermission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages?propertyId=${propertyId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Unable to load messages.");
          setPermission(data?.permission ?? null);
          return;
        }
        const data = await res.json();
        if (data?.messages) {
          setMessages(mapDeliveryState(data.messages));
        }
        setPermission(data?.permission ?? null);
        setError(null);
      } catch (err) {
        console.warn("Unable to load messages", err);
        setError("Unable to load messages.");
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [propertyId]);

  const reasonCode = permission?.allowed === false ? permission.code || "unknown" : null;
  const reasonMessage = reasonCode
    ? permission?.message || getMessagingPermissionMessage(reasonCode)
    : null;
  const restriction = permission?.allowed === false
    ? {
        message: reasonMessage || "Messaging is unavailable right now.",
        cta: reasonCode ? getMessagingReasonCta(reasonCode) ?? undefined : undefined,
      }
    : error
      ? {
          message: "Messaging is unavailable right now.",
          cta: getMessagingReasonCta("unknown") ?? undefined,
        }
      : loading
        ? { message: "Checking messaging permissions..." }
        : null;
  const canSend = permission?.allowed === true;

  const handleSend = async (body: string) => {
    if (!canSend) {
      setError(restriction?.message || "Messaging is unavailable.");
      return;
    }

    setError(null);
    const tempId = `local-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      property_id: propertyId,
      sender_id: currentUser?.id || "local-user",
      recipient_id: recipientId,
      body,
      created_at: new Date().toISOString(),
      delivery_state: "sent",
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: propertyId,
        recipient_id: recipientId,
        body,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.permission) {
        setPermission(data.permission);
      }
      setError(data?.error || "Unable to send message.");
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      return;
    }
    const data = await res.json();
    if (data?.message) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === tempId ? withDeliveryState(data.message) : message
        )
      );
    } else {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
    }
  };

  return (
    <div className="space-y-2">
      <MessageThread
        messages={messages}
        currentUser={currentUser}
        onSend={handleSend}
        loading={loading}
        canSend={canSend}
        restriction={restriction}
        rules={MESSAGING_RULES}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
