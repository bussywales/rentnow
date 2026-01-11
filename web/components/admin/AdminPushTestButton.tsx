"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Status =
  | "idle"
  | "sending"
  | "success"
  | "no_subscriptions"
  | "push_not_configured"
  | "error";

const STATUS_COPY: Record<Exclude<Status, "idle" | "sending">, string> = {
  success: "Test push sent. Check your device.",
  no_subscriptions:
    "You don't have push notifications enabled on this device yet. Please opt-in first, then try again.",
  push_not_configured: "Push notifications are not configured on this environment.",
  error: "Unable to send a test push right now.",
};

type Props = {
  debug?: boolean;
};

export function AdminPushTestButton({ debug = false }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [debugPayload, setDebugPayload] = useState<string | null>(null);

  const handleClick = async () => {
    setStatus("sending");
    setDebugPayload(null);

    try {
      const response = await fetch("/api/admin/push/test", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; code?: string }
        | null;

      if (debug) {
        setDebugPayload(JSON.stringify(payload, null, 2));
      }

      if (response.ok && payload?.ok) {
        setStatus("success");
        return;
      }

      if (payload?.code === "no_subscriptions") {
        setStatus("no_subscriptions");
        return;
      }

      if (payload?.code === "push_not_configured" || response.status === 503) {
        setStatus("push_not_configured");
        return;
      }

      setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  const message =
    status !== "idle" && status !== "sending" ? STATUS_COPY[status] : null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" type="button" onClick={handleClick} disabled={status === "sending"}>
          {status === "sending" ? "Sending..." : "Send test push"}
        </Button>
        {message && (
          <p className="text-xs text-slate-600">{message}</p>
        )}
      </div>
      {debug && debugPayload && (
        <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
          {debugPayload}
        </pre>
      )}
    </div>
  );
}
