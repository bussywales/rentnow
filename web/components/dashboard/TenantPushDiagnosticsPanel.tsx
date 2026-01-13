"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { TenantPushDiagnostics } from "@/lib/tenant/push-diagnostics";

type PushStatusResponse = {
  ok?: boolean;
  configured?: boolean;
  vapidPublicKey?: string | null;
  active?: boolean;
  subscriptionCount?: number;
  code?: string;
  message?: string;
  error?: string;
};

type DiagnosticsResponse = {
  ok?: boolean;
  diagnostics?: TenantPushDiagnostics;
  error?: string;
};

type PushStatusState = {
  loading: boolean;
  supported: boolean;
  configured: boolean;
  publicKey: string | null;
  active: boolean;
  subscriptionCount: number;
  permission: NotificationPermission;
  serviceWorkerAvailable: boolean;
  deviceSubscription: PushSubscription | null;
  error: string | null;
};

const defaultStatus: PushStatusState = {
  loading: true,
  supported: true,
  configured: false,
  publicKey: null,
  active: false,
  subscriptionCount: 0,
  permission: "default",
  serviceWorkerAvailable: false,
  deviceSubscription: null,
  error: null,
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function TenantPushDiagnosticsPanel() {
  const [status, setStatus] = useState<PushStatusState>(defaultStatus);
  const [diagnostics, setDiagnostics] = useState<TenantPushDiagnostics | null>(
    null
  );
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const debug = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("debug");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const supportsPush =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    const loadDeviceState = async () => {
      if (!supportsPush) {
        if (cancelled) return;
        setStatus((prev) => ({
          ...prev,
          supported: false,
          permission: "default",
          serviceWorkerAvailable: false,
          deviceSubscription: null,
          loading: false,
        }));
        return;
      }

      let serviceWorkerAvailable = false;
      let deviceSubscription: PushSubscription | null = null;

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        serviceWorkerAvailable = !!registration;
        if (registration) {
          const ready = await navigator.serviceWorker.ready;
          deviceSubscription = await ready.pushManager.getSubscription();
        }
      } catch {
        serviceWorkerAvailable = false;
        deviceSubscription = null;
      }

      if (cancelled) return;
      setStatus((prev) => ({
        ...prev,
        supported: true,
        permission: Notification.permission,
        serviceWorkerAvailable,
        deviceSubscription,
      }));
    };

    const loadPushStatus = async () => {
      try {
        const response = await fetch("/api/push/status");
        const payload = (await response.json().catch(() => null)) as
          | PushStatusResponse
          | null;
        if (cancelled) return;
        setStatus((prev) => ({
          ...prev,
          loading: false,
          configured: payload?.configured === true,
          publicKey: payload?.vapidPublicKey ?? null,
          active: payload?.active === true,
          subscriptionCount: payload?.subscriptionCount ?? 0,
          error: response.ok
            ? null
            : payload?.message || payload?.error || "Push unavailable",
        }));
      } catch {
        if (cancelled) return;
        setStatus((prev) => ({
          ...prev,
          loading: false,
          configured: false,
          publicKey: null,
          active: false,
          subscriptionCount: 0,
          error: "Unable to load push status",
        }));
      }
    };

    const loadDiagnostics = async () => {
      setLoadingDiagnostics(true);
      try {
        const response = await fetch("/api/tenant/push/diagnostics");
        const payload = (await response.json().catch(() => null)) as
          | DiagnosticsResponse
          | null;
        if (cancelled) return;
        if (!response.ok || !payload?.diagnostics) {
          setDiagnostics(null);
          setDiagnosticsError(payload?.error || "Diagnostics unavailable");
        } else {
          setDiagnostics(payload.diagnostics);
          setDiagnosticsError(null);
        }
      } catch {
        if (cancelled) return;
        setDiagnostics(null);
        setDiagnosticsError("Diagnostics unavailable");
      } finally {
        if (!cancelled) setLoadingDiagnostics(false);
      }
    };

    loadDeviceState();
    loadPushStatus();
    loadDiagnostics();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshAll = async () => {
    setStatusMessage(null);
    setLoadingDiagnostics(true);
    await Promise.all([
      fetch("/api/push/status")
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | PushStatusResponse
            | null;
          setStatus((prev) => ({
            ...prev,
            loading: false,
            configured: payload?.configured === true,
            publicKey: payload?.vapidPublicKey ?? null,
            active: payload?.active === true,
            subscriptionCount: payload?.subscriptionCount ?? 0,
            error: response.ok
              ? null
              : payload?.message || payload?.error || "Push unavailable",
          }));
        })
        .catch(() => {
          setStatus((prev) => ({
            ...prev,
            loading: false,
            configured: false,
            publicKey: null,
            active: false,
            subscriptionCount: 0,
            error: "Unable to load push status",
          }));
        }),
      fetch("/api/tenant/push/diagnostics")
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | DiagnosticsResponse
            | null;
          if (!response.ok || !payload?.diagnostics) {
            setDiagnostics(null);
            setDiagnosticsError(payload?.error || "Diagnostics unavailable");
          } else {
            setDiagnostics(payload.diagnostics);
            setDiagnosticsError(null);
          }
        })
        .catch(() => {
          setDiagnostics(null);
          setDiagnosticsError("Diagnostics unavailable");
        })
        .finally(() => setLoadingDiagnostics(false)),
    ]);
  };

  const handleEnableNotifications = async () => {
    setStatusMessage(null);
    if (!status.supported) return;
    if (Notification.permission === "denied") {
      setStatus((prev) => ({ ...prev, permission: Notification.permission }));
      setStatusMessage("Notifications are blocked in this browser.");
      return;
    }

    setIsWorking(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setStatus((prev) => ({ ...prev, permission: nextPermission }));
      if (nextPermission !== "granted") {
        setStatusMessage("Enable notifications to receive alerts.");
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleCreateSubscription = async (forceNew: boolean) => {
    setStatusMessage(null);
    if (!status.supported || !status.configured || !status.publicKey) return;
    if (status.permission === "denied") {
      setStatusMessage("Notifications are blocked in this browser.");
      return;
    }
    if (!status.serviceWorkerAvailable) {
      setStatusMessage("Service worker not available on this device.");
      return;
    }
    if (Notification.permission !== "granted") {
      setStatusMessage("Enable notifications to receive alerts.");
      return;
    }

    setIsWorking(true);
    try {
      const ready = await navigator.serviceWorker.ready;
      const existing = await ready.pushManager.getSubscription();
      if (forceNew && existing) {
        await existing.unsubscribe().catch(() => undefined);
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        }).catch(() => undefined);
      }

      const subscription =
        (!forceNew && existing) ||
        (await ready.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(status.publicKey),
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const payload = (await response.json().catch(() => null)) as
        | PushStatusResponse
        | null;
      if (!response.ok) {
        const message = payload?.message || payload?.error;
        setStatusMessage(
          debug && message ? message : "Unable to save your subscription."
        );
        return;
      }

      setStatusMessage("Subscription active.");
      setStatus((prev) => ({
        ...prev,
        deviceSubscription: subscription,
      }));
      await refreshAll();
    } catch (error) {
      setStatusMessage(
        debug && error instanceof Error
          ? error.message
          : "Unable to save your subscription."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const permissionLabel = !status.supported
    ? "Not supported"
    : status.permission === "granted"
    ? "Granted"
    : status.permission === "denied"
    ? "Denied"
    : "Default";

  const permissionGuidance = useMemo(() => {
    if (!status.supported) {
      return "Push notifications are not supported on this browser.";
    }
    if (!status.configured) {
      return "Notifications are not configured for this environment.";
    }
    if (status.permission === "denied") {
      return "Notifications are blocked in this browser. Enable them in settings.";
    }
    if (status.permission === "default") {
      return "Enable notifications to receive saved-search alerts.";
    }
    if (!status.deviceSubscription) {
      return "Finish setup on this device to receive alerts.";
    }
    if (status.active && status.subscriptionCount > 0) {
      return "Notifications are active for this device.";
    }
    return "Subscriptions exist, but delivery attempts have not started yet.";
  }, [status]);

  const ctaState = useMemo(() => {
    if (!status.supported) {
      return { type: "unsupported", label: "Not supported" };
    }
    if (!status.configured) {
      return { type: "unconfigured", label: "Push not configured" };
    }
    if (status.permission === "denied") {
      return { type: "denied", label: "Notifications blocked" };
    }
    if (status.permission === "default") {
      return { type: "enable", label: "Enable notifications" };
    }
    if (!status.deviceSubscription || status.subscriptionCount === 0) {
      return { type: "create", label: "Finish setup" };
    }
    return { type: "active", label: "Subscription active" };
  }, [status]);

  const serverSubscriptions = diagnostics?.subscriptions;
  const attempts = diagnostics?.attempts;
  const dedupe = diagnostics?.dedupe;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Notifications diagnostics
        </h2>
        <p className="text-sm text-slate-600">
          Check whether saved-search notifications are ready for this device.
        </p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-700">Device readiness</p>
          <ul className="space-y-1 text-xs text-slate-700">
            <li className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Browser supports push</span>
              <span className="font-semibold">
                {status.supported ? "Yes" : "No"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Service worker registered</span>
              <span className="font-semibold">
                {status.supported
                  ? status.serviceWorkerAvailable
                    ? "Yes"
                    : "No"
                  : "Not supported"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Notification permission</span>
              <span className="font-semibold">{permissionLabel}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Subscription on this device</span>
              <span className="font-semibold">
                {status.deviceSubscription ? "Yes" : "No"}
              </span>
            </li>
          </ul>
          <p className="text-xs text-slate-600">{permissionGuidance}</p>
          <div className="flex flex-wrap items-center gap-2">
            {ctaState.type === "enable" && (
              <Button
                size="sm"
                type="button"
                onClick={handleEnableNotifications}
                disabled={isWorking}
              >
                {isWorking ? "Enabling..." : ctaState.label}
              </Button>
            )}
            {ctaState.type === "create" && (
              <Button
                size="sm"
                type="button"
                onClick={() => handleCreateSubscription(false)}
                disabled={isWorking}
              >
                {isWorking ? "Creating..." : ctaState.label}
              </Button>
            )}
            {ctaState.type === "active" && (
              <span className="text-xs font-semibold text-emerald-700">
                {ctaState.label}
              </span>
            )}
            {(ctaState.type === "active" || ctaState.type === "create") && (
              <Button
                size="sm"
                variant="secondary"
                type="button"
                onClick={() => handleCreateSubscription(true)}
                disabled={isWorking}
              >
                {isWorking ? "Refreshing..." : "Re-subscribe on this device"}
              </Button>
            )}
            {ctaState.type === "denied" && (
              <span className="text-xs font-semibold text-amber-700">
                {ctaState.label}
              </span>
            )}
            {ctaState.type === "unconfigured" && (
              <span className="text-xs font-semibold text-slate-600">
                {ctaState.label}
              </span>
            )}
            {ctaState.type === "unsupported" && (
              <span className="text-xs font-semibold text-slate-600">
                {ctaState.label}
              </span>
            )}
          </div>
          {statusMessage && (
            <p className="text-xs text-slate-600">{statusMessage}</p>
          )}
          {status.error && debug && (
            <p className="text-xs text-amber-600">{status.error}</p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            Subscription counts (server)
          </p>
          {serverSubscriptions?.available ? (
            <ul className="space-y-1 text-xs text-slate-700">
              <li className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Total</span>
                <span className="font-semibold">{serverSubscriptions.total}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Active</span>
                <span className="font-semibold">{serverSubscriptions.active}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-slate-600">New (24h)</span>
                <span className="font-semibold">{serverSubscriptions.last24h}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-slate-600">New (7d)</span>
                <span className="font-semibold">{serverSubscriptions.last7d}</span>
              </li>
            </ul>
          ) : (
            <p className="text-xs text-slate-500">
              Not available.
              {debug && serverSubscriptions?.error
                ? ` (${serverSubscriptions.error})`
                : ""}
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            Delivery attempts (this tenant)
          </p>
          {attempts?.available ? (
            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex flex-wrap gap-2 text-slate-600">
                <span>Last attempt: {formatTimestamp(attempts.lastAttemptAt)}</span>
                <span>Last delivered: {formatTimestamp(attempts.lastDeliveredAt)}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600">
                  24h Attempted: {attempts.last24h?.attempted ?? 0}
                </span>
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600">
                  Delivered: {attempts.last24h?.delivered ?? 0}
                </span>
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600">
                  Failed: {attempts.last24h?.failed ?? 0}
                </span>
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600">
                  Blocked: {attempts.last24h?.blocked ?? 0}
                </span>
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600">
                  Skipped: {attempts.last24h?.skipped ?? 0}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                7d Attempted: {attempts.last7d?.attempted ?? 0} / Delivered:{" "}
                {attempts.last7d?.delivered ?? 0} / Failed:{" "}
                {attempts.last7d?.failed ?? 0}
              </div>
              {attempts.recent.length > 0 ? (
                <div className="space-y-1">
                  {attempts.recent.map((row) => (
                    <div
                      key={`${row.created_at}-${row.status}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
                    >
                      <span>{formatTimestamp(row.created_at)}</span>
                      <span className="font-semibold text-slate-700">
                        {row.status}
                      </span>
                      <span>{row.reason_code ?? "-"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No delivery attempts recorded yet.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Not available.
              {debug && attempts?.error ? ` (${attempts.error})` : ""}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            Dedupe activity (saved searches)
          </p>
          {dedupe?.available ? (
            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 px-2 py-0.5">
                  24h dedupe rows: {dedupe.last24h ?? 0}
                </span>
                <span className="rounded-full border border-slate-200 px-2 py-0.5">
                  7d dedupe rows: {dedupe.last7d ?? 0}
                </span>
              </div>
              {dedupe.topReasons.length > 0 ? (
                <div className="space-y-1 text-xs text-slate-600">
                  {dedupe.topReasons.map((reason) => (
                    <div key={reason.reason} className="flex justify-between">
                      <span>{reason.reason}</span>
                      <span className="font-semibold text-slate-700">
                        {reason.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No dedupe rows recorded yet.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Not available.
              {debug && dedupe?.error ? ` (${dedupe.error})` : ""}
            </p>
          )}
        </div>
      </div>
      {loadingDiagnostics && (
        <p className="mt-3 text-xs text-slate-500">
          Loading diagnostics...
        </p>
      )}
      {!loadingDiagnostics && diagnosticsError && debug && (
        <p className="mt-3 text-xs text-amber-600">{diagnosticsError}</p>
      )}
    </div>
  );
}
