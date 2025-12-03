"use client";

import { useEffect, useState } from "react";
import { MessageThread } from "@/components/messaging/MessageThread";
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
  const [loading, setLoading] = useState(true);
  const supabaseEnabled =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages?propertyId=${propertyId}`);
        const data = await res.json();
        if (data?.messages) setMessages(data.messages);
      } catch (err) {
        console.warn("Unable to load messages", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [propertyId]);

  const handleSend = async (body: string) => {
    if (!supabaseEnabled) {
      setError("Messaging requires Supabase. Demo mode shows read-only messages.");
      return;
    }

    if (propertyId.startsWith("mock") || recipientId.startsWith("owner-")) {
      setError("Messaging requires Supabase auth and real property IDs.");
      return;
    }

    setError(null);
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
      const text = await res.text();
      setError(text || "Unable to send message.");
      return;
    }
    const data = await res.json();
    if (data?.message) {
      setMessages((prev) => [...prev, data.message]);
    }
  };

  return (
    <div className="space-y-2">
      <MessageThread
        messages={messages}
        currentUser={currentUser}
        onSend={handleSend}
        loading={loading}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
