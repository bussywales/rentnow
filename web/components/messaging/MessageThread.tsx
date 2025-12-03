"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { Message, Profile } from "@/lib/types";

type Props = {
  messages: Message[];
  currentUser?: Profile | null;
  onSend?: (body: string) => Promise<void> | void;
  loading?: boolean;
};

export function MessageThread({ messages, currentUser, onSend, loading }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      if (onSend) {
        await onSend(body.trim());
      } else {
        console.log("Sending message", body);
      }
      setBody("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading messages...</p>
        ) : messages.length ? (
          messages.map((message) => (
            <div
              key={message.id}
              className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              <p className="mb-1 text-xs text-slate-500">
                {message.sender_id === currentUser?.id ? "You" : "Contact"} -{" "}
                {new Date(message.created_at || "").toLocaleString()}
              </p>
              <p>{message.body}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No messages yet.</p>
        )}
      </div>
      <div className="space-y-2">
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ask about availability, payment terms, or viewing details."
        />
        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send message"}
          </Button>
        </div>
      </div>
    </div>
  );
}
