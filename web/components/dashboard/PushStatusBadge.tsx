"use client";

import { useEffect, useState } from "react";

type PushStatusResponse = {
  ok?: boolean;
  configured?: boolean;
  publicKeyPresent?: boolean;
  vapidPublicKey?: string | null;
  active?: boolean;
  subscriptionCount?: number;
  code?: string;
  message?: string;
  error?: string;
};

type PushStatusState = {
  loading: boolean;
  supported: boolean;
  configured: boolean;
  active: boolean;
  publicKey: string | null;
  error: string | null;
  permission: NotificationPermission;
  subscriptionCount: number;
};

const defaultState: PushStatusState = {
  loading: true,
  supported: true,
  configured: false,
  active: false,
  publicKey: null,
  error: null,
  permission: "default",
  subscriptionCount: 0,
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

export function PushStatusBadge() {
  const [state, setState] = useState<PushStatusState>(defaultState);
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supportsPush =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    const loadStatus = async () => {
      try {
        const res = await fetch("/api/push/status");
        const data = (await res.json().catch(() => null)) as PushStatusResponse | null;
        if (cancelled) return;
        setState({
          loading: false,
          supported: supportsPush,
          configured: data?.configured === true,
          active: data?.active === true,
          publicKey: data?.vapidPublicKey ?? null,
          error: res.ok ? null : data?.message || data?.error || "Push unavailable",
          permission: supportsPush ? Notification.permission : "default",
          subscriptionCount: data?.subscriptionCount ?? 0,
        });
      } catch {
        if (cancelled) return;
        setState({
          loading: false,
          supported: supportsPush,
          configured: false,
          active: false,
          publicKey: null,
          error: "Unable to load push status",
          permission: supportsPush ? Notification.permission : "default",
          subscriptionCount: 0,
        });
      }
    };

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const enablePush = async () => {
    if (!state.supported || !state.configured || !state.publicKey) return;
    if (Notification.permission === "denied") {
      setState((prev) => ({
        ...prev,
        permission: Notification.permission,
        error: "Notifications are blocked in your browser",
      }));
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      setState((prev) => ({
        ...prev,
        error: "Service worker not ready. Reload and try again.",
      }));
      return;
    }

    setIsEnabling(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState((prev) => ({
          ...prev,
          permission,
          error: "Notifications permission was not granted",
        }));
        return;
      }

      const ready = await navigator.serviceWorker.ready;
      const existing = await ready.pushManager.getSubscription();
      const subscription =
        existing ||
        (await ready.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(state.publicKey),
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const data = (await res.json().catch(() => null)) as PushStatusResponse | null;
      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          active: false,
          error: data?.message || data?.error || "Unable to enable push",
        }));
        return;
      }

      const statusRes = await fetch("/api/push/status");
      const statusData = (await statusRes.json().catch(() => null)) as PushStatusResponse | null;
      setState((prev) => ({
        ...prev,
        active: statusData?.active === true,
        subscriptionCount: statusData?.subscriptionCount ?? prev.subscriptionCount,
        error: statusRes.ok ? null : statusData?.message || statusData?.error || null,
        permission: Notification.permission,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Unable to enable push",
      }));
    } finally {
      setIsEnabling(false);
    }
  };

  let label = "Checking";
  if (!state.loading) {
    if (!state.supported) {
      label = "Not supported";
    } else if (!state.configured) {
      label = "Unavailable (not configured)";
    } else if (state.permission === "denied") {
      label = "Blocked in browser";
    } else if (state.active) {
      label = "Enabled";
    } else {
      label = "Off";
    }
  }

  const showEnable =
    !state.loading &&
    state.supported &&
    state.configured &&
    !state.active &&
    state.permission !== "denied";
  const showReenableHint =
    !state.loading &&
    state.supported &&
    state.configured &&
    !state.active &&
    state.permission === "granted" &&
    state.subscriptionCount === 0;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
        Push: {label}
      </span>
      {showEnable && (
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300"
          onClick={enablePush}
          disabled={isEnabling}
        >
          {isEnabling ? "Enabling..." : "Enable notifications"}
        </button>
      )}
      {state.active && state.subscriptionCount > 0 && (
        <span className="text-xs text-slate-500">
          Subscriptions: {state.subscriptionCount}
        </span>
      )}
      {showReenableHint && (
        <span className="text-xs text-slate-500">Notifications need to be re-enabled.</span>
      )}
      {state.error && (
        <span className="text-xs text-amber-600">{state.error}</span>
      )}
    </div>
  );
}
