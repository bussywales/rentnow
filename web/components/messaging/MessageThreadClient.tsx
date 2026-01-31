"use client";

import { useEffect, useState } from "react";
import { MessageThread } from "@/components/messaging/MessageThread";
import {
  MESSAGING_RULES,
  getMessagingPermissionMessage,
  getMessagingReasonCta,
  type MessagingPermission,
} from "@/lib/messaging/permissions";
import {
  formatCooldownMessage,
  getCooldownRemaining,
  resolveCooldownUntil,
} from "@/lib/messaging/cooldown";
import { buildDraftStorageKey } from "@/lib/messaging/drafts";
import { QUICK_REPLIES } from "@/lib/messaging/quick-replies";
import { mapDeliveryState, withDeliveryState } from "@/lib/messaging/status";
import type { Message, Profile } from "@/lib/types";
import { MessageShareButton } from "@/components/messaging/MessageShareButton";
import { CONTACT_EXCHANGE_COMPOSER_NOTICE, CONTACT_EXCHANGE_BLOCK_CODE } from "@/lib/messaging/contact-exchange";

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
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [composerError, setComposerError] = useState<string | null>(null);

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = getCooldownRemaining(cooldownUntil);
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        setCooldownUntil(null);
      }
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  const activateCooldown = (retryAfterSeconds: number | null | undefined) => {
    const nextUntil = resolveCooldownUntil(retryAfterSeconds);
    if (nextUntil) {
      setCooldownUntil(nextUntil);
    }
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages?propertyId=${propertyId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const permissionCode = data?.permission?.code ?? data?.code ?? null;
          setError(data?.error || "Unable to load messages.");
          setPermission(data?.permission ?? null);
          if (permissionCode === "rate_limited") {
            activateCooldown(data?.retry_after_seconds);
          } else {
            setCooldownUntil(null);
          }
          return;
        }
        const data = await res.json();
        if (data?.messages) {
          setMessages(mapDeliveryState(data.messages));
        }
        setPermission(data?.permission ?? null);
        if (data?.permission?.code === "rate_limited") {
          activateCooldown(data?.retry_after_seconds);
        } else {
          setCooldownUntil(null);
        }
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
  const isRateLimited = reasonCode === "rate_limited";
  const cooldownMessage =
    isRateLimited && cooldownRemaining > 0
      ? formatCooldownMessage(cooldownRemaining)
      : null;
  const restriction = permission?.allowed === false && !isRateLimited
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
  const canSend =
    permission?.allowed === true || (isRateLimited && cooldownRemaining === 0);
  const canDraft = permission?.allowed === true || isRateLimited;
  const draftKey =
    canDraft && currentUser?.id
      ? buildDraftStorageKey(`${propertyId}:${currentUser.id}`)
      : null;
  const quickReplies = canSend ? QUICK_REPLIES : [];

  const handleSend = async (body: string) => {
    if (cooldownRemaining > 0) {
      setError(null);
      setComposerError(null);
      return false;
    }
    if (!canSend) {
      setError(restriction?.message || "Messaging is unavailable.");
      setComposerError(null);
      return false;
    }

    setError(null);
    setComposerError(null);

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
      const permissionCode = data?.permission?.code ?? data?.code ?? null;
      if (permissionCode === CONTACT_EXCHANGE_BLOCK_CODE) {
        setComposerError(data?.message || "Contact details can’t be shared.");
        return false;
      }
      if (permissionCode === "rate_limited") {
        activateCooldown(data?.retry_after_seconds);
        setError(null);
      } else {
        setError(data?.error || "Unable to send message.");
      }
      return false;
    }
    const data = await res.json();
    if (data?.message) {
      setMessages((prev) => [...prev, withDeliveryState(data.message)]);
      setCooldownUntil(null);
      return true;
    }
    return false;
  };

  return (
    <div className="space-y-2">
      {permission?.allowed && currentUser?.id && (
        <MessageShareButton
          propertyId={propertyId}
          tenantId={currentUser.id}
        />
      )}
      <MessageThread
        messages={messages}
        currentUser={currentUser}
        onSend={handleSend}
        loading={loading}
        canSend={canSend}
        sendDisabled={cooldownRemaining > 0}
        cooldownMessage={cooldownMessage}
        draftKey={draftKey}
        quickReplies={quickReplies}
        composerNotice={CONTACT_EXCHANGE_COMPOSER_NOTICE}
        composerError={composerError}
        restriction={restriction}
        rules={MESSAGING_RULES}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
