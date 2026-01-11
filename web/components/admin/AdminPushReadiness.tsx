"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

type ReadinessStatus = "ready" | "not_ready" | "unknown";

export type ReadinessRow = {
  label: string;
  value: string;
  status: ReadinessStatus;
};

export type PushReadinessState = {
  supported: boolean;
  configured: boolean;
  permission: NotificationPermission;
  serviceWorkerAvailable: boolean;
  hasSubscription: boolean;
};

type Props = {
  configured: boolean;
  publicKey: string | null;
  publicKeyPresent: boolean;
  privateKeyPresent: boolean;
  showMissingKeys: boolean;
  missingKeys: string[];
  adminSubscriptionAvailable: boolean;
  adminSubscriptionCount: number;
  debug?: boolean;
};

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

type CtaState =
  | { type: "enable"; label: string }
  | { type: "create"; label: string }
  | { type: "active"; label: string }
  | { type: "denied"; label: string }
  | { type: "unsupported"; label: string }
  | { type: "unconfigured"; label: string };

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

export function derivePushReadinessRows(input: {
  publicKeyPresent: boolean;
  privateKeyPresent: boolean;
  serviceWorkerAvailable: boolean;
  permission: NotificationPermission;
  supported: boolean;
  hasSubscription: boolean;
  adminSubscriptionAvailable: boolean;
}): ReadinessRow[] {
  const permissionLabel = !input.supported
    ? "Not supported"
    : input.permission === "granted"
    ? "Granted"
    : input.permission === "denied"
    ? "Denied"
    : "Default";

  const permissionStatus: ReadinessStatus =
    !input.supported
      ? "not_ready"
      : input.permission === "granted"
      ? "ready"
      : "not_ready";

  const serviceWorkerLabel = !input.supported
    ? "Not supported"
    : input.serviceWorkerAvailable
    ? "Available"
    : "Not available";

  const serviceWorkerStatus: ReadinessStatus =
    !input.supported || !input.serviceWorkerAvailable ? "not_ready" : "ready";

  const subscriptionLabel = input.adminSubscriptionAvailable
    ? input.hasSubscription
      ? "Yes"
      : "No"
    : "Not available";

  const subscriptionStatus: ReadinessStatus = input.adminSubscriptionAvailable
    ? input.hasSubscription
      ? "ready"
      : "not_ready"
    : "unknown";

  return [
    {
      label: "VAPID public key present",
      value: input.publicKeyPresent ? "Yes" : "No",
      status: input.publicKeyPresent ? "ready" : "not_ready",
    },
    {
      label: "VAPID private key present",
      value: input.privateKeyPresent ? "Yes" : "No",
      status: input.privateKeyPresent ? "ready" : "not_ready",
    },
    {
      label: "Service worker available",
      value: serviceWorkerLabel,
      status: serviceWorkerStatus,
    },
    {
      label: "Notifications permission",
      value: permissionLabel,
      status: permissionStatus,
    },
    {
      label: "Admin has active subscription",
      value: subscriptionLabel,
      status: subscriptionStatus,
    },
  ];
}

export function derivePushReadinessCta(state: PushReadinessState): CtaState {
  if (!state.supported) {
    return { type: "unsupported", label: "Not supported on this browser" };
  }
  if (!state.configured) {
    return { type: "unconfigured", label: "Push not configured" };
  }
  if (state.permission === "denied") {
    return { type: "denied", label: "Notifications blocked" };
  }
  if (state.permission === "default") {
    return { type: "enable", label: "Enable notifications" };
  }
  if (state.hasSubscription) {
    return { type: "active", label: "Subscription active" };
  }
  return { type: "create", label: "Create subscription" };
}

