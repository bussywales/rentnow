"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { deriveDeliveryState, formatDeliveryState } from "@/lib/messaging/status";
import type { Message, Profile } from "@/lib/types";

type Props = {
  messages: Message[];
  currentUser?: Profile | null;
  onSend?: (body: string) => Promise<void> | void;
  loading?: boolean;
  canSend?: boolean;
  sendDisabled?: boolean;
  cooldownMessage?: string | null;
  restriction?: {
    message: string;
    detail?: string;
    cta?: { href: string; label: string };
  } | null;
  rules?: string[];
};

export function MessageThread({
  messages,
  currentUser,
  onSend,
  loading,
  canSend,
  sendDisabled,
  cooldownMessage,
  restriction,
  rules,
}: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const sendAllowed = typeof canSend === "boolean" ? canSend : !!onSend;
  const showComposer = sendAllowed || !!cooldownMessage;
  const disableComposer = sending || !!sendDisabled;

  const handleSend = async () => {
    if (disableComposer) return;
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
                {message.sender_id === currentUser?.id && (
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {formatDeliveryState(deriveDeliveryState(message))}
                  </span>
                )}
              </p>
              <p>{message.body}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No messages yet.</p>
        )}
      </div>
      <div className="space-y-2">
        {rules?.length ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Messaging rules
            </p>
            <ul className="mt-2 space-y-1">
              {rules.map((rule) => (
                <li key={rule}>• {rule}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {showComposer ? (
          <>
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ask about availability, payment terms, or viewing details."
              disabled={disableComposer}
            />
            {cooldownMessage && (
              <p className="text-xs text-amber-800">{cooldownMessage}</p>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={disableComposer}>
                {sending ? "Sending..." : "Send message"}
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>{restriction?.message || "Messaging is read-only here."}</p>
            {restriction?.detail && (
              <p className="mt-1 text-xs text-amber-800">{restriction.detail}</p>
            )}
            {restriction?.cta && (
              <Link
                href={restriction.cta.href}
                className="mt-2 inline-flex text-xs font-semibold text-amber-900 underline"
              >
                {restriction.cta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
