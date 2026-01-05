"use client";

import { useEffect, useState } from "react";
import { MessageThread } from "@/components/messaging/MessageThread";
import { MESSAGING_RULES, type MessagingPermission } from "@/lib/messaging/permissions";
import { mapDeliveryState, withDeliveryState } from "@/lib/messaging/status";
import { hasBrowserSupabaseEnv } from "@/lib/supabase/client";
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
  const supabaseEnabled = hasBrowserSupabaseEnv();

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

  const sendDisabledReason = !supabaseEnabled
    ? "Messaging requires Supabase. Demo mode shows read-only messages."
    : permission?.allowed === false
      ? permission.message || "Messaging is restricted."
      : error
        ? "Messaging is unavailable right now."
        : loading
          ? "Checking messaging permissions..."
          : null;
  const canSend = !!supabaseEnabled && permission?.allowed === true;

  const handleSend = async (body: string) => {
    if (!supabaseEnabled || !canSend) {
      setError(sendDisabledReason || "Messaging is unavailable.");
      return;
    }

    if (propertyId.startsWith("mock") || recipientId.startsWith("owner-")) {
      setError("Messaging requires Supabase auth and real property IDs.");
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
        sendDisabledReason={sendDisabledReason}
        rules={MESSAGING_RULES}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