export function AdminPushReadiness({
  configured,
  publicKey,
  publicKeyPresent,
  privateKeyPresent,
  showMissingKeys,
  missingKeys,
  adminSubscriptionAvailable,
  adminSubscriptionCount,
  debug = false,
}: Props) {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [serviceWorkerAvailable, setServiceWorkerAvailable] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(
    adminSubscriptionCount
  );
  const [hasSubscription, setHasSubscription] = useState(
    adminSubscriptionCount > 0
  );
  const [publicKeyState, setPublicKeyState] = useState(publicKey);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    const supportsPush =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(supportsPush);
    if (!supportsPush) {
      setPermission("default");
      setServiceWorkerAvailable(false);
      return;
    }

    setPermission(Notification.permission);
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        setServiceWorkerAvailable(!!registration);
      })
      .catch(() => {
        setServiceWorkerAvailable(false);
      });
  }, []);

  const refreshStatus = async () => {
    try {
      const response = await fetch("/api/push/status");
      const payload = (await response.json().catch(() => null)) as
        | PushStatusResponse
        | null;
      if (!response.ok) {
        if (payload?.code === "push_not_configured") {
          setStatusMessage(
            "Push notifications are not configured on this environment."
          );
        }
        return;
      }

      setSubscriptionCount(payload?.subscriptionCount ?? 0);
      setHasSubscription(payload?.active === true);
      setPublicKeyState(payload?.vapidPublicKey ?? publicKeyState);
    } catch {
      setStatusMessage("Unable to refresh push status.");
    }
  };

  const handleEnable = async () => {
    setStatusMessage(null);
    if (!supported) return;
    if (Notification.permission === "denied") {
      setPermission(Notification.permission);
      setStatusMessage("Notifications are blocked in this browser.");
      return;
    }

    setIsWorking(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setStatusMessage("Enable notifications to receive alerts.");
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleCreateSubscription = async () => {
    setStatusMessage(null);
    if (!supported || !configured || !publicKeyState) return;
    if (!serviceWorkerAvailable) {
      setStatusMessage("Service worker not available; PWA/push won’t work here.");
      return;
    }

    setIsWorking(true);
    try {
      const ready = await navigator.serviceWorker.ready;
      const existing = await ready.pushManager.getSubscription();
      const subscription =
        existing ||
        (await ready.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKeyState),
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
          debug && message ? message : "Unable to create a subscription."
        );
        return;
      }

      setStatusMessage("Subscription active.");
      await refreshStatus();
    } catch (err) {
      setStatusMessage(
        debug && err instanceof Error
          ? err.message
          : "Unable to create a subscription."
      );
    } finally {
      setIsWorking(false);
    }
  };

  const readinessRows = useMemo(
    () =>
      derivePushReadinessRows({
        publicKeyPresent,
        privateKeyPresent,
        serviceWorkerAvailable,
        permission,
        supported,
        hasSubscription,
        adminSubscriptionAvailable,
      }),
    [
      publicKeyPresent,
      privateKeyPresent,
      serviceWorkerAvailable,
      permission,
      supported,
      hasSubscription,
      adminSubscriptionAvailable,
    ]
  );

  const ctaState = derivePushReadinessCta({
    supported,
    configured,
    permission,
    serviceWorkerAvailable,
    hasSubscription,
  });

  const showMissingKeyCopy =
    showMissingKeys && (!publicKeyPresent || !privateKeyPresent);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs font-semibold text-slate-700">Readiness</p>
      <p className="mt-1 text-xs text-slate-600">
        Checklist for push readiness on this device.
      </p>
      <ul className="mt-3 space-y-1 text-xs text-slate-700">
        {readinessRows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-slate-600">{row.label}</span>
            <span className="flex items-center gap-2 font-semibold text-slate-700">
              <span className="text-[11px]">
                {row.status === "ready" ? "✅" : row.status === "unknown" ? "—" : "❌"}
              </span>
              {row.value}
            </span>
          </li>
        ))}
      </ul>
      {showMissingKeyCopy && missingKeys.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Missing: {missingKeys.join(", ")}
        </p>
      )}
      {!configured && (
        <p className="mt-2 text-xs text-slate-600">
          Push notifications are not configured on this environment.
        </p>
      )}
      {permission === "denied" && (
        <p className="mt-2 text-xs text-slate-600">
          Notifications are blocked in this browser. Enable in browser settings to proceed.
        </p>
      )}
      {permission === "default" && configured && (
        <p className="mt-2 text-xs text-slate-600">
          Enable notifications to receive alerts.
        </p>
      )}
      {configured && supported && !serviceWorkerAvailable && (
        <p className="mt-2 text-xs text-slate-600">
          Service worker not available; PWA/push won’t work here.
        </p>
      )}
      {!supported && (
        <p className="mt-2 text-xs text-slate-600">
          Push is not supported on this browser.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {ctaState.type === "enable" && (
          <Button
            size="sm"
            type="button"
            onClick={handleEnable}
            disabled={isWorking}
          >
            {isWorking ? "Enabling..." : ctaState.label}
          </Button>
        )}
        {ctaState.type === "create" && (
          <Button
            size="sm"
            type="button"
            onClick={handleCreateSubscription}
            disabled={isWorking || !serviceWorkerAvailable}
          >
            {isWorking ? "Creating..." : ctaState.label}
          </Button>
        )}
        {ctaState.type === "active" && (
          <span className="text-xs font-semibold text-emerald-700">
            {ctaState.label} {subscriptionCount ? `(${subscriptionCount})` : ""}
          </span>
        )}
        {ctaState.type === "denied" && (
          <span className="text-xs font-semibold text-amber-700">
            {ctaState.label}
          </span>
        )}
        {ctaState.type === "unsupported" && (
          <span className="text-xs font-semibold text-slate-600">
            {ctaState.label}
          </span>
        )}
        {ctaState.type === "unconfigured" && (
          <span className="text-xs font-semibold text-slate-600">
            {ctaState.label}
          </span>
        )}
      </div>
      {statusMessage && (
        <p className="mt-2 text-xs text-slate-600">{statusMessage}</p>
      )}
    </div>
  );
}
