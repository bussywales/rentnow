"use client";

import { useEffect } from "react";
import { registerRootServiceWorker } from "@/lib/pwa/register-service-worker";

export function PwaServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const debugEnabled = process.env.DEBUG_AUTH_NOISE === "1";

    const register = () => {
      registerRootServiceWorker(navigator.serviceWorker).catch((err) => {
        if (debugEnabled) {
          console.warn("Service worker registration failed", err);
        }
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
