"use client";

import { useEffect } from "react";
import { PwaUpdateToast } from "@/components/pwa/PwaUpdateToast";
import { startPwaInstallCapture } from "@/lib/pwa/install";
import { registerRootServiceWorker } from "@/lib/pwa/register-service-worker";
import { startSwUpdateCapture } from "@/lib/pwa/sw-update";

export function PwaServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    const installCleanup = startPwaInstallCapture(window);
    if (!("serviceWorker" in navigator)) {
      return installCleanup;
    }
    const debugEnabled = process.env.DEBUG_AUTH_NOISE === "1";
    let updateCleanup: (() => void) | null = null;

    const register = async () => {
      try {
        await registerRootServiceWorker(navigator.serviceWorker);
        updateCleanup = startSwUpdateCapture(navigator.serviceWorker);
      } catch (err) {
        if (debugEnabled) {
          console.warn("Service worker registration failed", err);
        }
      }
    };

    if (document.readyState === "complete") {
      void register();
      return () => {
        if (updateCleanup) updateCleanup();
        installCleanup();
      };
    }

    window.addEventListener("load", register, { once: true });
    return () => {
      window.removeEventListener("load", register);
      if (updateCleanup) updateCleanup();
      installCleanup();
    };
  }, []);

  if (process.env.NODE_ENV !== "production") return null;
  return <PwaUpdateToast />;
}
