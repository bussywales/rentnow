"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { captureClientBoundaryException } from "@/lib/monitoring/sentry";

type Props = {
  alertsEnabled: boolean;
  killSwitchEnabled: boolean;
};

type ActionState = {
  kind:
    | "idle"
    | "running"
    | "testing"
    | "disabling"
    | "sentry_server"
    | "sentry_client";
  message: string | null;
  error: string | null;
};

const INITIAL_STATE: ActionState = {
  kind: "idle",
  message: null,
  error: null,
};

export function AdminAlertsOpsActions({ alertsEnabled, killSwitchEnabled }: Props) {
  const [state, setState] = useState<ActionState>(INITIAL_STATE);
  const [disabled, setDisabled] = useState(killSwitchEnabled || !alertsEnabled);

  const runNow = async () => {
    setState({ kind: "running", message: null, error: null });
    try {
      const response = await fetch("/api/admin/alerts/run", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(String(payload.error || payload.message || "Unable to run alerts"));
      }
      setState({
        kind: "idle",
        message: `Run complete: ${Number(payload.digests_sent || payload.emails_sent || 0)} digests sent.`,
        error: null,
      });
    } catch (error) {
      setState({
        kind: "idle",
        message: null,
        error: error instanceof Error ? error.message : "Unable to run alerts",
      });
    }
  };

  const sendTest = async () => {
    setState({ kind: "testing", message: null, error: null });
    try {
      const response = await fetch("/api/admin/alerts/test", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(String(payload.error || payload.message || "Unable to send test digest"));
      }
      setState({
        kind: "idle",
        message: `Test digest sent to ${String(payload.recipient || "your account")}.`,
        error: null,
      });
    } catch (error) {
      setState({
        kind: "idle",
        message: null,
        error: error instanceof Error ? error.message : "Unable to send test digest",
      });
    }
  };

  const disableAll = async () => {
    setState({ kind: "disabling", message: null, error: null });
    try {
      const killSwitchResponse = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "alerts_kill_switch_enabled",
          value: { enabled: true },
        }),
      });
      const killSwitchPayload = (await killSwitchResponse.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!killSwitchResponse.ok) {
        throw new Error(
          String(killSwitchPayload.error || killSwitchPayload.message || "Unable to enable kill switch")
        );
      }

      const disableEmailResponse = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "alerts_email_enabled",
          value: { enabled: false },
        }),
      });
      const disableEmailPayload = (await disableEmailResponse.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!disableEmailResponse.ok) {
        throw new Error(
          String(disableEmailPayload.error || disableEmailPayload.message || "Unable to disable alerts")
        );
      }
      setDisabled(true);
      setState({
        kind: "idle",
        message: "Kill switch enabled. All alerts disabled.",
        error: null,
      });
    } catch (error) {
      setState({
        kind: "idle",
        message: null,
        error: error instanceof Error ? error.message : "Unable to disable alerts",
      });
    }
  };

  const sendServerSentryTest = async () => {
    setState({ kind: "sentry_server", message: null, error: null });
    try {
      const response = await fetch("/api/admin/sentry/test", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(
          String(payload.error || payload.message || "Unable to send test Sentry server event")
        );
      }
      setState({
        kind: "idle",
        message: "Temporary Sentry server test event sent.",
        error: null,
      });
    } catch (error) {
      setState({
        kind: "idle",
        message: null,
        error:
          error instanceof Error ? error.message : "Unable to send test Sentry server event",
      });
    }
  };

  const sendClientSentryTest = () => {
    setState({ kind: "sentry_client", message: null, error: null });
    try {
      throw new Error("Admin-triggered temporary Sentry client verification event");
    } catch (error) {
      captureClientBoundaryException(error as Error, {
        route: "/admin/alerts",
        pathname: "/admin/alerts",
        href: globalThis.location?.href ?? "/admin/alerts",
        userAgent: globalThis.navigator?.userAgent ?? null,
        tags: {
          feature: "admin_alerts",
          sentry_test: "client_verification",
          temporary: true,
        },
        extra: {
          source: "AdminAlertsOpsActions",
          action: "send_test_sentry_client_event",
        },
        fingerprint: ["admin-alerts", "sentry-test", "client"],
      });
      setState({
        kind: "idle",
        message: "Temporary Sentry client test event sent.",
        error: null,
      });
    }
  };

  const busy = state.kind !== "idle";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Temporary Sentry verification tools for admin ops only. Remove after verification is complete.
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={runNow} disabled={busy}>
          {state.kind === "running" ? "Running..." : "Run alerts now"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={sendTest} disabled={busy}>
          {state.kind === "testing" ? "Sending..." : "Send test digest to me"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={sendServerSentryTest}
          disabled={busy}
        >
          {state.kind === "sentry_server" ? "Sending..." : "Send test Sentry server event"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={sendClientSentryTest}
          disabled={busy}
        >
          {state.kind === "sentry_client" ? "Sending..." : "Send test Sentry client event"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={disableAll} disabled={busy || disabled}>
          {state.kind === "disabling" ? "Disabling..." : "Disable all alerts (kill switch)"}
        </Button>
      </div>
      {state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      {state.error ? <p className="text-xs text-rose-700">{state.error}</p> : null}
    </div>
  );
}
