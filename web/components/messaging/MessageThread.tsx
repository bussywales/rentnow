"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { applyQuickReply } from "@/lib/messaging/quick-replies";
import { shouldPersistDraft } from "@/lib/messaging/drafts";
import { deriveDeliveryState, formatDeliveryState } from "@/lib/messaging/status";
import type { Message, Profile } from "@/lib/types";

type Props = {
  messages: Message[];
  currentUser?: Profile | null;
  onSend?: (body: string) => Promise<boolean | void> | boolean | void;
  loading?: boolean;
  canSend?: boolean;
  sendDisabled?: boolean;
  cooldownMessage?: string | null;
  draftKey?: string | null;
  quickReplies?: string[];
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
  draftKey,
  quickReplies,
  restriction,
  rules,
}: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [draftNotice, setDraftNotice] = useState(false);
  const saveTimeout = useRef<number | null>(null);
  const sendAllowed = typeof canSend === "boolean" ? canSend : !!onSend;
  const showComposer = sendAllowed || !!cooldownMessage;
  const disableComposer = sending || !!sendDisabled;
  const replies = quickReplies ?? [];

  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) {
        setBody(saved);
        setDraftNotice(true);
      } else {
        setBody("");
        setDraftNotice(false);
      }
    } catch {
      // Ignore storage access issues.
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    if (saveTimeout.current) {
      window.clearTimeout(saveTimeout.current);
    }
    const nextValue = body;
    saveTimeout.current = window.setTimeout(() => {
      try {
        if (shouldPersistDraft(nextValue)) {
          window.localStorage.setItem(draftKey, nextValue);
        } else {
          window.localStorage.removeItem(draftKey);
        }
      } catch {
        // Ignore storage access issues.
      }
    }, 400);
    return () => {
      if (saveTimeout.current) {
        window.clearTimeout(saveTimeout.current);
      }
    };
  }, [body, draftKey]);

  const clearDraft = (clearBody = true) => {
    if (draftKey) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // Ignore storage access issues.
      }
    }
    if (clearBody) {
      setBody("");
    }
    setDraftNotice(false);
  };

  const handleSend = async () => {
    if (disableComposer) return;
    if (!body.trim()) return;
    setSending(true);
    try {
      let ok = true;
      if (onSend) {
        const result = await onSend(body.trim());
        ok = result !== false;
      } else {
        console.log("Sending message", body);
      }
      if (ok) {
        clearDraft(true);
      }
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (reply: string) => {
    if (disableComposer) return;
    setBody((current) => applyQuickReply(current, reply));
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
            {sendAllowed && replies.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {replies.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                    onClick={() => handleQuickReply(reply)}
                    disabled={disableComposer}
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ask about availability, payment terms, or viewing details."
              disabled={disableComposer}
            />
            {draftNotice && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>Draft restored.</span>
                <button
                  type="button"
                  className="font-semibold text-slate-700 underline underline-offset-4"
                  onClick={() => clearDraft(true)}
                >
                  Clear draft
                </button>
              </div>
            )}
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
