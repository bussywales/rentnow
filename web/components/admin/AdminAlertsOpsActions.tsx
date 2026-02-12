"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  alertsEnabled: boolean;
  killSwitchEnabled: boolean;
};

type ActionState = {
  kind: "idle" | "running" | "testing" | "disabling";
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

  const busy = state.kind !== "idle";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={runNow} disabled={busy}>
          {state.kind === "running" ? "Running..." : "Run alerts now"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={sendTest} disabled={busy}>
          {state.kind === "testing" ? "Sending..." : "Send test digest to me"}
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
